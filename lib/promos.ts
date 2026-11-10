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

/**
 * Per-creator gift codes.
 *
 * One code per person, one redemption each — which is the point. A single
 * shared code with a ceiling would save a deploy and cost you everything that
 * matters: you could not tell who redeemed, could not revoke one creator
 * without revoking all of them, and would be one screenshot away from
 * strangers taking free prints.
 *
 * Adding a creator is one line here: put their real Instagram handle in
 * `handle` and the code is derived from it by codeStemFor() below.
 * Everything else comes from GIFT_TERMS below unless you override it.
 */
export type CreatorGift = {
  /** The creator's real Instagram handle, exactly as they spell it. */
  handle: string
  /** Who it went to, for your own records. Never shown to customers. */
  issuedTo: string
  /** ISO date the code stops working. */
  expiresAt: string
  /** Set false to revoke this one creator without touching the others. */
  active?: boolean
  /** Override the standard offer for one creator if you ever need to. */
  freeQty?: number
  freeSize?: string
  freeShipping?: boolean
}

/** The standard influencer offer. Change it here and every gift code follows. */
const GIFT_TERMS = {
  freeQty: 25,
  freeSize: '4x6',
  freeShipping: true,
} as const

/**
 * Turn an Instagram handle into the suffix of its code.
 *
 * Uppercase, drop anything that is not a letter or digit, and cut to twelve
 * characters. The rule is not arbitrary: the codes in the outreach sheet were
 * generated this way before this module existed, and those are the strings
 * that go out in the DMs. If this function and that column ever disagree, a
 * creator types the code off the message and the site tells her it is not a
 * code — so the rule lives here, in one place, rather than being retyped per
 * line and quietly drifting.
 *
 * Twelve characters is also why a long handle loses its tail:
 * melissawoodtepperberg becomes MELISSAWOODT. Collisions between two shortened
 * handles are caught at module load by the duplicate check at the bottom of
 * this file, which throws rather than letting two creators share one code.
 */
