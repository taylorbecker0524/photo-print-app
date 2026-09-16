import { NextRequest, NextResponse } from 'next/server'
import { SHIPPING_FLAT_CENTS } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
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

    // One flat shipping price for every order. We used to quote Prodigi live,
    // which is why an ordinary order once showed $13.40: Prodigi bills per
    // parcel, and a large print ships in a second one. Charging a single
    // predictable price is worth more than passing the real cost through.
    //
    // This also removes a network call from the checkout path, so shipping now
    // appears instantly and can no longer fail or fall back.
    void items
    return NextResponse.json({
      shippingCents: SHIPPING_FLAT_CENTS,
      currency: 'USD',
      method: 'Budget',
      source: 'flat',
    })
  } catch (err: any) {
    console.error('[shipping-quote] error:', err)
    return NextResponse.json(
      { error: 'Failed to get shipping quote' },
      { status: 500 }
    )
  }
}
