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

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Fail loudly and clearly rather than throwing a cryptic error inside
    // constructEvent. This is the #1 launch misconfiguration.
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set — cannot verify events')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const supabase = createServerSupabase()
  const pi = event.data.object as any

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_payment_intent_id', pi.id)
    .single()

  if (orderErr || !order) {
    console.error('[webhook] order not found for PI', pi.id, orderErr)
    return NextResponse.json({ error: 'Order not found' }, { status: 200 })
  }

  // Idempotency guard
  if (order.status === 'paid' || order.status === 'processing' || order.status === 'shipped') {
    console.log('[webhook] order already processed, skipping', order.id, order.status)
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)

  // Send the customer's receipt as soon as payment is confirmed — independent of
  // fulfillment. A Prodigi failure must NOT prevent the confirmation email, and
  // an email failure must NOT flip the order to fulfillment_failed. Each concern
  // gets its own try/catch (fulfillment is handled below).
  try {
    await sendOrderConfirmation({
      email: order.email,
      orderId: order.id,
      items: order.items,
      totalCents: order.total_cents,
    })
  } catch (emailErr) {
    console.error('[webhook] confirmation email failed for order', order.id, emailErr)
  }

  try {
    const prodigiItems = await Promise.all(
      order.items.map(async (item: any, idx: number) => {
        const { data: signed, error: urlErr } = await supabase.storage
          .from('print-photos')
          .createSignedUrl(item.photo_path, 60 * 60 * 24)
        if (urlErr || !signed?.signedUrl) {
          throw new Error(`Failed to sign URL for ${item.photo_path}: ${urlErr?.message ?? 'no URL returned'}`)
        }
        // FIX: pass finish attribute to Prodigi. Required for photo SKUs.
        // Default to 'lustre' if somehow missing (older orders pre-feature)
        const finish = item.finish ?? 'lustre'
        return {
          merchantReference: `${order.id}-item-${idx}`,
          sku: getSku(item.size),
          copies: item.quantity,
          sizing: 'fillPrintArea' as const,
          attributes: { finish },
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
        // Route Prodigi's own order/shipping notifications to OUR inbox, not the
        // customer's — otherwise customers get confusing Prodigi-branded emails
        // ("Order received", "Hannah at Prodigi"). The print still ships to the
        // customer (recipient.address below); only the notification contact
        // changes. Override the destination with PRODIGI_CONTACT_EMAIL if needed.
        email: process.env.PRODIGI_CONTACT_EMAIL ?? process.env.ADMIN_EMAIL ?? 'orders@archiveyours.com',
        address: {
          line1: addr.line1,
          // Prodigi rejects optional fields that are present but empty
          // ("MustNotBeEmptyOrWhitespace"), so only include line2 / stateOrCounty
          // when the customer actually entered a value. Blank apartment/suite
          // lines are common and must be omitted entirely, not sent as "".
          ...(addr.line2 && String(addr.line2).trim() ? { line2: addr.line2 } : {}),
          postalOrZipCode: addr.zip,
          countryCode: addr.country,
          townOrCity: addr.city,
          ...(addr.state && String(addr.state).trim() ? { stateOrCounty: addr.state } : {}),
        },
      },
      items: prodigiItems,
    })

    await supabase
      .from('orders')
      .update({
        status: 'processing',
        prodigi_order_id: prodigiResult.order.id,
      })
      .eq('id', order.id)

    return NextResponse.json({ received: true, prodigiOrderId: prodigiResult.order.id })
  } catch (err: any) {
    const errorMessage = err?.message ?? 'Unknown Prodigi/fulfillment error'
    console.error('[webhook] fulfillment failed for order', order.id, err)

    await supabase
      .from('orders')
      .update({
        status: 'fulfillment_failed',
        fulfillment_error: errorMessage.slice(0, 2000),
      })
      .eq('id', order.id)

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

    return NextResponse.json({ received: true, fulfillmentFailed: true, error: errorMessage })
  }
}
