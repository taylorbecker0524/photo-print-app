import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getPricePerPrintCents, MIN_ORDER_QTY, SHIPPING_FLAT_CENTS } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { createServerSupabase } = await import('@/lib/supabase')
    const { stripe } = await import('@/lib/stripe')

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

    // Enforce the minimum order server-side. The studio blocks this in the UI,
    // but the UI is not a security boundary — a hand-rolled request must not be
    // able to create a loss-making order.
    const requestedQty = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)
    if (requestedQty < MIN_ORDER_QTY) {
      return NextResponse.json(
        { error: `Orders start at ${MIN_ORDER_QTY} prints. Please add ${MIN_ORDER_QTY - requestedQty} more before checking out.` },
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
      (s: number, i: any) => s + getPricePerPrintCents(i.size, totalQty) * i.quantity,
      0
    )

    // One flat shipping price, matching what the customer was shown. We no
    // longer quote Prodigi at checkout: their price is per parcel, so an order
    // with one large print came back at $13.40 with nothing to explain it.
    // Charging a fixed price also means checkout can no longer be delayed or
    // derailed by an outage at Prodigi.
    const shippingCents = SHIPPING_FLAT_CENTS
    // The webhook fulfills with whatever we record here, so the method we
    // charge for and the method we order always match.
    const shippingMethod = 'Budget'

    // Sales tax.
    //
    // We are registered to collect in Florida, so Stripe Tax decides what is
    // owed from where the parcel is going. An out-of-state address comes back
    // zero, which is correct — we have no obligation to collect there.
    //
    // If this call fails we charge no tax rather than block the sale. That is a
    // deliberate trade: an uncollected Florida order costs us ~7.5% out of
    // pocket, but a checkout that throws costs us the entire order. The failure
    // is logged loudly so it cannot pass unnoticed.
    let taxCents = 0
    let taxCalculationId: string | null = null
    try {
      const calc = await stripe.tax.calculations.create({
        currency: 'usd',
        // Delivery is billed as a line item, not as shipping_cost, so it is
        // taxed exactly like the prints it delivers.
        //
        // Florida exempts a separately stated delivery charge only when the
        // customer could have avoided it — by collecting the goods or arranging
        // their own carrier. We offer no pickup, so the charge is unavoidable
        // and forms part of the sales price.
        //
        // Under-collecting is the expensive mistake: it surfaces at audit and
        // comes out of our pocket, because past customers cannot be re-invoiced
        // for it. Over-collecting is simply remitted to the state and costs the
        // customer about 50c. We take the cheap error on purpose.
        //
        // Neither line sets a tax_code, so both inherit the account preset
        // (General - Tangible Goods). Setting a goods code on shipping_cost
        // instead is rejected by Stripe and silently yields zero tax.
        line_items: [
          { amount: subtotal, reference: 'prints', tax_behavior: 'exclusive' },
          // 'shipping' is a reserved reference in Stripe Tax; 'delivery' is not.
          { amount: shippingCents, reference: 'delivery', tax_behavior: 'exclusive' },
        ],
        customer_details: {
          address: {
            line1: shippingAddress.line1,
            city: shippingAddress.city,
            // The form field is free text, so normalise to the two-letter code
            // Stripe expects. A malformed state means no tax, not a crash.
            state: String(shippingAddress.state ?? '').trim().toUpperCase(),
            postal_code: String(shippingAddress.zip ?? shippingAddress.postalCode ?? '').trim(),
            country: 'US',
          },
          address_source: 'shipping',
        },
      })
      taxCents = calc.tax_amount_exclusive
      taxCalculationId = calc.id
    } catch (taxErr: any) {
      console.error('[checkout] Stripe Tax failed, charging no tax:', taxErr?.message)
    }

    const total = subtotal + shippingCents + taxCents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      // Deliberately NOT setting receipt_email. Stripe sends its own receipt to
      // that address whenever it is present — regardless of the "Successful
      // payments" switch in the dashboard, which is why turning that off did not
      // stop the duplicate. We send our own confirmation from the webhook, which
      // itemises the order, shows the sales tax and links to order tracking, so
      // a second Stripe receipt is noise arriving moments later.
      //
      // The card statement still reads ARCHIVEYOURS and our own email says so,
      // which is what actually prevents "I don't recognise this charge" disputes.
      // The webhook needs the calculation id to record the tax transaction
      // once payment succeeds; carrying it on the intent keeps the two in step.
      metadata: { email, finish, shippingMethod, taxCalculationId: taxCalculationId ?? '' },
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
      unit_price_cents: getPricePerPrintCents(item.size, totalQty),
    }))

    const { error: dbError } = await supabase.from('orders').insert({
      id: orderId,
      email,
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
      total_cents: total,
      tax_cents: taxCents,
      tax_calculation_id: taxCalculationId,
      items: orderItems,
      shipping_address: shippingAddress,
    })
    if (dbError) throw dbError

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      breakdown: { subtotal, shipping: shippingCents, tax: taxCents, total },
    })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
