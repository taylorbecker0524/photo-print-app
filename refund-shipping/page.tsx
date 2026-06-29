import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shipping & Refund Policy — Archive Yours',
  description: 'Shipping, returns, and refund information for Archive Yours orders.',
}

export default function RefundShippingPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', color: '#2B2A28', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 400, marginBottom: 8 }}>Shipping & Refund Policy</h1>
      <p style={{ fontSize: 12, color: '#8A6F5A', marginBottom: 40, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Last updated: June 29, 2026
      </p>

      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
        Thank you for choosing Archive Yours. This policy explains how shipping, returns, and refunds work for orders placed through archiveyours.com.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>Shipping</h2>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Where we ship</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        We currently ship within the United States only, including all 50 states. International shipping is not available at this time.
      </p>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Shipping cost</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        Shipping cost is calculated at checkout based on your order. The amount you see at checkout is the final shipping cost — there are no additional fees.
      </p>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Processing & delivery time</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        Orders are typically processed and printed within 2–4 business days. Standard shipping then takes an additional 3–7 business days, for a total of approximately <strong>5–11 business days</strong> from order to delivery.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        Delivery times are estimates, not guarantees. Delays may occur due to high volume, weather, or carrier issues.
      </p>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Tracking your order</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        You will receive a shipping confirmation email with a tracking number once your order ships. You can also view order status in your account.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 40, marginBottom: 12 }}>Returns & Refunds</h2>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Personalized prints — all sales final</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        Because we print every order to your specifications, <strong>all sales are final</strong> and we cannot accept returns for change of mind. Please review your order carefully before completing checkout.
      </p>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Damaged or defective prints</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        If your prints arrive damaged in transit or have a manufacturing defect (such as printing errors, incorrect sizing, or material flaws), we will replace them at no charge or refund your order.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        To request a replacement or refund:
      </p>
      <ol style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}>Contact us at <a href="mailto:taylorbecker0524@gmail.com" style={{ color: '#D97A43' }}>taylorbecker0524@gmail.com</a> within <strong>14 days</strong> of receiving your order.</li>
        <li style={{ marginBottom: 8 }}>Include your order number and a clear photo of the issue.</li>
        <li style={{ marginBottom: 8 }}>We'll respond within 2 business days and arrange a replacement or refund.</li>
      </ol>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Lost packages</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        If your tracking shows your package as delivered but you cannot locate it, please check with neighbors and your local mail carrier first. If you still cannot locate the package after 3 business days, contact us and we will work with the carrier to resolve it.
      </p>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Wrong address</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        Please double-check your shipping address at checkout. We are not responsible for packages shipped to incorrect addresses provided by the customer. If you notice an error immediately after ordering, contact us as quickly as possible — we may be able to correct it if printing has not yet started.
      </p>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>How refunds are processed</h3>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        Approved refunds are issued to the original payment method within 5–10 business days, depending on your bank or card issuer.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 40, marginBottom: 12 }}>Order Cancellations</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Because orders enter production shortly after payment, cancellations may not be possible. If you need to cancel, contact us at <a href="mailto:taylorbecker0524@gmail.com" style={{ color: '#D97A43' }}>taylorbecker0524@gmail.com</a> immediately. If printing has not yet started, we will cancel and refund. Once an order is in production, it cannot be cancelled.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 40, marginBottom: 12 }}>Contact</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Need help with an order? Email <a href="mailto:taylorbecker0524@gmail.com" style={{ color: '#D97A43' }}>taylorbecker0524@gmail.com</a> and we will respond within 1–2 business days.
      </p>
    </div>
  )
}
