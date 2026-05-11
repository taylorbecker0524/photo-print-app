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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(`Missing Supabase env vars. URL: ${!!url}, KEY: ${!!key}`)
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(`Missing Supabase env vars`)
  }
  return createClient(url, key)
}
