-- ═══════════════════════════════════════════════════════════════════════════
-- Archive Yours — Supabase database schema
--
-- Reconciled against the live project on 2026-10-22 by reading
-- information_schema and the pg_* catalogs directly. Every column, default,
-- constraint, index, trigger and grant below is what production actually has,
-- not what we once intended it to have.
--
-- Why that mattered: this file had drifted badly. Five columns the application
-- writes on every order were missing from it, which meant anyone rebuilding
-- from this file got a database the code could not use.
--
-- Running this on a fresh project reproduces production. Running it against
-- the existing project is a no-op: every statement is idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Orders ─────────────────────────────────────────────────────────────────
-- Column order matches production.
create table if not exists orders (
  id                        uuid primary key default gen_random_uuid(),
  email                     text not null,
  status                    text not null default 'pending'
                              check (status in ('pending','paid','processing','shipped','delivered','cancelled')),

  -- NOT NULL and UNIQUE, which is load-bearing and has bitten us once.
  --
  -- A fully promotional order has no Stripe PaymentIntent (Stripe refuses a
  -- zero-amount intent), and writing null here failed the insert with 23502 —
  -- surfacing to the customer as a bare "Checkout failed". The free path now
  -- writes a `free_<order-id>` sentinel instead, which satisfies both
  -- constraints and can never collide with a real Stripe id. Keep the
  -- constraints; they are not the problem. See app/api/checkout/route.ts.
  stripe_payment_intent_id  text unique not null,

  prodigi_order_id          text,
  tracking_number           text,
  tracking_url              text,
  total_cents               integer not null,
  items                     jsonb not null default '[]',
  shipping_address          jsonb not null default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Written before a fulfillment attempt starts and cleared on success, so a
  -- run killed mid-flight (timeout, cold start) leaves a trace. See
  -- lib/fulfillment.ts.
  fulfillment_error         text,

  -- Sales tax actually charged, and the Stripe Tax calculation it came from.
  -- The calculation id is needed after payment succeeds to record the tax
  -- transaction for the Florida return.
  tax_cents                 integer not null default 0,
  tax_calculation_id        text,

  -- The promotion code redeemed on this order, normalised to upper case.
  -- Redemption ceilings are counted from this column, so clearing it or
  -- deleting the row gives the code back. See lib/promos.ts.
  promo_code                text,

  -- Set by hand after a test order so the bookkeeping export can exclude it.
  -- NOTE: the promo redemption counter deliberately ignores this flag — a test
  -- order still consumes a single-use code.
  is_test                   boolean not null default false
);

-- Columns added to an existing database after the initial create. Harmless on
-- a fresh one; required when this file is run against a project that predates
-- them.
alter table orders add column if not exists fulfillment_error  text;
alter table orders add column if not exists tax_cents          integer not null default 0;
alter table orders add column if not exists tax_calculation_id text;
alter table orders add column if not exists promo_code         text;
alter table orders add column if not exists is_test            boolean not null default false;

-- ─── KNOWN MISMATCH, left as production has it ──────────────────────────────
-- lib/fulfillment.ts writes `status = 'fulfillment_failed'` when Prodigi
-- rejects an order, but that value is NOT in the check constraint above, so
-- the write is rejected and the order stays at 'paid'. Production really is
-- in this state; this file documents it rather than quietly diverging.
--
-- Fix it by either widening the constraint or changing the code to record the
-- failure in fulfillment_error alone. If you widen it:
--
--   alter table orders drop constraint orders_status_check;
--   alter table orders add constraint orders_status_check
--     check (status in ('pending','paid','processing','shipped','delivered',
--                       'cancelled','fulfillment_failed'));

-- ─── Auto-update updated_at ─────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- ─── Indexes ────────────────────────────────────────────────────────────────
-- orders_stripe_pi_idx duplicates the index Postgres creates for the UNIQUE
-- constraint and earns nothing. It exists in production, so it is here too;
-- dropping it is safe whenever you feel like tidying up.
create index if not exists orders_stripe_pi_idx  on orders(stripe_payment_intent_id);
create index if not exists orders_prodigi_idx    on orders(prodigi_order_id);
create index if not exists orders_email_idx      on orders(email);
create index if not exists orders_status_idx     on orders(status);
create index if not exists orders_promo_code_idx on orders(promo_code)
  where promo_code is not null;

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Enabled with NO policies, deliberately. Every read and write goes through an
-- API route using the service role key, which bypasses RLS. With RLS on and no
-- policy defined, anon and authenticated callers can reach nothing through the
-- Data API even though they hold table grants — which is the intent.
--
-- Do not add a policy here without deciding what you are opening up.
alter table orders enable row level security;

-- ─── Data API grants ────────────────────────────────────────────────────────
-- REQUIRED from 2026-10-30. Supabase stopped automatically granting Data API
-- access to new tables in the "public" schema on that date. Existing tables
-- kept their grants, so production is unaffected — but a table created by this
-- file on a new project, a preview branch or a local `supabase db reset` would
-- come back unreachable, and every query would fail with "permission denied"
-- for a reason that has nothing to do with the application code.
--
-- Note these are NOT a byte-for-byte mirror of production. Supabase's default
-- grant is ALL PRIVILEGES (which also carries REFERENCES, TRIGGER and
-- TRUNCATE), and that is what the live table holds. These four are the set
-- Supabase itself recommends and all the Data API ever needs. RLS above is
-- what actually restricts anon and authenticated; these grants alone open
-- nothing. If you would rather match production exactly, use:
--   grant all privileges on public.orders to anon, authenticated, service_role;
grant select, insert, update, delete on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.orders to service_role;

-- Any table added to "public" from now on needs its own grants in the same
-- migration that creates it, or the Data API will not see it.

-- ─── Storage bucket ─────────────────────────────────────────────────────────
-- Not created by this file. Supabase Dashboard → Storage → New bucket:
--   Name: print-photos
--   Public: NO (private)
--   File size limit: 30MB
--   Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Lives in the "storage" schema, so the Data API grant change above does not
-- apply to it. Accessed server-side only with the service role key; customers
-- and Prodigi receive signed URLs with a short expiry.
