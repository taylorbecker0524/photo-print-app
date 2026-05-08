import { NextRequest, NextResponse } from 'next/server'
import { stripe, calculateOrderTotal, getPricePerPrint } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, items, shippingAddress } = body

    // Validate required fields
    if (!email || !items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate each item has a stored photo path (not a user-supplied URL)
    for (const item of items) {
      if (!item.photoPath?.startsWith('uploads/')) {
        return NextResponse.json({ error: 'Invalid photo reference' }, { status: 400 })
      }
    }

    // Calculate price server-side (never trust client prices)
    const { subtotal, shipping, total } = calculateOrderTotal(items)

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      receipt_email: email,
      metadata: { email },
      automatic_payment_methods: { enabled: true },
    })

    // Create order record in Supabase (status = pending until payment confirmed)
    const supabase = createServerSupabase()
    const orderId = randomUUID()

    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0)
    const orderItems = items.map((item: any) => ({
      photo_path: item.photoPath,
      size: item.size,
      quantity: item.quantity,
      stamp: item.stamp,
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
      breakdown: {
        subtotal,
        shipping,
        total,
      },
    })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
