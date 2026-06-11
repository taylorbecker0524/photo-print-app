import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { stripe } = await import('@/lib/stripe')
  const { createServerSupabase } = await import('@/lib/supabase')
  const { createProdigiOrder, getSku } = await import('@/lib/prodigi')
  const { sendOrderConfirmation, sendAdminAlert } = await import('@/lib/email')

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only handle the events we care about. Acknowledge everything else with 200.
  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const supabase = createServerSupabase()
  const pi = event.data.object as any

  // Look up the order keyed by Stripe payment intent
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_payment_intent_id', pi.id)
    .single()

  if (orderErr || !order) {
    console.error('[webhook] order not found for PI', pi.id, orderErr)
    // 200 so Stripe stops retrying — manual investigation needed for orphaned payments
    return NextResponse.json({ error: 'Order not found' }, { status: 200 })
  }

  // FIX #2 (audit): idempotency guard. If we've already processed this order,
  // bail out fast. Stripe retries succeeded events under various conditions and
  // without this guard we'd create duplicate Prodigi orders + double-email customers.
  if (order.status === 'paid' || order.status === 'processing' || order.status === 'shipped') {
    console.log('[webhook] order already processed, skipping', order.id, order.status)
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  // Mark as paid immediately so any concurrent retry sees the guard above
  await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)

  // FIX #5 (audit): build Prodigi payload. Wrap entire fulfillment in try/catch
  // so failures don't dangle the order silently. On failure: mark order as
  // 'fulfillment_failed', record the error, alert the admin, and return 200 so
  // Stripe doesn't retry (we don't want repeated fulfillment attempts).
  try {
    // Generate signed URLs for each photo. Prodigi pulls from these URLs.
    const prodigiItems = await Promise.all(
      order.items.map(async (item: any, idx: number) => {
        const { data: signed, error: urlErr } = await supabase.storage
          .from('print-photos')
          .createSignedUrl(item.photo_path, 60 * 60 * 24) // 24-hour TTL — Prodigi fetches once shortly after
        if (urlErr || !signed?.signedUrl) {
          throw new Error(`Failed to sign URL for ${item.photo_path}: ${urlErr?.message ?? 'no URL returned'}`)
        }
        return {
          merchantReference: `${order.id}-item-${idx}`,
          sku: getSku(item.size),
          copies: item.quantity,
          sizing: 'fillPrintArea' as const,
          assets: [{ printArea: 'default' as const, url: signed.signedUrl }],
        }
      })
    )

    const addr = order.shipping_address
    const prodigiResult = await createProdigiOrder({
      merchantReference: order.id,
      shippingMethod: 'Standard',
      recipient: {
        name: addr.name,
        email: order.email,
        address: {
          line1: addr.line1,
          line2: addr.line2,
          postalOrZipCode: addr.zip,
          countryCode: addr.country,
          townOrCity: addr.city,
          stateOrCounty: addr.state,
        },
      },
      items: prodigiItems,
    })

    // FIX #4 (audit): only mark processing AND send confirmation email AFTER
    // Prodigi accepts the order. Previously the email went out before Prodigi
    // was even called — customer would get "your order is confirmed" then we'd
    // silently fail to fulfill.
    await supabase
      .from('orders')
      .update({
        status: 'processing',
        prodigi_order_id: prodigiResult.order.id,
      })
      .eq('id', order.id)

    await sendOrderConfirmation({
      email: order.email,
      orderId: order.id,
      items: order.items,
      totalCents: order.total_cents,
    })

    return NextResponse.json({ received: true, prodigiOrderId: prodigiResult.order.id })
  } catch (err: any) {
    const errorMessage = err?.message ?? 'Unknown Prodigi/fulfillment error'
    console.error('[webhook] fulfillment failed for order', order.id, err)

    // Mark order as needing manual intervention
    await supabase
      .from('orders')
      .update({
        status: 'fulfillment_failed',
        fulfillment_error: errorMessage.slice(0, 2000),
      })
      .eq('id', order.id)

    // Alert admin — fire and forget, don't block response on email
    sendAdminAlert({
      subject: `[archive] Fulfillment failed for order ${order.id}`,
      body: `
Order ID: ${order.id}
Customer email: ${order.email}
Stripe payment intent: ${pi.id}
Amount: $${(order.total_cents / 100).toFixed(2)}

Error:
${errorMessage}

The customer has been charged but the print order was not created.
Manual action required: investigate the error above, then either retry
fulfillment or refund via Stripe dashboard.
      `.trim(),
    }).catch(e => console.error('[webhook] admin alert failed', e))

    // Return 200 so Stripe stops retrying. The error is captured in the DB
    // and the admin has been alerted; retrying via webhook would just send
    // more failure emails.
    return NextResponse.json({ received: true, fulfillmentFailed: true, error: errorMessage })
  }
}
