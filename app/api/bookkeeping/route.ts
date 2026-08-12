import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Bookkeeping export.
//
// Returns one CSV row per order with revenue, estimated costs and estimated
// net, so the numbers can be pulled straight into Excel (Data → Get Data →
// From Web) and refreshed rather than copied by hand.
//
// This endpoint exposes customer emails and shipping states, so it is gated on
// a shared secret in BOOKKEEPING_TOKEN. Treat the URL as a password: anyone
// holding it can read the order book.
//
//   /api/bookkeeping?token=...          paid orders onward (default)
//   /api/bookkeeping?token=...&all=1    include abandoned 'pending' carts too
//
// Costs are estimates from lib/costs.ts, not invoices. They are close enough
// to steer pricing decisions and far cheaper than bookkeeping software, but
// the authoritative figures are what Prodigi and Stripe actually bill.

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Quote anything that could break a CSV parser, and double any inner quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const money = (cents: number) => (cents / 100).toFixed(2)

export async function GET(req: NextRequest) {
  const expected = process.env.BOOKKEEPING_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'Export not configured' }, { status: 500 })
  }
  if (new URL(req.url).searchParams.get('token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const includeAbandoned = new URL(req.url).searchParams.get('all') === '1'

  const { createServerSupabase } = await import('@/lib/supabase')
  const {
    estimateProductCostCents,
    estimateStripeFeeCents,
    PRODIGI_SHIPPING_COST_CENTS,
    PRODIGI_TAX_RATE,
  } = await import('@/lib/costs')

  const supabase = createServerSupabase()
  let query = supabase.from('orders').select('*').order('created_at', { ascending: true })
  // 'pending' means the customer never completed payment — an abandoned cart,
  // not a sale. Excluded by default so the sheet reflects actual business.
  if (!includeAbandoned) query = query.neq('status', 'pending')

  const { data: orders, error } = await query
  if (error) {
    console.error('[bookkeeping] query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const header = [
    'date', 'order_id', 'status', 'customer_email', 'ship_state',
    'prints', 'sizes',
    'gross_charged', 'product_revenue', 'shipping_charged',
    'est_product_cost', 'est_shipping_cost', 'est_prodigi_tax', 'est_stripe_fee',
    'est_total_cost', 'est_net', 'est_margin_pct',
    'stripe_payment_intent', 'prodigi_order_id', 'tracking_number',
  ]

  const rows = (orders ?? []).map((o: any) => {
    const items: any[] = Array.isArray(o.items) ? o.items : []
    const prints = items.reduce((n, i) => n + (Number(i?.quantity) || 0), 0)
    const sizes = items
      .map(i => `${Number(i?.quantity) || 0}x ${i?.size ?? '?'}`)
      .join('; ')

    const gross = Number(o.total_cents) || 0
    // Shipping isn't stored separately, but total = items + shipping, and each
    // item carries the unit price it was actually charged at. Subtracting gives
    // the shipping the customer paid without needing a schema change.
    const productRevenue = items.reduce(
      (sum, i) => sum + (Number(i?.unit_price_cents) || 0) * (Number(i?.quantity) || 0),
      0
    )
    const shippingCharged = Math.max(0, gross - productRevenue)

    const productCost = estimateProductCostCents(items)
    // We only pay Prodigi once the order is actually placed with them.
    const reachedProdigi = Boolean(o.prodigi_order_id)
    const shippingCost = reachedProdigi ? PRODIGI_SHIPPING_COST_CENTS : 0
    const prodigiTax = Math.round((productCost + shippingCost) * PRODIGI_TAX_RATE)
    const stripeFee = estimateStripeFeeCents(gross)

    const totalCost = (reachedProdigi ? productCost : 0) + shippingCost + prodigiTax + stripeFee
    const net = gross - totalCost
    const marginPct = gross > 0 ? ((net / gross) * 100).toFixed(1) : ''

    return [
      o.created_at ? String(o.created_at).slice(0, 10) : '',
      o.id,
      o.status,
      o.email,
      o.shipping_address?.state ?? '',
      prints,
      sizes,
      money(gross),
      money(productRevenue),
      money(shippingCharged),
      money(reachedProdigi ? productCost : 0),
      money(shippingCost),
      money(prodigiTax),
      money(stripeFee),
      money(totalCost),
      money(net),
      marginPct,
      o.stripe_payment_intent_id ?? '',
      o.prodigi_order_id ?? '',
      o.tracking_number ?? '',
    ]
  })

  const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="archive-yours-bookkeeping.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
