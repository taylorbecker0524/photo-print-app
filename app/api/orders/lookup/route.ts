import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public order lookup by email. Returns a compact list of a customer's orders so
// they can check status without creating an account.
//
// PRIVACY NOTE: this trusts the typed email — anyone can enter any address and
// see that address's order list. It is kept intentionally minimal (status,
// totals, item summary; NO shipping address, NO photos) to limit exposure.
// Before running paid marketing, gate this behind the magic-link auth in /login
// so customers only ever see their own verified orders.
export async function POST(req: NextRequest) {
  try {
    const { createServerSupabase } = await import('@/lib/supabase')
    const body = await req.json().catch(() => ({}))
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    // Basic shape check — don't touch the DB for obviously invalid input.
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
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

    const orders = (data ?? []).map((o: any) => {
      const items = Array.isArray(o.items) ? o.items : []
      return {
        id: o.id,
        status: o.status,
        totalCents: o.total_cents,
        createdAt: o.created_at,
        hasTracking: !!o.tracking_url,
        itemCount: items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
        itemSummary: items
          .map((i: any) => `${i.quantity}× ${i.size}"`)
          .join(', '),
      }
    })

    return NextResponse.json({ orders })
  } catch (err) {
    console.error('[orders/lookup]', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
