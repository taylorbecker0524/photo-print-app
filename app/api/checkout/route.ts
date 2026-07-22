import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_US_SHIPPING_CENTS = 699

function getPricePerPrint(size: string, totalQty: number): number {
  const tiers = [
    { minQty: 100, prices: { '4x6': 29, '5x7': 69, '8x10': 149, 'square-4': 35, 'square-5': 69, 'square-8': 129 } },
    { minQty: 50,  prices: { '4x6': 39, '5x7': 89, '8x10': 179, 'square-4': 49, 'square-5': 89, 'square-8': 159 } },
    { minQty: 20,  prices: { '4x6': 59, '5x7': 109, '8x10': 199, 'square-4': 69, 'square-5': 109, 'square-8': 179 } },
    { minQty: 10,  prices: { '4x6': 79, '5x7': 129, '8x10': 219, 'square-4': 89, 'square-5': 129, 'square-8': 199 } },
    { minQty: 1,   prices: { '4x6': 99, '5x7': 149, '8x10': 249, 'square-4': 109, 'square-5': 149, 'square-8': 229 } },
  ]
  const tier = tiers.find(t => totalQty >= t.minQty) ?? tiers[tiers.length - 1]
  return (tier.prices as any)[size] ?? 99
}

export async function POST(req: NextRequest) {
  try {
    const { createServerSupabase } = await import('@/lib/supabase')
    const { stripe } = await import('@/lib/stripe')
    const { getProdigiShippingQuote, getSku } = await import('@/lib/prodigi')

    const body = await req.json()
    const { email, items, shippingAddress, finish } = body

    if (!email || !items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (finish !== 'lustre' && finish !== 'gloss') {
      return NextResponse.json(
        { error: 'Please select a finish (lustre or gloss)' },
        { status: 400 }
      )
    }

    if (shippingAddress.country !== 'US') {
      return NextResponse.json(
        { error: 'We currently only ship within the United States' },
        { status: 400 }
      )
    }

    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0)
    const subtotal = items.reduce(
      (s: number, i: any) => s + getPricePerPrint(i.size, totalQty) * i.quantity,
      0
    )

    let shippingCents: number
    // Default method if the quote call fails; the webhook fulfills with whatever
    // we record here, so the method we charge for and the method we order always match.
    let shippingMethod = 'Budget'
    try {
      const quote = await getProdigiShippingQuote({
        items: items.map((i: any) => ({ sku: getSku(i.size), copies: i.quantity })),
        destinationCountryCode: shippingAddress.country,
        finish,
      })
      shippingCents = quote.shippingCents
      shippingMethod = quote.method // cheapest available method (usually Budget)
    } catch (quoteErr: any) {
      console.error('[checkout] Prodigi quote failed, using fallback:', quoteErr?.message)
      shippingCents = FALLBACK_US_SHIPPING_CENTS
    }

    const total = subtotal + shippingCents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      receipt_email: email,
      metadata: { email, finish, shippingMethod },
      automatic_payment_methods: { enabled: true },
    })

    const supabase = createServerSupabase()
    const orderId = randomUUID()
    const orderItems = items.map((item: any) => ({
      photo_path: item.photoPath,
      size: item.size,
      quantity: item.quantity,
      stamp: item.stamp,
      finish,
      unit_price_cents: getPricePerPrint(item.size, totalQty),
    }))

    const { error: dbError } = await supabase.from('orders').insert({
      id: orderId,
      email,
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
      total_cents: total,
      items: orderItems,
      shipping_address: shippingAddress,
    })
    if (dbError) throw dbError

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      breakdown: { subtotal, shipping: shippingCents, total },
    })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
