import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A customer's own order list, for the track-order page.
//
// This used to take an email straight from the request body and return that
// address's orders, so anyone could type any address and read someone else's
// order history. Now the caller must present a Supabase session and we use the
// email on that verified session — any email in the body is ignored. Signing in
// is a magic link sent to the address, so proving you own it is the same step
// as asking for the orders.
//
// The order detail page stays reachable without signing in, by way of the
// unguessable id in the link we email with the receipt. That is deliberate:
// someone who has just bought prints as a guest must be able to follow that
// link without making an account.
export async function POST(req: NextRequest) {
  try {
    const { createClient } = await import('@supabase/supabase-js')

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Please sign in to see your orders' }, { status: 401 })
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: { user }, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !user?.email) {
      return NextResponse.json({ error: 'Please sign in to see your orders' }, { status: 401 })
    }
    const email = user.email.toLowerCase()

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total_cents, items, created_at, tracking_url')
      .ilike('email', email) // case-insensitive exact match (no wildcards)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[orders/lookup]', error)
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    }

    // Drop abandoned checkouts. A row is inserted every time someone submits the
    // shipping form, so not finishing — or going back to change something —
    // leaves a row at 'pending' forever. Listing those alongside real orders
    // shows customers things they never bought. Development testing alone had
    // left 27 of them going back to May.
    //
    // A genuinely-just-paid order also sits at 'pending' for the minute it takes
    // Stripe's webhook to arrive, so recent ones are kept: someone who has just
    // paid must still find their order here.
    const PENDING_GRACE_MS = 60 * 60 * 1000
    const visible = (data ?? []).filter((o: any) => {
      if (o.status !== 'pending') return true
      const age = Date.now() - new Date(o.created_at).getTime()
      return Number.isFinite(age) && age < PENDING_GRACE_MS
    })

    const orders = visible.map((o: any) => {
      const items = Array.isArray(o.items) ? o.items : []
      // Group by size, as the checkout summary does. Each photo is its own item,
      // so a twenty-print order produced twenty repetitions of '1x 4x6"'.
      const bySize = new Map<string, number>()
      for (const i of items) {
        const size = String(i?.size ?? '')
        bySize.set(size, (bySize.get(size) ?? 0) + (Number(i?.quantity) || 0))
      }
      const itemSummary = Array.from(bySize.entries())
        .filter(([size]) => size)
        .map(([size, qty]) => `${qty}× ${size}"`)
        .join(', ')
      return {
        id: o.id,
        status: o.status,
        totalCents: o.total_cents,
        createdAt: o.created_at,
        hasTracking: !!o.tracking_url,
        itemCount: items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
        itemSummary,
      }
    })

    return NextResponse.json({ orders })
  } catch (err) {
    console.error('[orders/lookup]', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
