import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'orders@yourprintshop.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourprintshop.com'

export async function sendOrderConfirmation({
  email,
  orderId,
  items,
  totalCents,
}: {
  email: string
  orderId: string
  items: Array<{ size: string; quantity: number; unit_price_cents: number }>
  totalCents: number
}) {
  const itemRows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8">${i.quantity}× ${i.size}" print</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:right">$${((i.unit_price_cents * i.quantity) / 100).toFixed(2)}</td>
        </tr>`
    )
    .join('')

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Order confirmed — #${orderId.slice(0, 8).toUpperCase()}`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:Georgia,serif;color:#1c1917">
        <div style="background:#534AB7;padding:32px 40px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:400">PrintStudio</h1>
        </div>
        <div style="background:white;padding:40px;border:1px solid #e7e5e4;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Your order is confirmed!</h2>
          <p style="color:#78716c;margin:0 0 32px;font-family:sans-serif;font-size:14px">
            We're preparing your prints. You'll get a shipping confirmation when they're on their way.
          </p>
          <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px">
            ${itemRows}
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#78716c">Shipping</td>
              <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:right;color:#78716c">$4.99</td>
            </tr>
            <tr>
              <td style="padding:12px 0 0;font-weight:600">Total</td>
              <td style="padding:12px 0 0;text-align:right;font-weight:600">$${(totalCents / 100).toFixed(2)}</td>
            </tr>
          </table>
          <div style="margin-top:32px;padding:20px;background:#f5f4fe;border-radius:6px;font-family:sans-serif;font-size:13px">
            <strong>Order reference:</strong> #${orderId.slice(0, 8).toUpperCase()}<br>
            <a href="${APP_URL}/orders/${orderId}" style="color:#534AB7;text-decoration:none;margin-top:8px;display:inline-block">
              Track your order →
            </a>
          </div>
          <p style="margin:32px 0 0;font-family:sans-serif;font-size:12px;color:#a8a29e">
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
    subject: `Your prints are on their way! 📦`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:Georgia,serif;color:#1c1917">
        <div style="background:#534AB7;padding:32px 40px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:400">PrintStudio</h1>
        </div>
        <div style="background:white;padding:40px;border:1px solid #e7e5e4;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Your prints are shipped!</h2>
          <p style="color:#78716c;margin:0 0 32px;font-family:sans-serif;font-size:14px">
            Your order #${orderId.slice(0, 8).toUpperCase()} is on its way.
          </p>
          <a href="${trackingUrl}" style="display:inline-block;background:#534AB7;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px;font-weight:500">
            Track your package
          </a>
          <p style="margin:16px 0 0;font-family:sans-serif;font-size:13px;color:#78716c">
            Tracking number: <strong>${trackingNumber}</strong>
          </p>
        </div>
      </div>
    `,
  })
}
