// What an order actually costs us, for bookkeeping and margin reporting.
//
// IMPORTANT: these are ESTIMATES used for reporting only. The authoritative
// numbers are the invoices Prodigi and Stripe actually charge. If Prodigi
// changes its price sheet, update this file — nothing reads these values at
// checkout, so a stale number here misreports profit but cannot mischarge a
// customer.
//
// Source: Prodigi published US price sheet, checked 6 August 2026.

/** Wholesale cost per print, in cents, by our internal size key. */
export const PRODIGI_UNIT_COST_CENTS: Record<string, number> = {
  '4x6': 25,
  'square-4': 25,
  '5x7': 50,
  'square-5': 50,
  '8x10': 200,
  'square-8': 400,
}

/**
 * Prodigi's Budget shipping is a flat rate PER PARCEL — extra prints inside a
 * parcel add nothing. The trap is the parcel count.
 *
 * This used to assume one order equals one parcel. The first real invoice
 * (order 14543270, 21 Sep 2026) disproved that: a 20-print order containing
 * 4x6s, a 5x5 and an 8x8 was billed $13.42 shipping — two parcels at $6.71,
 * not one. Prodigi prints the larger sizes on different equipment and ships
 * them separately, so an order that mixes small and large prints gets charged
 * twice. Assuming one parcel overstated that order's profit by $7.22.
 */
export const PRODIGI_SHIPPING_COST_CENTS = 671

/**
 * Sizes Prodigi ships as their own parcel, separate from the small prints.
 *
 * Inferred from a single invoice, so treat it as a best guess: it is right
 * that mixed small/large orders ship in two parcels, but the exact dividing
 * line will only be confirmed by more invoices. Erring towards more parcels is
 * the safer error — it understates profit rather than overstating it.
 */
const LARGE_FORMAT_SIZES = new Set(['8x10', 'square-8'])

/**
 * How many parcels Prodigi will split an order into, and so how many times the
 * flat shipping rate is charged.
 */
export function estimateParcelCount(
  items: Array<{ size?: string; quantity?: number }> | null | undefined
): number {
  if (!Array.isArray(items) || items.length === 0) return 0
  let small = false
  let large = false
  for (const item of items) {
    if ((Number(item?.quantity) || 0) <= 0) continue
    if (LARGE_FORMAT_SIZES.has(item?.size ?? '')) large = true
    else small = true
  }
  const parcels = (small ? 1 : 0) + (large ? 1 : 0)
  // Every order that reaches Prodigi ships at least once, even if the size key
  // is one this file has never seen.
  return parcels || 1
}

/** Estimated Prodigi shipping for a set of order items. */
export function estimateShippingCostCents(
  items: Array<{ size?: string; quantity?: number }> | null | undefined
): number {
  return estimateParcelCount(items) * PRODIGI_SHIPPING_COST_CENTS
}

/**
 * Sales tax Prodigi charges us on the wholesale purchase. Derived from a real
 * order shipped to Tampa (7.5%). Prodigi taxes by destination, so orders to
 * other states will differ — treat this as an approximation until there are
 * enough real invoices to refine it.
 */
export const PRODIGI_TAX_RATE = 0.075

/**
 * Where Prodigi has accepted a resale certificate, and the day they accepted.
 *
 * Prodigi stops charging us sales tax on the wholesale cost once a certificate
 * is on file — but they tax by the DESTINATION of each parcel, and a
 * certificate is filed per state. Florida was accepted on 29 September 2026
 * (the Avalara confirmation). Whether that one certificate also covers parcels
 * sent to other states is an open question with Prodigi; until they answer,
 * every other destination keeps paying the estimate, which is the safe
 * direction to be wrong in — it understates profit rather than overstating it.
 *
 * Dates are ISO day strings and compare correctly as plain strings.
 */
export const PRODIGI_RESALE_CERTIFICATES: Record<string, string> = {
  FL: '2026-09-29',
}

/**
 * The Prodigi tax rate that applied to one order.
 *
 * Deliberately a function of the order's own date rather than a constant that
 * gets switched off. Orders placed before the certificate landed really did
 * pay the 7.5%, and flipping a global to zero would quietly rewrite the
 * September books to say otherwise.
 */
export function prodigiTaxRateFor(
  shipState: string | null | undefined,
  orderDate: string | Date | null | undefined
): number {
  const from = PRODIGI_RESALE_CERTIFICATES[String(shipState ?? '').trim().toUpperCase()]
  if (!from || !orderDate) return PRODIGI_TAX_RATE
  const day = orderDate instanceof Date
    ? orderDate.toISOString().slice(0, 10)
    : String(orderDate).slice(0, 10)
  return day >= from ? 0 : PRODIGI_TAX_RATE
}

/**
 * States where we are registered to collect sales tax.
 *
 * This is the list that decides whether Stripe Tax bills us, so it has to stay
 * in step with the real registrations: add a state here the day its
 * registration goes live, or the margin reporting quietly drifts again.
 */
export const SALES_TAX_REGISTRATIONS = ['FL']

/**
 * Stripe Tax, per order. The site calls the Tax API rather than using Stripe's
 * no-code Checkout, which is billed per transaction instead of as a percentage.
 *
 * Charged only "if an active tax registration covers the customer
 * jurisdiction", so an out-of-state order costs nothing. That exemption is the
 * reason this is a function of the destination and not a flat line on every
 * order.
 */
export const STRIPE_TAX_FEE_CENTS = 50

export function estimateStripeTaxFeeCents(shipState: string | null | undefined): number {
  const st = String(shipState ?? '').trim().toUpperCase()
  return SALES_TAX_REGISTRATIONS.includes(st) ? STRIPE_TAX_FEE_CENTS : 0
}

/** Stripe's standard US card rate: 2.9% + 30c per successful charge. */
export const STRIPE_PERCENT = 0.029
export const STRIPE_FIXED_CENTS = 30

/** Estimated Prodigi product cost for a set of order items. */
export function estimateProductCostCents(
  items: Array<{ size?: string; quantity?: number }> | null | undefined
): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => {
    const unit = PRODIGI_UNIT_COST_CENTS[item?.size ?? ''] ?? 0
    return sum + unit * (Number(item?.quantity) || 0)
  }, 0)
}

/** Stripe's fee on a given charged amount. */
export function estimateStripeFeeCents(chargedCents: number): number {
  if (chargedCents <= 0) return 0
  return Math.round(chargedCents * STRIPE_PERCENT) + STRIPE_FIXED_CENTS
}
