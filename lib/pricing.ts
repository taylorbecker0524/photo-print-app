// Single source of truth for per-print pricing (US, in cents).
//
// Bulk tiers: the per-print price drops as the total cart quantity crosses
// 10 / 25 / 50 / 100 prints. Both the studio (what the customer sees while
// building an order) and the checkout API (what they're actually charged) import
// this, so the displayed price always equals the charged price.
/**
 * Smallest order we accept, in prints.
 *
 * Shipping is a flat cost per parcel and Stripe charges a fixed 30c per
 * transaction, so both are spread across however many prints are in the box.
 * Below this many prints those fixed costs exceed the margin on the prints
 * themselves and the order loses money no matter what we charge.
 *
 * Note on what this does and does not protect: an order containing an 8x10 or
 * an 8x8 ships in a second parcel, which costs another $6.70 regardless of how
 * many prints are in the order. A small print earns roughly 65c of margin, so
 * it takes about ten of them to pay for that extra parcel — no minimum we would
 * actually want to impose covers it. Those orders are a deliberate, bounded
 * loss of two to three dollars, accepted in exchange for one simple shipping
 * price. Everything else clears comfortably.
 */
export const MIN_ORDER_QTY = 5

/**
 * What the customer pays for shipping, in cents. One flat price, every order.
 *
 * Prodigi bills us per parcel (~$6.70). Most orders are a single parcel, so
 * this roughly breaks even; mixed orders containing a large size cost us a
 * second parcel and we absorb it. Quoting Prodigi live produced $13.40 on an
 * ordinary order with no explanation attached, which is worse for the business
 * than the few dollars this costs.
 */
export const SHIPPING_FLAT_CENTS = 695

export type PriceTier = { minQty: number; prices: Record<string, number> }

export const PRICE_TIERS: PriceTier[] = [
  { minQty: 100, prices: { '4x6': 59, '5x7': 119, '8x10': 349, 'square-4': 69, 'square-5': 119, 'square-8': 699 } },
  { minQty: 50,  prices: { '4x6': 69, '5x7': 139, '8x10': 349, 'square-4': 79, 'square-5': 139, 'square-8': 699 } },
  { minQty: 25,  prices: { '4x6': 79, '5x7': 159, '8x10': 399, 'square-4': 89, 'square-5': 159, 'square-8': 799 } },
  { minQty: 10,  prices: { '4x6': 89, '5x7': 179, '8x10': 449, 'square-4': 99, 'square-5': 179, 'square-8': 899 } },
  { minQty: 1,   prices: { '4x6': 99, '5x7': 199, '8x10': 499, 'square-4': 109, 'square-5': 199, 'square-8': 999 } },
]

/** Per-print price in cents for a size at a given total cart quantity. */
export function getPricePerPrintCents(size: string, totalQty: number): number {
  const tier = PRICE_TIERS.find(t => totalQty >= t.minQty) ?? PRICE_TIERS[PRICE_TIERS.length - 1]
  return tier.prices[size] ?? 99
}

/**
 * The next cheaper tier a customer can unlock and how many more prints are
 * needed to reach it. Returns null once they're already at the best tier.
 * Used to nudge shoppers toward the next bulk discount.
 */
export function getNextTier(totalQty: number): { minQty: number; needed: number } | null {
  const breakpoints = [10, 25, 50, 100]
  const next = breakpoints.find(b => totalQty < b)
  return next ? { minQty: next, needed: next - totalQty } : null
}

/**
 * Format a whole number of cents as a dollar string.
 *
 * Every amount on the site is carried as an integer number of cents and only
 * converted here, at the moment it is displayed. Dividing by 100 earlier and
 * adding the results as floating point is what made a ten-print order show
 * lines totalling $39.44 beside a total of $39.45: each line was rounded on its
 * own, the total was not. Integers cannot drift, so the lines always add up.
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
