import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// ── Bulk pricing tiers ────────────────────────────────────────────────────
// Price per print (in cents) drops as total quantity in cart increases.
// Applies across ALL photos in the cart combined.

export type BulkTier = {
  minQty: number
  label: string
  // Per-size price in cents at this tier
  prices: Record<string, number>
}

export const BULK_TIERS: BulkTier[] = [
  {
    minQty: 1,
    label: '1–9 prints',
    prices: {
      '4x6': 99, '5x7': 149, '8x10': 249,
      'square-4': 109, 'square-5': 149, 'square-8': 229,
    },
  },
  {
    minQty: 10,
    label: '10–19 prints',
    prices: {
      '4x6': 79, '5x7': 129, '8x10': 219,
      'square-4': 89, 'square-5': 129, 'square-8': 199,
    },
  },
  {
    minQty: 20,
    label: '20–49 prints',
    prices: {
      '4x6': 59, '5x7': 109, '8x10': 199,
      'square-4': 69, 'square-5': 109, 'square-8': 179,
    },
  },
  {
    minQty: 50,
    label: '50–99 prints',
    prices: {
      '4x6': 39, '5x7': 89, '8x10': 179,
      'square-4': 49, 'square-5': 89, 'square-8': 159,
    },
  },
  {
    minQty: 100,
    label: '100+ prints',
    prices: {
      '4x6': 29, '5x7': 69, '8x10': 149,
      'square-4': 35, 'square-5': 69, 'square-8': 129,
    },
  },
]

/** Returns the active bulk tier based on total print quantity across all cart items */
export function getActiveTier(totalQty: number): BulkTier {
  const tier = [...BULK_TIERS].reverse().find(t => totalQty >= t.minQty)
  return tier ?? BULK_TIERS[0]
}

/** Returns the next tier the customer can unlock (for upsell messaging) */
export function getNextTier(totalQty: number): BulkTier | null {
  return BULK_TIERS.find(t => t.minQty > totalQty) ?? null
}

/** Price in cents for a given size at a given total quantity */
export function getPricePerPrint(size: string, totalQty: number): number {
  const tier = getActiveTier(totalQty)
  return tier.prices[size] ?? tier.prices['4x6']
}

export const SHIPPING_PRICE_CENTS = 499  // $4.99 flat — consider free over $25

export function calculateOrderTotal(items: Array<{ size: string; quantity: number }>) {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => {
    const unitPrice = getPricePerPrint(item.size, totalQty)
    return sum + unitPrice * item.quantity
  }, 0)
  return {
    subtotal,
    shipping: SHIPPING_PRICE_CENTS,
    total: subtotal + SHIPPING_PRICE_CENTS,
    totalQty,
    activeTier: getActiveTier(totalQty),
    nextTier: getNextTier(totalQty),
  }
}
