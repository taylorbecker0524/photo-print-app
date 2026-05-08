import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase'
import { createProdigiOrder, getSku } from '@/lib/prodigi'
import { sendOrderConfirmation, sendShippingConfirmation } from '@/lib/email'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Stripe requires the raw body for signature verification
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] Invalid signature', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  // ── Payment succeeded ──────────────────────────────────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    // Find the order
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (error || !order) {
      console.error('[webhook] Order not found for PI', pi.id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Mark as paid
    await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)

    // Send confirmation email
    await sendOrderConfirmation({
      email: order.email,
      orderId: order.id,
      items: order.items,
      totalCents: order.total_cents,
    })

    // Generate short-lived signed URLs for each photo and submit to Prodigi
    const prodigiItems = await Promise.all(
      order.items.map(async (item: any, idx: number) => {
        const { data: signedUrl } = await supabase.storage
          .from('print-photos')
          .createSignedUrl(item.photo_path, 60 * 60)  // 1 hour — enough for Prodigi to fetch

        return {
          merchantReference: `${order.id}-item-${idx}`,
          sku: getSku(item.size),
          copies: item.quantity,
          sizing: 'fillPrintArea' as const,
          assets: [{ printArea: 'default' as const, url: signedUrl!.signedUrl }],
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

    // Save Prodigi order ID and mark as processing
    await supabase.from('orders').update({
      status: 'processing',
      prodigi_order_id: prodigiResult.order.id,
    }).eq('id', order.id)
  }

  // ── Prodigi shipping webhook (configure in Prodigi dashboard) ──────────────
  // Prodigi can POST to /api/webhook/prodigi — see the route below
  // Here we handle the Stripe side only

  return NextResponse.json({ received: true })
}
