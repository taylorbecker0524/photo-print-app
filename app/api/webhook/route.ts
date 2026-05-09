import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { stripe } = await import('@/lib/stripe')
    const { createServerSupabase } = await import('@/lib/supabase')
    const { createProdigiOrder, getSku } = await import('@/lib/prodigi')
    const { sendOrderConfirmation } = await import('@/lib/email')

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')
    if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

    let event
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (err) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as any
      const { data: order } = await supabase
        .from('orders').select('*').eq('stripe_payment_intent_id', pi.id).single()
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)
      await sendOrderConfirmation({
        email: order.email, orderId: order.id,
        items: order.items, totalCents: order.total_cents,
      })

      const prodigiItems = await Promise.all(
        order.items.map(async (item: any, idx: number) => {
          const { data: signedUrl } = await supabase.storage
            .from('print-photos').createSignedUrl(item.photo_path, 3600)
          return {
            merchantReference: `${order.id}-item-${idx}`,
            sku: getSku(item.size), copies: item.quantity,
            sizing: 'fillPrintArea' as const,
            assets: [{ printArea: 'default' as const, url: signedUrl!.signedUrl }],
          }
        })
      )

      const addr = order.shipping_address
      const prodigiResult = await createProdigiOrder({
        merchantReference: order.id, shippingMethod: 'Standard',
        recipient: {
          name: addr.name, email: order.email,
          address: {
            line1: addr.line1, line2: addr.line2,
            postalOrZipCode: addr.zip, countryCode: addr.country,
            townOrCity: addr.city, stateOrCounty: addr.state,
          },
        },
        items: prodigiItems,
      })

      await supabase.from('orders').update({
        status: 'processing', prodigi_order_id: prodigiResult.order.id,
      }).eq('id', order.id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook]', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
