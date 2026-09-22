import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'orders@archiveyours.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'support@archiveyours.com'
// Guard against a mis-set env var (e.g. an email address in NEXT_PUBLIC_APP_URL):
// only use it when it's actually an http(s) URL, otherwise fall back to the
// canonical domain so "track your order" links never break.
const RAW_APP_URL = process.env.NEXT_PUBLIC_APP_URL
const APP_URL =
  RAW_APP_URL && /^https?:\/\//.test(RAW_APP_URL) ? RAW_APP_URL : 'https://www.archiveyours.com'

export async function sendOrderConfirmation({
  email,
  orderId,
  items,
  totalCents,
  taxCents = 0,
  shippingCents,
}: {
  email: string
  orderId: string
  items: Array<{ size: string; quantity: number; unit_price_cents: number }>
  totalCents: number
  taxCents?: number
  shippingCents?: number
}) {
  // One row per size, not one per photo. Each photo is its own cart item, so a
  // twenty-print order used to list twenty identical-looking rows.
  const bySize = new Map<string, { quantity: number; cents: number }>()
  for (const i of items) {
    const row = bySize.get(i.size) ?? { quantity: 0, cents: 0 }
    row.quantity += i.quantity
    row.cents += i.unit_price_cents * i.quantity
    bySize.set(i.size, row)
  }
  const itemRows = Array.from(bySize.entries())
    .sort((a, b) => b[1].cents - a[1].cents)
    .map(
      ([size, row]) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8">${row.quantity}× ${size}" print</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:right">$${(row.cents / 100).toFixed(2)}</td>
        </tr>`
    )
    .join('')

  // This used to derive shipping as "total minus items", which quietly became
  // wrong the moment we started collecting sales tax: the tax landed inside the
  // shipping line, overstating postage and hiding the tax entirely. A receipt
  // from a business that collects sales tax has to show that tax on its own
  // line. Both figures are passed in now; the subtraction is only a fallback for
  // an older order that predates them.
  const itemsSubtotalCents = items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0)
  const shipping = shippingCents ?? Math.max(0, totalCents - itemsSubtotalCents - taxCents)

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Order confirmed — #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:Georgia,serif;color:#2B2A28">
        <div style="background:#D97A43;padding:32px 40px;border-radius:8px 8px 0 0">
          <h1 style="color:#F7F3EE;margin:0;font-size:24px;font-weight:400">archive</h1>
        </div>
        <div style="background:#F7F3EE;padding:40px;border:1px solid #EFE8DF;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="font-size:20px;font-weight:400;margin:0 0 8px;color:#2B2A28">Your order is confirmed!</h2>
          <p style="color:#8A6F5A;margin:0 0 32px;font-family:sans-serif;font-size:14px">
            We're preparing your prints. You'll get a shipping confirmation when they're on their way.
          </p>
          <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px">
            ${itemRows}
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#8A6F5A">Shipping</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:right;color:#8A6F5A">$${(shipping / 100).toFixed(2)}</td>
            </tr>
            ${taxCents > 0 ? `<tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#8A6F5A">Sales tax</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:right;color:#8A6F5A">$${(taxCents / 100).toFixed(2)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:12px 0 0;font-weight:600">Total</td>
              <td style="padding:12px 0 0;text-align:right;font-weight:600">$${(totalCents / 100).toFixed(2)}</td>
            </tr>
          </table>
          <div style="margin-top:32px;padding:20px;background:#EFE8DF;border-radius:6px;font-family:sans-serif;font-size:13px">
            <strong>Order reference:</strong> #${orderId.slice(0, 8).toUpperCase()}<br>
            <span style="color:#8A6F5A">This charge appears on your statement as ARCHIVEYOURS.</span><br>
            <a href="${APP_URL}/orders/${orderId}" style="color:#D97A43;text-decoration:none;margin-top:8px;display:inline-block">
              Track your order →
            </a>
          </div>
          <p style="margin:32px 0 0;font-family:sans-serif;font-size:12px;color:#C4B5A5">
            Questions? Reply to this email and we'll get back to you within 24 hours.
          </p>
        </div>
      </div>
    `,
  })
}

export async function sendShippingConfirmation({
  email,
  orderId,
  trackingNumber,
  trackingUrl,
}: {
  email: string
  orderId: string
  trackingNumber: string
  trackingUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your prints are on their way!`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:Georgia,serif;color:#2B2A28">
        <div style="background:#D97A43;padding:32px 40px;border-radius:8px 8px 0 0">
          <h1 style="color:#F7F3EE;margin:0;font-size:24px;font-weight:400">archive</h1>
        </div>
        <div style="background:#F7F3EE;padding:40px;border:1px solid #EFE8DF;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="font-size:20px;font-weight:400;margin:0 0 8px;color:#2B2A28">Your prints are shipped!</h2>
          <p style="color:#8A6F5A;margin:0 0 32px;font-family:sans-serif;font-size:14px">
            Your order #${orderId.slice(0, 8).toUpperCase()} is on its way.
          </p>
          <a href="${trackingUrl}" style="display:inline-block;background:#D97A43;color:#F7F3EE;padding:14px 28px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px;font-weight:500">
            Track your package
          </a>
          <p style="margin:16px 0 0;font-family:sans-serif;font-size:13px;color:#8A6F5A">
            Tracking number: <strong>${trackingNumber}</strong>
          </p>
        </div>
      </div>
    `,
  })
}

export async function sendAdminAlert({ subject, body }: { subject: string; body: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[email] RESEND_API_KEY missing, cannot send admin alert:', subject)
    return
  }
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject,
    text: body,
  })
}
