-- ═══════════════════════════════════════════════════════
-- PrintStudio — Supabase Database Schema
-- Run this in the Supabase SQL editor to set up your DB
-- ═══════════════════════════════════════════════════════

-- Orders table
create table if not exists orders (
  id                        uuid primary key default gen_random_uuid(),
  email                     text not null,
  status                    text not null default 'pending'
                              check (status in ('pending','paid','processing','shipped','delivered','cancelled')),
  stripe_payment_intent_id  text unique not null,
  prodigi_order_id          text,
  tracking_number           text,
  tracking_url              text,
  total_cents               integer not null,
  items                     jsonb not null default '[]',
  shipping_address          jsonb not null default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- Index for webhook lookups
create index if not exists orders_stripe_pi_idx on orders(stripe_payment_intent_id);
create index if not exists orders_prodigi_idx    on orders(prodigi_order_id);
create index if not exists orders_email_idx      on orders(email);

-- Row Level Security (RLS)
-- Orders are only accessible server-side via service role key.
-- The anon key cannot read or write orders at all.
alter table orders enable row level security;

-- No public policies — all access is via service role key in API routes

-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- Create this in Supabase Dashboard → Storage → New bucket
-- Name: print-photos
-- Public: NO (private)
-- File size limit: 30MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage is accessed server-side only via service role key.
-- Signed URLs are generated per-request with short expiry.
