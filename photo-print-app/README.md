# PrintStudio — Photo Print App

A full-stack Next.js app for a print-only photo business. Customers upload photos, add date/time/location stamps, pay via Stripe, and receive physical prints shipped by Prodigi.

**No download button. Photos never leave your server.**

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Database + Storage | Supabase |
| Payments | Stripe |
| Print fulfillment | Prodigi |
| Email | Resend |
| Image processing | Sharp |
| Hosting | Vercel |

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd photo-print-app
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` — see the sections below for where to get each key.

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Storage → New bucket**:
   - Name: `print-photos`
   - Public: **No**
   - File size limit: 30MB
4. Copy your project URL and keys into `.env.local`

### 4. Set up Stripe

1. Create an account at [stripe.com](https://stripe.com)
2. Copy your **Publishable key** and **Secret key** from the Dashboard
3. Set up a webhook:
   - Go to **Developers → Webhooks → Add endpoint**
   - URL: `https://yoursite.com/api/webhook`
   - Events to listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

For local development, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

### 5. Set up Prodigi

1. Sign up at [prodigi.com](https://www.prodigi.com)
2. Go to **Account → API Keys**
3. Copy your API key → `PRODIGI_API_KEY`
4. Configure shipping webhooks in Prodigi to `POST` to `/api/webhook/prodigi`

### 6. Set up Resend (email)

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain
3. Create an API key → `RESEND_API_KEY`
4. Set `EMAIL_FROM` to your verified sender address

### 7. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

Set `NEXT_PUBLIC_APP_URL` to your production domain.

---

## File Structure

```
photo-print-app/
├── app/
│   ├── page.tsx                    # Studio UI (upload, stamp, cart)
│   ├── checkout/page.tsx           # Shipping + Stripe payment
│   ├── orders/[id]/page.tsx        # Order tracking
│   └── api/
│       ├── upload/route.ts         # Photo upload + stamp processing
│       ├── checkout/route.ts       # Create Stripe PaymentIntent + order
│       ├── webhook/route.ts        # Stripe webhook handler
│       └── orders/[id]/route.ts    # Order status API
├── lib/
│   ├── supabase.ts                 # DB client + types
│   ├── stripe.ts                   # Stripe client + pricing
│   ├── prodigi.ts                  # Print fulfillment API
│   ├── stamp.ts                    # Server-side image stamping (Sharp)
│   └── email.ts                    # Transactional emails (Resend)
├── supabase-schema.sql             # Run this to set up your DB
└── .env.example                    # Copy to .env.local
```

---

## Pricing

Edit `lib/stripe.ts` to set your prices:

```ts
export const PRINT_PRICES: Record<string, number> = {
  '4x6':   899,   // $8.99 — Prodigi costs ~$3-4, your margin: ~$4-5
  '5x7':   1299,
  '8x10':  1899,
  ...
}
export const SHIPPING_PRICE_CENTS = 499  // $4.99 flat
```

---

## Adding print sizes

1. Add the size to `PRINT_PRICES` in `lib/stripe.ts`
2. Add a `SKU_MAP` entry in `lib/prodigi.ts` with the correct Prodigi SKU
3. Add it to the `SIZES` array in `app/page.tsx`
4. Add a resize target in `lib/stamp.ts` → `resizeForPrint()`

---

## Security notes

- Photos are stored in a **private** Supabase bucket — no public URLs ever
- Signed URLs are generated with 1-hour expiry only when sending to Prodigi
- Prices are calculated **server-side** — the client can't manipulate them
- The Stripe webhook signature is verified on every request
- Order details returned to clients are sanitized (no internal paths or IDs)

---

## Monthly costs at launch

| Service | Free tier | Paid |
|---|---|---|
| Vercel | 100GB bandwidth | $20/mo Pro |
| Supabase | 500MB DB, 1GB storage | $25/mo Pro |
| Resend | 3,000 emails/mo | $20/mo |
| Stripe | — | 2.9% + $0.30/transaction |
| Prodigi | — | Per print (cost of goods) |

**Total fixed: ~$0–65/mo** depending on volume.
