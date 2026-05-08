import { createClient } from '@supabase/supabase-js'

// ── Browser client (uses anon key, respects RLS) ──────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Server client (uses service role, bypasses RLS — server only!) ─────────
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export type Database = {
  orders: {
    id: string
    email: string
    status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    stripe_payment_intent_id: string
    prodigi_order_id: string | null
    tracking_number: string | null
    tracking_url: string | null
    total_cents: number
    items: OrderItem[]
    shipping_address: ShippingAddress
    created_at: string
    updated_at: string
  }
}

export type OrderItem = {
  photo_path: string      // Supabase storage path (never exposed to client)
  size: string            // e.g. "4x6"
  quantity: number
  stamp: StampConfig
  unit_price_cents: number
}

export type StampConfig = {
  showDate: boolean
  showTime: boolean
  showLocation: boolean
  locationText: string
  customText: string
  position: 'bl' | 'br' | 'tl' | 'tr' | 'back'
  style: string
  fontSize: 'sm' | 'md' | 'lg'
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
