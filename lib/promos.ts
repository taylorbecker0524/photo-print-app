// Promotion codes.
//
// Codes live here in code rather than in a table on purpose: there are a
// handful of them, they change when a campaign starts, and a deploy is a
// perfectly good way to add one. A database table would mean building an admin
// screen to edit it, which is a lot of machinery for six lines of config.
//
// Two kinds of code are supported, and the difference matters:
//
//   'gift'     One influencer, one redemption. This is how we hand a creator
//              their free prints. We cannot simply post them a sample the way
//              a normal brand would, because the product is made from THEIR
//              photos — they have to come through the studio and upload. A
//              single-use code is the clean way to let them do that for free.
//
//   'audience' Shared with a creator's followers. Many redemptions, so it
//              needs a ceiling: every redemption of a free-prints code costs
//              real money, and a code that escapes to a deals site is an open
//              tab. `maxRedemptions` is not optional on these.
//
// The offer is deliberately NOT a percentage. Prints cost us ~25c and sell for
// ~89c, so giving prints away is cheap; shipping costs us $6.71 a parcel and is
// the single most expensive line in an order. A percentage discount takes money
// off the profitable part and leaves the expensive part untouched.

export type PromoKind = 'gift' | 'audience'

export type Promo = {
  /** Entered by the customer. Compared case-insensitively. */
  code: string
  kind: PromoKind
  /** Who this was issued to, for your own records. Never shown to customers. */
  issuedTo: string
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
   * discount landing on a repeat customer who would have ordered anyway.
   */
  newCustomersOnly: boolean
  /**
   * Hard ceiling on total redemptions across everyone.
   *
   * A 'gift' code is 1 by definition — it is for one person, once. An
   * 'audience' code must set a real number: at roughly $9.90 of cost per
   * redemption, 200 redemptions is about $1,980, which is a decision you want
   * to make on purpose rather than discover on an invoice.
   */
  maxRedemptions: number
  /** ISO date after which the code stops working. */
  expiresAt: string
  active: boolean
}

/**
 * Warn by email once a code passes this share of its ceiling.
 *
 * A cap stops the bleeding but says nothing until it is hit. This is the thing
 * that says "your code is working, and it is costing you" while there is still
 * room to decide what to do about it.
 */
export const ALERT_AT_FRACTION = 0.5

export const PROMOS: Promo[] = [
  // Template for an influencer gift. Copy this block per creator, change the
  // code, issuedTo and expiresAt, and deploy. Cost to us: about $13.93 for 25
  // prints and a parcel.
  {
    code: 'ARCHIVE-GIFT',
    kind: 'gift',
    issuedTo: 'sample gift code — replace per creator',
    label: '25 free prints + free shipping',
    freeQty: 25,
    freeSize: '4x6',
    freeShipping: true,
    // A creator may well already have ordered from us; gifting them anyway is
    // the point, so this does not apply to gift codes.
    newCustomersOnly: false,
    maxRedemptions: 1,
    expiresAt: '2026-11-21',
    active: true,
  },
]

export type PromoRejection =
  | 'unknown'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'existing_customer'

export const REJECTION_MESSAGES: Record<PromoRejection, string> = {
  unknown: "That code isn't recognised. Check the spelling and try again.",
  inactive: 'That code is no longer active.',
  expired: 'That code has expired.',
  exhausted: 'That code has already been used.',
  existing_customer: 'That code is for first orders only.',
}

/** Look up a code without checking redemption counts (which need the database). */
export function findPromo(code: string | null | undefined): Promo | null {
  if (!code) return null
  const wanted = normalizeCode(code)
  if (!wanted) return null
  return PROMOS.find(p => normalizeCode(p.code) === wanted) ?? null
}

/** Codes are matched case- and whitespace-insensitively. */
export function normalizeCode(code: string): string {
  return String(code).trim().toUpperCase()
}

/** Checks that need no database: existence, active flag, expiry. */
export function checkPromoStatic(promo: Promo | null): PromoRejection | null {
  if (!promo) return 'unknown'
  if (!promo.active) return 'inactive'
  if (Date.now() > Date.parse(promo.expiresAt)) return 'expired'
  return null
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
 * Splitting rather than deducting a lump sum from the total matters in three
 * places: Prodigi still receives the full print count (the customer gets the
 * prints, they are simply not charged for them), the receipt can show a "FREE"
 * line instead of a mystery deduction, and sales tax is calculated on what was
 * actually charged rather than on a pre-discount figure we never billed.
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

    // Keep the paid remainder of a partially covered line, then add the free
    // portion as its own line. A line covered in full produces only the free
    // line, never a zero-quantity one, which Prodigi would reject.
    if (paid > 0) out.push({ ...item, quantity: paid })
    out.push({ ...item, quantity: free, unit_price_cents: 0, promo_free: true })
  }

  return { items: out, freedCents, freedQty }
}

/** Human-readable summary of what a code gives, for the checkout line. */
export function describePromo(promo: Promo): string {
  const bits = [`${promo.freeQty} free ${promo.freeSize} prints`]
  if (promo.freeShipping) bits.push('free shipping')
  return bits.join(' + ')
}
