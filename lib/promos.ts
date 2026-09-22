// Promotion codes, for influencer campaigns.
//
// Codes live here in code rather than in a table on purpose: there are a
// handful of them, they change when a campaign starts, and a deploy is a
// perfectly good way to add one. A database table would mean building an admin
// screen to edit it, which is a lot of machinery for six lines of config.
//
// The offer is deliberately NOT a percentage. Prints cost us ~25c and sell for
// ~89c, so giving prints away is cheap; shipping costs us $6.71 a parcel and is
// the single most expensive line in an order. A percentage discount takes money
// off the profitable part and leaves the expensive part untouched.

export type Promo = {
  /** Entered by the customer. Compared case-insensitively. */
  code: string
  /** Shown on the checkout summary line when applied. */
  label: string
  /** How many prints of `freeSize` are free. */
  freeQty: number
  /** Which size the free prints apply to. */
  freeSize: string
  /** Whether shipping is waived too. */
  freeShipping: boolean
  /**
   * Blocks the code for an email that already has a completed order. Stops a
   * discount landing on repeat customers who would have ordered anyway.
   */
  newCustomersOnly: boolean
  /** One redemption per email address. */
  oncePerCustomer: boolean
  /**
   * Hard ceiling on total redemptions, or null for no ceiling.
   *
   * Left null deliberately — see ALERT_AFTER_REDEMPTIONS below. Each redemption
   * of a free-prints-and-free-shipping code costs roughly $9.90, so a code that
   * escapes to a deals site is an open tab. Set a number here to cap it.
   */
  maxRedemptions: number | null
  /** ISO date after which the code stops working, or null for no expiry. */
  expiresAt: string | null
  active: boolean
}

/**
 * Email an alert once a code passes this many redemptions.
 *
 * The codes below have no hard cap, so this is the thing that makes a runaway
 * visible while it is still small. $9.90 a redemption means 100 redemptions is
 * about $990 — worth knowing about the same day, not at the end of the month.
 */
export const ALERT_AFTER_REDEMPTIONS = 100

export const PROMOS: Promo[] = [
  {
    code: 'WELCOME10',
    label: '10 free prints + free shipping',
    freeQty: 10,
    freeSize: '4x6',
    freeShipping: true,
    newCustomersOnly: true,
    oncePerCustomer: true,
    maxRedemptions: null,
    expiresAt: null,
    active: true,
  },
]

export function findPromo(code: string | null | undefined): Promo | null {
  if (!code) return null
  const wanted = String(code).trim().toUpperCase()
  if (!wanted) return null
  const promo = PROMOS.find(p => p.code.toUpperCase() === wanted)
  if (!promo || !promo.active) return null
  if (promo.expiresAt && Date.now() > Date.parse(promo.expiresAt)) return null
  return promo
}

export type CartItem = {
  size: string
  quantity: number
  unit_price_cents: number
  [key: string]: unknown
}

/**
 * Split a cart so that up to `promo.freeQty` prints of the promoted size are
 * carried as their own zero-priced line items.
 *
 * Splitting rather than discounting the total matters in three places: Prodigi
 * still receives the full print count (the customer gets the prints, they are
 * simply not charged for them), the receipt can show a "FREE" line instead of a
 * mystery deduction, and sales tax is calculated on what was actually charged
 * rather than on a pre-discount figure we never billed.
 *
 * Returns the rewritten items and the value given away, in cents.
 */
export function applyFreePrints(
  promo: Promo,
  items: CartItem[]
): { items: CartItem[]; freedCents: number; freedQty: number } {
  let remaining = promo.freeQty
  let freedCents = 0
  let freedQty = 0
  const out: CartItem[] = []

  for (const item of items) {
    const qty = Number(item.quantity) || 0
    if (remaining <= 0 || item.size !== promo.freeSize || qty <= 0) {
      out.push(item)
      continue
    }
    const free = Math.min(remaining, qty)
    const paid = qty - free
    remaining -= free
    freedQty += free
    freedCents += free * (Number(item.unit_price_cents) || 0)

    // Keep the paid remainder of a partially-covered line, then add the free
    // portion as its own line. An item covered in full produces only the free
    // line, never a zero-quantity one, which Prodigi would reject.
    if (paid > 0) out.push({ ...item, quantity: paid })
    out.push({ ...item, quantity: free, unit_price_cents: 0, promo_free: true })
  }

  return { items: out, freedCents, freedQty }
}

/** What a promo is worth on a given cart, for display before it is applied. */
export function describePromo(promo: Promo): string {
  const bits = [`${promo.freeQty} free ${promo.freeSize} prints`]
  if (promo.freeShipping) bits.push('free shipping')
  return bits.join(' + ')
}