export function codeStemFor(handle: string): string {
  return handle.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

/**
 * How long a gift code lives.
 *
 * Long enough that a creator who is busy for a month has not missed it, short
 * enough that an unredeemed code does not sit open for ever. Change this one
 * line and every code below follows.
 */
const GIFT_EXPIRES = '2027-02-28'

export const CREATOR_GIFTS: CreatorGift[] = [
  // Campaign 1 — the fifteen ticked in the outreach sheet. Follower counts are
  // noted so a redemption can be read against the size of the account it came
  // from. One line per creator; remove a line or set active:false to revoke.
  { handle: 'devwindsor',            issuedTo: '@devwindsor — devon windsor (5M)',                 expiresAt: GIFT_EXPIRES },
  { handle: 'alexandracooper',       issuedTo: '@alexandracooper — Alex Cooper (8M)',              expiresAt: GIFT_EXPIRES },
  { handle: 'bridget',               issuedTo: '@bridget (2M)',                                    expiresAt: GIFT_EXPIRES },
  { handle: 'melissawoodtepperberg', issuedTo: '@melissawoodtepperberg — Melissa Wood-Tepperberg (1M)', expiresAt: GIFT_EXPIRES },
  { handle: 'madisonlecroy',         issuedTo: '@madisonlecroy — Madison LeCroy (1M)',             expiresAt: GIFT_EXPIRES },
  { handle: 'hayderz',               issuedTo: '@hayderz — Hayden Cohen (628K)',                   expiresAt: GIFT_EXPIRES },
  { handle: 'probablyshannon',       issuedTo: '@probablyshannon — Shannon Ford Middleton (499K)', expiresAt: GIFT_EXPIRES },
  { handle: 'katieaustin',           issuedTo: '@katieaustin — Katie Austin (482K)',               expiresAt: GIFT_EXPIRES },
  { handle: 'vivianeaudi',           issuedTo: '@vivianeaudi — Viviane Audi (471K)',               expiresAt: GIFT_EXPIRES },
  { handle: 'gracie_norton',         issuedTo: '@gracie_norton — Gracie Norton (399K)',            expiresAt: GIFT_EXPIRES },
  { handle: 'shutthekaleup',         issuedTo: '@shutthekaleup — Jeannette Aranda (367K)',         expiresAt: GIFT_EXPIRES },
  { handle: 'itsdanimarenburg',      issuedTo: '@itsdanimarenburg — Dani Marenburg (200K)',        expiresAt: GIFT_EXPIRES },
  { handle: 'wellllaaa',             issuedTo: '@wellllaaa — Manuela Alvarez Hernandez (88K)',     expiresAt: GIFT_EXPIRES },
  { handle: 'alikittykatz',          issuedTo: '@alikittykatz — Ali Katz (70K)',                   expiresAt: GIFT_EXPIRES },
  { handle: 'its_allyjoy',           issuedTo: '@its_allyjoy — Ally Joy General (57K)',            expiresAt: GIFT_EXPIRES },

  // Added after campaign 1 went out, so she is not one of the fifteen ticked
  // in the sheet. Same terms; the code comes off her handle like the rest.
  { handle: 'veeshoney',             issuedTo: '@veeshoney — Vanessa Fitzgerald (77.2K)',          expiresAt: GIFT_EXPIRES },

  // The original ARCHIVE-GIFT placeholder used to sit here. It was spent on the
  // test order and is gone now, so a stranger guessing the obvious word gets
  // nothing. That order keeps its own promo_code string in the database; this
  // list is only consulted when a code is being redeemed, never to read one back.
]

function giftToPromo(g: CreatorGift): Promo {
  const freeQty = g.freeQty ?? GIFT_TERMS.freeQty
  const freeSize = g.freeSize ?? GIFT_TERMS.freeSize
  const freeShipping = g.freeShipping ?? GIFT_TERMS.freeShipping
  return {
    code: `ARCHIVE-${codeStemFor(g.handle)}`,
    kind: 'gift',
    issuedTo: g.issuedTo,
    label: `${freeQty} free prints${freeShipping ? ' + free shipping' : ''}`,
    freeQty,
    freeSize,
    freeShipping,
    // A creator may well have ordered from us already; gifting them anyway is
    // the whole point, so this never applies to gift codes.
    newCustomersOnly: false,
    // One person, once. This is what makes a gift code a gift code.
    maxRedemptions: 1,
    expiresAt: g.expiresAt,
    active: g.active ?? true,
  }
}

/**
 * Codes that are not per-creator gifts.
 *
 * An 'audience' code is shared, so maxRedemptions is doing real work here: it
 * is the only thing standing between you and an open tab if the code escapes.
 */
const STANDALONE_PROMOS: Promo[] = [
  {
    // A personal gift, not a campaign code. It sits here rather than in
    // CREATOR_GIFTS because that list is campaign 1 — the fifteen ticked in the
    // outreach sheet — and a one-off should not quietly become a sixteenth
    // creator in any count taken off that array. Same terms as a creator gift,
    // and the same single redemption, so it cannot be passed around.
    code: 'ARCHIVE-DENYSE',
    kind: 'gift',
    issuedTo: 'Denyse — personal gift',
    label: '25 free prints + free shipping',
    freeQty: 25,
    freeSize: '4x6',
    freeShipping: true,
    // She may have ordered already; gifting her anyway is the point.
    newCustomersOnly: false,
    maxRedemptions: 1,
    expiresAt: GIFT_EXPIRES,
    active: true,
  },
  {
    // A disposable code for testing checkout end to end.
    //
    // Deliberately small and deliberately NOT free shipping, for two reasons.
    // An order using it still has a real balance left, so it exercises the
    // Stripe payment path — which a fully free order skips entirely, since
    // Stripe refuses a zero-amount intent. And if it ever leaked, the worst
    // case is ten people getting two 4x6 prints each, about $5 in total.
    code: 'ARCHIVE-TEST',
    kind: 'audience',
    issuedTo: 'internal testing',
    label: '2 free prints (test code)',
    freeQty: 2,
    freeSize: '4x6',
    freeShipping: false,
    newCustomersOnly: false,
    maxRedemptions: 10,
    expiresAt: '2026-12-31',
    active: true,
  },
]

export const PROMOS: Promo[] = [
  ...CREATOR_GIFTS.map(giftToPromo),
  ...STANDALONE_PROMOS,
]

// A duplicated code would mean findPromo silently picks the first match and the
// second creator's code quietly shares the first one's redemption count. Cheap
// to check once at module load; impossible to debug from a support email.
const seenCodes = new Set<string>()
for (const p of PROMOS) {
  const key = normalizeCode(p.code)
  if (seenCodes.has(key)) {
    throw new Error(
      `Duplicate promo code "${key}" in lib/promos.ts — codes must be unique.`
    )
  }
  seenCodes.add(key)
}

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
