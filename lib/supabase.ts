import { createClient } from '@supabase/supabase-js'

export type OrderItem = {
  photo_path: string
  size: string
  quantity: number
  stamp: any
  unit_price_cents: number
}

export type ShippingAddress = {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country: string
}

export function createServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(`Missing Supabase env vars. URL: ${!!url}, KEY: ${!!key}`)
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // supabase-js talks to PostgREST over fetch(), and the Next App Router
      // memoises fetch() responses in its Data Cache. A route marked
      // force-dynamic is still served a cached ROW: /api/orders/[id] kept
      // reporting status 'pending' for an order the database had already moved
      // to 'processing', so the status page sat on "Confirming your order"
      // through reloads while the customer's confirmation email was already in
      // their inbox. Setting no-store on the response only tells the browser;
      // it does nothing about the cache on our side of the wire.
      //
      // Nothing this client reads is cacheable — every query is live order
      // state that changed seconds ago — so opt the whole client out here
      // rather than relying on each new route to remember.
      fetch: (input: any, init?: any) => fetch(input, { ...(init ?? {}), cache: 'no-store' }),
    },
  })
}

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(`Missing Supabase env vars`)
  }
  return createClient(url, key)
}
