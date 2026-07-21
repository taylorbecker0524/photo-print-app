import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Reverse-geocoding proxy for OpenStreetMap's Nominatim.
//
// Why this exists (was called directly from the browser before):
//   1. Nominatim's usage policy REQUIRES an identifying User-Agent header.
//      Browsers can't set User-Agent, so direct client calls violate the policy
//      and risk being blocked. A server proxy can set it.
//   2. Bulk uploads geocode many photos at once. An in-memory cache keyed on
//      rounded coordinates collapses repeated lookups (same trip = same place),
//      cutting upstream requests dramatically and staying under the rate limit.
//
// The cache lives per warm serverless instance (not shared across instances),
// which is fine: the burst we care about — one user uploading a batch — is
// served by a warm instance and benefits fully.

type CacheEntry = { value: string; at: number }
const CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days — place names are stable
const MAX_CACHE = 5000

// Round to 2 decimals (~1.1km) so nearby photos from the same location share a
// single cache entry and a single upstream request.
function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lon = parseFloat(searchParams.get('lon') ?? '')

  if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const key = cacheKey(lat, lon)
  const hit = CACHE.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ location: hit.value, cached: true })
  }

  let location = ''
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          process.env.GEOCODE_USER_AGENT ?? 'ArchiveYours/1.0 (orders@archiveyours.com)',
        Accept: 'application/json',
      },
      // Don't let a slow upstream hang the upload flow.
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) {
      const d = await r.json()
      const city =
        d.address?.city || d.address?.town || d.address?.village || d.address?.hamlet || ''
      const state = d.address?.state || ''
      location = city && state ? `${city}, ${state}` : d.display_name?.split(',')[0] ?? ''
    }
  } catch {
    // Network error / timeout — fall through with empty location. The stamp is
    // optional, so a geocode miss should never break the upload.
  }

  // Only cache successful lookups so a transient failure doesn't poison the entry.
  if (location) {
    if (CACHE.size >= MAX_CACHE) {
      const oldest = CACHE.keys().next().value
      if (oldest !== undefined) CACHE.delete(oldest)
    }
    CACHE.set(key, { value: location, at: Date.now() })
  }

  return NextResponse.json({ location })
}
