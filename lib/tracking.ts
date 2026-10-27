/**
 * Pick the tracking URL a customer should actually be sent to.
 *
 * Prodigi hands us a tracking URL with each shipment and we store it as-is.
 * For parcels carried by Amazon Shipping that URL is an AfterShip link, and
 * AfterShip cannot resolve an Amazon tracking number: the customer lands on a
 * page advertising tracking software, with no sign of their parcel. It looks
 * like the order has vanished.
 *
 * Amazon's own tracker resolves the same number fine and needs no sign-in, so
 * for those numbers we build the link ourselves and ignore the supplied one.
 * Every other carrier keeps whatever Prodigi sent, because that is the carrier
 * that actually holds the parcel and Prodigi knows which one it is.
 *
 * Applied when the URL is read rather than when it is written, so orders
 * already in the database are fixed too, not just new ones.
 */

/** Amazon Shipping consignment ids: "TBA" followed by digits/letters. */
const AMAZON_TRACKING = /^TBA[0-9A-Z]+$/i

export function trackingUrlFor(
  trackingNumber?: string | null,
  suppliedUrl?: string | null
): string | null {
  const number = (trackingNumber ?? '').trim()
  if (AMAZON_TRACKING.test(number)) {
    return `https://track.amazon.com/tracking/${encodeURIComponent(number.toUpperCase())}`
  }
  const supplied = (suppliedUrl ?? '').trim()
  return supplied || null
}

/** True when we would override the carrier link Prodigi gave us. */
export function isAmazonTracking(trackingNumber?: string | null): boolean {
  return AMAZON_TRACKING.test((trackingNumber ?? '').trim())
}
