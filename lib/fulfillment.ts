// Turning a paid order into a print order at Prodigi.
//
// This used to live inside the Stripe webhook, which was fine while every order
// arrived through Stripe. Promotional orders that come to $0.00 cannot: Stripe
// rejects a zero-amount payment, so there is no charge and therefore no webhook.
// Rather than write a second, subtly different copy of fulfillment for those,
// both paths call this.
//
// Everything here is deliberately defensive. An order reaching this point has
// already been paid for (or deliberately given away), so the customer is owed
// their prints either way — a failure must be recorded and shouted about, never
// swallowed.

type FulfillArgs = {
  /** The order row, already fetched. */
  order: any
  /**
   * Shipping method to order from Prodigi. Must match what the customer was
   * charged for, so we never bill Budget and then order Overnight. Validated
   * below rather than trusted: it arrives from PaymentIntent metadata, which is
   * free-form text.
   */
  shippingMethod: string
  /**
   * How this order was paid, for the admin alert if fulfillment fails. A Stripe
   * payment intent id, or a note for a free promotional order.
   */
  paymentRef: string
}

export type FulfillResult =
  | { status: 'fulfilled'; prodigiOrderId: string }
  | { status: 'already_processed' }
  | { status: 'failed'; error: string }

/**
 * Coerce a shipping method from metadata into one Prodigi accepts.
 *
 * Budget is the fallback because it is what the flat $6.95 shipping price is
 * based on. Guessing high here would mean paying for Express on an order that
 * only paid for Budget.
 */
const PRODIGI_METHODS = ['Budget', 'Standard', 'StandardPlus', 'Express', 'Overnight'] as const
type KnownMethod = (typeof PRODIGI_METHODS)[number]
function toProdigiMethod(value: string | null | undefined): KnownMethod {
  const found = PRODIGI_METHODS.find(m => m.toLowerCase() === String(value ?? '').trim().toLowerCase())
  return found ?? 'Budget'
}

