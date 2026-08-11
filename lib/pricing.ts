// Single source of truth for per-print pricing (US, in cents).
//
// Bulk tiers: the per-print price drops as the total cart quantity crosses
// 10 / 25 / 50 / 100 prints. Both the studio (what the customer sees while
// building an order) and the checkout API (what they're actually charged) import
// this, so the displayed price always equals the charged price.
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
