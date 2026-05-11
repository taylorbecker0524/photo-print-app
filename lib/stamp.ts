import Stripe from 'stripe'

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2023-10-16', typescript: true })
}

// Keep stripe as a getter to avoid top-level initialization
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'placeholder', {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const BULK_TIERS = [
  { minQty: 100, prices: { '4x6': 29, '5x7': 69, '8x10': 149, 'square-4': 35, 'square-5': 69, 'square-8': 129 } },
  { minQty: 50,  prices: { '4x6': 39, '5x7': 89, '8x10': 179, 'square-4': 49, 'square-5': 89, 'square-8': 159 } },
  { minQty: 20,  prices: { '4x6': 59, '5x7': 109, '8x10': 199, 'square-4': 69, 'square-5': 109, 'square-8': 179 } },
  { minQty: 10,  prices: { '4x6': 79, '5x7': 129, '8x10': 219, 'square-4': 89, 'square-5': 129, 'square-8': 199 } },
  { minQty: 1,   prices: { '4x6': 99, '5x7': 149, '8x10': 249, 'square-4': 109, 'square-5': 149, 'square-8': 229 } },
]

export function getPricePerPrint(size: string, totalQty: number): number {
  const tier = BULK_TIERS.find(t => totalQty >= t.minQty) ?? BULK_TIERS[BULK_TIERS.length - 1]
  return (tier.prices as any)[size] ?? 99
}

export const SHIPPING_PRICE_CENTS = 499

export function calculateOrderTotal(items: Array<{ size: string; quantity: number }>) {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + getPricePerPrint(item.size, totalQty) * item.quantity, 0)
  return { subtotal, shipping: SHIPPING_PRICE_CENTS, total: subtotal + SHIPPING_PRICE_CENTS, totalQty }
}
