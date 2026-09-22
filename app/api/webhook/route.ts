import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Fulfillment signs a URL per photo and then calls Prodigi. On a large order the
// default 10s serverless budget is not enough, and a killed function cannot run
// its own catch block — which is precisely how a failure becomes invisible.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { stripe } = await import('@/lib/stripe')
  const { createServerSupabase } = await import('@/lib/supabase')
  // Fulfillment itself lives in lib/fulfillment so that free promotional orders,
  // which never touch Stripe and so never produce a webhook, can run exactly the
  // same code rather than a second copy of it that drifts.
  const { fulfillPaidOrder } = await import('@/lib/fulfillment')

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

  const result = await fulfillPaidOrder({
    order,
    // Fulfill with the same shipping method we quoted and charged at checkout
    // (recorded in the PaymentIntent metadata), so we never charge Budget but
    // order Standard. Falls back to Budget for older orders without metadata.
    shippingMethod: pi.metadata?.shippingMethod || 'Budget',
    paymentRef: `Stripe payment intent ${pi.id}`,
  })

  if (result.status === 'already_processed') {
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }
  if (result.status === 'failed') {
    return NextResponse.json({ received: true, fulfillmentFailed: true, error: result.error })
  }
  return NextResponse.json({ received: true, prodigiOrderId: result.prodigiOrderId })
}
