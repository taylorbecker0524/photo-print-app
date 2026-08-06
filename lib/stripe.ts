import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// NOTE: bulk pricing used to be duplicated here as well. It now lives in exactly
// one place — lib/pricing.ts — which the studio, the checkout page and the
// checkout API all import, so the displayed price can never drift from the
// charged price. Shipping is quoted live from Prodigi (/api/shipping-quote)
// rather than being a flat constant.