export async function fulfillPaidOrder({
  order,
  shippingMethod,
  paymentRef,
}: FulfillArgs): Promise<FulfillResult> {
  const { createServerSupabase } = await import('@/lib/supabase')
  const { createProdigiOrder, getSku } = await import('@/lib/prodigi')
  const { sendOrderConfirmation, sendAdminAlert } = await import('@/lib/email')
  const { stripe } = await import('@/lib/stripe')

  const supabase = createServerSupabase()

  // Idempotency guard.
  //
  // This keys on prodigi_order_id, NOT on status === 'paid'. An order is marked
  // 'paid' BEFORE fulfillment is attempted, so if the function dies in between
  // (timeout, cold start, crash) the catch block never runs and nothing is
  // recorded. Treating 'paid' as "already processed" then makes every Stripe
  // retry skip fulfillment permanently: the order is stuck forever with no
  // error, no alert and no print. An order sitting at 'paid' with no Prodigi id
  // is one whose fulfillment never finished, and it must be retried.
  if (order.prodigi_order_id || order.status === 'processing' || order.status === 'shipped') {
    console.log('[fulfillment] order already fulfilled, skipping', order.id, order.status)
    return { status: 'already_processed' }
  }

  // Record the sales tax collected on this order so it appears in Stripe's tax
  // reporting when the Florida return is due. Deliberately before fulfillment:
  // the customer has paid and the tax is already owed, so a printing failure
  // downstream must not lose the tax record.
  //
  // Never fails fulfillment. The amount is stored on the order either way, so
  // the worst case is a report that needs reconciling by hand — not a lost
  // order or a retry storm. A free order has no calculation and skips this.
  if (order.tax_calculation_id) {
    try {
      await stripe.tax.transactions.createFromCalculation({
        calculation: order.tax_calculation_id,
        reference: order.id,
      })
    } catch (taxErr: any) {
      console.error('[fulfillment] tax transaction failed', order.id, taxErr?.message)
    }
  }

  // Leave a breadcrumb before starting. If this function is killed mid-flight the
  // catch block cannot run, so this note is the only trace a timeout will leave.
  // It is cleared on success and replaced by the real message on a caught error.
  await supabase
    .from('orders')
    .update({
      status: 'paid',
      fulfillment_error: `Fulfillment attempt started ${new Date().toISOString()} and did not complete. If this is the latest state, the attempt was killed before it could report an error.`,
    })
    .eq('id', order.id)

  // Send the customer's receipt as soon as payment is confirmed — independent of
  // fulfillment. A Prodigi failure must NOT prevent the confirmation email, and
  // an email failure must NOT flip the order to fulfillment_failed. Each concern
  // gets its own try/catch (fulfillment is handled below).
  try {
    const itemsSubtotal = Array.isArray(order.items)
      ? order.items.reduce(
          (sum: number, i: any) => sum + (Number(i.unit_price_cents) || 0) * (Number(i.quantity) || 0),
          0
        )
      : 0
    await sendOrderConfirmation({
      email: order.email,
      orderId: order.id,
      items: order.items,
      totalCents: order.total_cents,
      // Pass these rather than letting the email infer them. It used to derive
      // shipping as "total minus items", which silently folded the sales tax
      // into the postage line once we started collecting tax.
      taxCents: Number(order.tax_cents) || 0,
      shippingCents: Math.max(
        0,
        Number(order.total_cents) - itemsSubtotal - (Number(order.tax_cents) || 0)
      ),
    })
  } catch (emailErr) {
    console.error('[fulfillment] confirmation email failed for order', order.id, emailErr)
  }

  try {
    const prodigiItems = await Promise.all(
      order.items.map(async (item: any, idx: number) => {
        const { data: signed, error: urlErr } = await supabase.storage
          .from('print-photos')
          .createSignedUrl(item.photo_path, 60 * 60 * 24)
        if (urlErr || !signed?.signedUrl) {
          throw new Error(`Failed to sign URL for ${item.photo_path}: ${urlErr?.message ?? 'no URL returned'}`)
        }
        // Prodigi requires a finish attribute for photo SKUs. Default to
        // 'lustre' if somehow missing (older orders pre-feature).
        const finish = item.finish ?? 'lustre'
        return {
          merchantReference: `${order.id}-item-${idx}`,
          sku: getSku(item.size),
          copies: item.quantity,
          sizing: 'fillPrintArea' as const,
          attributes: { finish },
          assets: [{ printArea: 'default' as const, url: signed.signedUrl }],
        }
      })
    )

    const addr = order.shipping_address
    // Only trust NEXT_PUBLIC_APP_URL if it's a real http(s) URL. A mis-set value
    // (e.g. an email address) must NOT produce an invalid callbackUrl and block
    // fulfillment of an already-paid order — fall back to the canonical domain.
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
    const appUrl =
      rawAppUrl && /^https?:\/\//.test(rawAppUrl) ? rawAppUrl : 'https://www.archiveyours.com'
    const callbackToken = process.env.PRODIGI_CALLBACK_TOKEN
    const prodigiResult = await createProdigiOrder({
      merchantReference: order.id,
      shippingMethod: toProdigiMethod(shippingMethod),
      // Prodigi POSTs order status + tracking updates to this URL as the order
      // progresses (dispatch, tracking number). Handled by /api/webhook/prodigi.
      callbackUrl: `${appUrl}/api/webhook/prodigi${callbackToken ? `?token=${encodeURIComponent(callbackToken)}` : ''}`,
      recipient: {
        name: addr.name,
        // Route Prodigi's own order/shipping notifications to OUR inbox, not the
        // customer's — otherwise customers get confusing Prodigi-branded emails
        // ("Order received", "Hannah at Prodigi"). The print still ships to the
        // customer (recipient.address below); only the notification contact
        // changes. Override the destination with PRODIGI_CONTACT_EMAIL if needed.
        email: process.env.PRODIGI_CONTACT_EMAIL ?? process.env.ADMIN_EMAIL ?? 'orders@archiveyours.com',
        address: {
          line1: addr.line1,
          // Prodigi rejects optional fields that are present but empty
          // ("MustNotBeEmptyOrWhitespace"), so only include line2 / stateOrCounty
          // when the customer actually entered a value. Blank apartment/suite
          // lines are common and must be omitted entirely, not sent as "".
          ...(addr.line2 && String(addr.line2).trim() ? { line2: addr.line2 } : {}),
          postalOrZipCode: addr.zip,
          countryCode: addr.country,
          townOrCity: addr.city,
          ...(addr.state && String(addr.state).trim() ? { stateOrCounty: addr.state } : {}),
        },
      },
      items: prodigiItems,
    })

    await supabase
      .from('orders')
      .update({
        status: 'processing',
        prodigi_order_id: prodigiResult.order.id,
        fulfillment_error: null,
      })
      .eq('id', order.id)

    return { status: 'fulfilled', prodigiOrderId: prodigiResult.order.id }
  } catch (err: any) {
    const errorMessage = err?.message ?? 'Unknown Prodigi/fulfillment error'
    console.error('[fulfillment] failed for order', order.id, err)

    await supabase
      .from('orders')
      .update({
        status: 'fulfillment_failed',
        fulfillment_error: errorMessage.slice(0, 2000),
      })
      .eq('id', order.id)

    sendAdminAlert({
      subject: `[archive] Fulfillment failed for order ${order.id}`,
      body: `
Order ID: ${order.id}
Customer email: ${order.email}
Payment: ${paymentRef}
Amount: $${(Number(order.total_cents) / 100).toFixed(2)}${order.promo_code ? `\nPromo code: ${order.promo_code}` : ''}

Error:
${errorMessage}

The order was accepted but the print order was not created.
Manual action required: investigate the error above, then either retry
fulfillment or refund via the Stripe dashboard.
      `.trim(),
    }).catch(e => console.error('[fulfillment] admin alert failed', e))

    return { status: 'failed', error: errorMessage }
  }
}
