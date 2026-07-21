// Central customer-facing contact email used across policy pages and support links.
// Set NEXT_PUBLIC_CONTACT_EMAIL in the environment to switch every page to your
// business inbox in one place — no code change needed. Until then it falls back
// to the current address so nothing breaks.
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'taylorbecker0524@gmail.com'
