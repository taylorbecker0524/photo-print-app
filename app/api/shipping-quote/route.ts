import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_US_SHIPPING_CENTS = 699  // $6.99

export async function POST(req: NextRequest) {
  try {
    const { getProdigiShippingQuote, getSku } = await import('@/lib/prodigi')
    const body = await req.json()
    const { items, destinationCountryCode, finish } = body

    if (!items?.length || !destinationCountryCode) {
      return NextResponse.json(
        { error: 'Missing required fields: items, destinationCountryCode' },
        { status: 400 }
      )
    }

    if (finish !== 'lustre' && finish !== 'gloss') {
      return NextResponse.json(
        { error: 'Please select a finish (lustre or gloss) before calculating shipping' },
        { status: 400 }
      )
    }

    if (destinationCountryCode !== 'US') {
      return NextResponse.json(
        { error: 'We currently only ship within the United States' },
        { status: 400 }
      )
    }

    const prodigiItems = items.map((i: any) => ({
      sku: getSku(i.size),
      copies: i.quantity,
    }))

    try {
      const quote = await getProdigiShippingQuote({
        items: prodigiItems,
        destinationCountryCode,
        finish,
      })
      return NextResponse.json({
        shippingCents: quote.shippingCents,
        currency: quote.currency,
        method: quote.method,
        source: 'prodigi',
      })
    } catch (quoteErr: any) {
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
