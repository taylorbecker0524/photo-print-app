import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// US-only flat rate fallback used when Prodigi quote API is unavailable.
// Set conservatively above typical Prodigi US shipping cost to protect margin.
const FALLBACK_US_SHIPPING_CENTS = 699  // $6.99

export async function POST(req: NextRequest) {
  try {
    const { getProdigiShippingQuote, getSku } = await import('@/lib/prodigi')
    const body = await req.json()
    const { items, destinationCountryCode } = body

    if (!items?.length || !destinationCountryCode) {
      return NextResponse.json(
        { error: 'Missing required fields: items, destinationCountryCode' },
        { status: 400 }
      )
    }

    // US-only at launch. Reject other destinations explicitly so we don't
    // accidentally accept an order we can't fulfill profitably.
    if (destinationCountryCode !== 'US') {
      return NextResponse.json(
        { error: 'We currently only ship within the United States' },
        { status: 400 }
      )
    }

    // Map cart items to Prodigi SKUs
    const prodigiItems = items.map((i: any) => ({
      sku: getSku(i.size),
      copies: i.quantity,
    }))

    try {
      const quote = await getProdigiShippingQuote({
        items: prodigiItems,
        destinationCountryCode,
        shippingMethod: 'Standard',
      })
      return NextResponse.json({
        shippingCents: quote.shippingCents,
        currency: quote.currency,
        method: quote.method,
        source: 'prodigi',
      })
    } catch (quoteErr: any) {
      // Prodigi quote failed — fall back to flat rate so customer can still
      // check out. We swallow the actual API error for security but log it.
      console.error('[shipping-quote] Prodigi quote failed, using fallback:', quoteErr?.message)
      return NextResponse.json({
        shippingCents: FALLBACK_US_SHIPPING_CENTS,
        currency: 'USD',
        method: 'Standard',
        source: 'fallback',
      })
    }
  } catch (err: any) {
    console.error('[shipping-quote] error:', err)
    return NextResponse.json(
      { error: 'Failed to get shipping quote' },
      { status: 500 }
    )
  }
}
