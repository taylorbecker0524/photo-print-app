import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Prodigi order-status callback.
//
// Prodigi POSTs here (the callbackUrl we set when creating the order) each time
// an order's status changes — most importantly when it dispatches, at which
// point a tracking number/URL becomes available. We record the tracking on the
// order (so the /orders status page can show it) and send the customer a
// branded "your prints are on their way" email — once.
//
// Payloads are CloudEvents-shaped: { data: { order: { id, merchantReference,
// status, shipments: [{ tracking: { number, url }, dispatchDate, ... }] } } }.
// We parse defensively so minor shape differences don't break it.
export async function POST(req: NextRequest) {
  // Optional shared-secret gate: if PRODIGI_CALLBACK_TOKEN is set, the callback
  // URL carries ?token=… and we require it to match. (Prodigi order IDs are
  // already unguessable, so this is defense-in-depth, not the only check.)
  const expectedToken = process.env.PRODIGI_CALLBACK_TOKEN
  if (expectedToken) {
    const token = new URL(req.url).searchParams.get('token')
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const prodigiOrder = payload?.data?.order ?? payload?.order ?? payload
  const prodigiOrderId: string | undefined = prodigiOrder?.id
  const merchantRef: string | undefined = prodigiOrder?.merchantReference
  if (!prodigiOrderId && !merchantRef) {
    return NextResponse.json({ received: true, ignored: 'no order identifier' })
  }

  const { createServerSupabase } = await import('@/lib/supabase')
  const { sendShippingConfirmation } = await import('@/lib/email')
  const supabase = createServerSupabase()

  // Find our order: prefer the Prodigi order id we stored, fall back to our own
  // id (which we passed to Prodigi as merchantReference).
  let ourOrder: any = null
  if (prodigiOrderId) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('prodigi_order_id', prodigiOrderId)
      .maybeSingle()
    ourOrder = data
  }
  if (!ourOrder && merchantRef) {
    const { data } = await supabase.from('orders').select('*').eq('id', merchantRef).maybeSingle()
    ourOrder = data
  }
  if (!ourOrder) {
    // Unknown order — acknowledge so Prodigi doesn't keep retrying.
    return NextResponse.json({ received: true, ignored: 'order not found' })
  }

  // Pull tracking from the first shipment that has any.
  const shipments: any[] = Array.isArray(prodigiOrder?.shipments) ? prodigiOrder.shipments : []
  const shipment = shipments.find(
    (s) => s?.tracking?.number || s?.tracking?.url || s?.dispatchDate
  )
  const trackingNumber: string | null = shipment?.tracking?.number ?? null
  const trackingUrl: string | null = shipment?.tracking?.url ?? null

  const stage = String(prodigiOrder?.status?.stage ?? prodigiOrder?.status ?? '').toLowerCase()
  const hasShipped = shipments.length > 0 && (!!shipment || stage === 'complete')

  const alreadyNotified = ourOrder.status === 'shipped' || ourOrder.status === 'delivered'

  const updates: Record<string, any> = {}
  if (trackingNumber) updates.tracking_number = trackingNumber
  if (trackingUrl) updates.tracking_url = trackingUrl
  if (hasShipped && !alreadyNotified) updates.status = 'shipped'

  if (Object.keys(updates).length > 0) {
    await supabase.from('orders').update(updates).eq('id', ourOrder.id)
  }

  // Send the branded shipping email exactly once — on the transition to shipped,
  // and only when we actually have something to track.
  if (hasShipped && !alreadyNotified && (trackingNumber || trackingUrl)) {
    try {
      await sendShippingConfirmation({
        email: ourOrder.email,
        orderId: ourOrder.id,
        trackingNumber: trackingNumber ?? '',
        trackingUrl: trackingUrl ?? '',
      })
    } catch (e) {
      console.error('[webhook/prodigi] shipping email failed for order', ourOrder.id, e)
    }
  }

  return NextResponse.json({ received: true })
}
