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
 * Prodigi's Budget shipping is a flat rate per parcel — their price sheet
 * lists a "plus one shipping price" of $0.00, meaning extra prints add nothing.
 * One order equals one parcel equals one charge.
 */
export const PRODIGI_SHIPPING_COST_CENTS = 670

/**
 * Sales tax Prodigi charges us on the wholesale purchase. Derived from a real
 * order shipped to Tampa (7.5%). Prodigi taxes by destination, so orders to
 * other states will differ — treat this as an approximation until there are
 * enough real invoices to refine it.
 */
export const PRODIGI_TAX_RATE = 0.075

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
