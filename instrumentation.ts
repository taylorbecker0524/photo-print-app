// Next.js instrumentation hook — runs once when the server boots.
//
// Purpose: validate that the environment is wired up correctly and log clear,
// actionable warnings, instead of letting a missing or mismatched secret surface
// later as a cryptic runtime error in the middle of a payment or webhook flow.
export async function register() {
  // Only meaningful on the Node.js server runtime (skip the edge runtime).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const required: Array<[string, string]> = [
    ['STRIPE_SECRET_KEY', 'Stripe payments'],
    ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook signature verification'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase server access'],
    ['PRODIGI_API_KEY', 'Prodigi fulfillment'],
    ['RESEND_API_KEY', 'transactional email'],
  ]

  const missing = required
    .filter(([key]) => !process.env[key])
    .map(([key, use]) => `${key} (${use})`)

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (Supabase)')

  if (missing.length) {
    console.error(
      '[startup] Missing required environment variables:\n  - ' +
        missing.join('\n  - ') +
        '\nThe app will build, but these flows will fail until the variables are set.'
    )
  }

  // Stripe key sanity check: the secret key and the webhook signing secret must
  // both come from the same Stripe mode (test vs live). A mismatch is a classic
  // launch bug — payments work but webhooks silently fail signature verification.
  const sk = process.env.STRIPE_SECRET_KEY ?? ''
  const whsec = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  if (sk.startsWith('sk_live_') || sk.startsWith('sk_test_')) {
    const mode = sk.startsWith('sk_live_') ? 'LIVE' : 'TEST'
    console.log(`[startup] Stripe secret key is in ${mode} mode.`)
  } else if (sk) {
    console.warn(
      '[startup] STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_live_… or sk_test_…).'
    )
  }

  if (whsec && !whsec.startsWith('whsec_')) {
    console.warn(
      '[startup] STRIPE_WEBHOOK_SECRET does not look like a Stripe webhook signing secret (expected whsec_…). ' +
        'Copy it from the Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret.'
    )
  }
}
