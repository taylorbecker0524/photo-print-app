// Single source of truth for per-print pricing (US, in cents).
//
// Bulk tiers: the per-print price drops as the total cart quantity crosses
// 10 / 20 / 50 / 100 prints. Both the studio (what the customer sees while
// building an order) and the checkout API (what they're actually charged) import
// this, so the displayed price always equals the charged price.
export type PriceTier = { minQty: number; prices: Record<string, number> }

export const PRICE_TIERS: PriceTier[] = [
  { minQty: 100, prices: { '4x6': 29, '5x7': 69, '8x10': 149, 'square-4': 35, 'square-5': 69, 'square-8': 129 } },
  { minQty: 50,  prices: { '4x6': 39, '5x7': 89, '8x10': 179, 'square-4': 49, 'square-5': 89, 'square-8': 159 } },
  { minQty: 20,  prices: { '4x6': 59, '5x7': 109, '8x10': 199, 'square-4': 69, 'square-5': 109, 'square-8': 179 } },
  { minQty: 10,  prices: { '4x6': 79, '5x7': 129, '8x10': 219, 'square-4': 89, 'square-5': 129, 'square-8': 199 } },
  { minQty: 1,   prices: { '4x6': 99, '5x7': 149, '8x10': 249, 'square-4': 109, 'square-5': 149, 'square-8': 229 } },
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
  const breakpoints = [10, 20, 50, 100]
  const next = breakpoints.find(b => totalQty < b)
  return next ? { minQty: next, needed: next - totalQty } : null
}
