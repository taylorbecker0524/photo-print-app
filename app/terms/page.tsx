import { Metadata } from 'next'
import { MIN_ORDER_QTY, PRICE_TIERS } from '@/lib/pricing'

// Ascending list of quantities where the per-print price drops, e.g. [10, 25, 50, 100].
const TIER_BREAKS = PRICE_TIERS.map(t => t.minQty).filter(q => q > 1).sort((a, b) => a - b)
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'Terms of Service — Archive Yours',
  description: 'Terms and conditions for using Archive Yours photo printing services.',
}

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', color: '#2B2A28', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 400, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: '#8A6F5A', marginBottom: 40, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Last updated: June 29, 2026
      </p>

      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
        These Terms of Service ("Terms") govern your use of archiveyours.com and the photo printing services offered by Archive Yours, LLC ("we," "us," "our"). By accessing or using the Services, you agree to these Terms. If you do not agree, please do not use the Services.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>1. Eligibility</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        You must be at least 18 years old to use the Services. By using the Services, you represent that you meet this requirement.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>2. Your Photos and Content</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        You retain all ownership rights to the photos and content you upload ("Your Content"). By uploading Your Content, you grant Archive Yours a limited, non-exclusive, royalty-free license to use, store, process, and reproduce Your Content solely for the purpose of fulfilling your print orders.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>You represent and warrant that:</p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}>You own Your Content, or have the legal right to use and reproduce it;</li>
        <li style={{ marginBottom: 8 }}>Your Content does not infringe any third party's intellectual property, privacy, or publicity rights;</li>
        <li style={{ marginBottom: 8 }}>Your Content does not violate any law or regulation.</li>
      </ul>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>3. Prohibited Content</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>You may not upload or print:</p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}>Content you do not have the right to use;</li>
        <li style={{ marginBottom: 8 }}>Content that is illegal, obscene, defamatory, or harassing;</li>
        <li style={{ marginBottom: 8 }}>Sexually explicit content involving minors;</li>
        <li style={{ marginBottom: 8 }}>Content that promotes violence, hate, or discrimination;</li>
        <li style={{ marginBottom: 8 }}>Content that infringes copyright, trademark, or other intellectual property.</li>
      </ul>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We reserve the right to refuse, cancel, or refund orders containing prohibited content at our sole discretion.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>4. Orders and Payment</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        Orders start at a minimum of {MIN_ORDER_QTY} prints.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        Prices per print depend on the total number of prints in your order. The
        price shown in the studio and at checkout is the price you pay, and it
        updates automatically as you add prints — you do not need a code or a
        coupon to receive a volume price. Current price breaks begin at{' '}
        {TIER_BREAKS.join(', ')} prints. Prices are subject to change, but the
        price shown at the moment you pay is the price that applies to your order.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        When you place an order, you authorize us to charge your payment method for the order total, including product cost, shipping, and any applicable taxes. Payments are processed by Stripe.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We reserve the right to refuse or cancel any order at our discretion. If we cancel an order, we will refund any payment in full.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>5. Shipping</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Shipping costs are calculated at checkout based on your destination and order contents. We currently ship within the United States only. Delivery times are estimates and not guaranteed. See our <a href="/refund-shipping" style={{ color: '#D97A43' }}>Shipping & Refund Policy</a> for details.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>6. Refunds and Returns</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Because our products are personalized prints made to order, all sales are generally final. We will replace or refund orders that arrive damaged or with manufacturing defects. See our <a href="/refund-shipping" style={{ color: '#D97A43' }}>Shipping & Refund Policy</a> for the full policy.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>7. Color, Quality, and Print Variations</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Print colors may vary slightly from how they appear on your screen due to differences in monitors, lighting, and printing processes. Minor variations are normal and not considered defects.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>8. Intellectual Property</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        All content on the Site that is not Your Content — including logos, designs, text, software, and trademarks — is the property of Archive Yours, LLC or its licensors, and is protected by copyright and other intellectual property laws. You may not copy, modify, or distribute this content without our written permission.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>9. Disclaimer of Warranties</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        The Services are provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that the Services will be uninterrupted, error-free, or secure.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>10. Limitation of Liability</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        To the maximum extent permitted by law, Archive Yours, LLC and its affiliates, officers, employees, and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the Services. Our total liability for any claim is limited to the amount you paid for the order in question.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>11. Indemnification</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        You agree to indemnify and hold harmless Archive Yours, LLC and its affiliates from any claims, damages, losses, or expenses (including attorneys' fees) arising from your use of the Services, your violation of these Terms, or your infringement of any third party's rights.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>12. Governing Law</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        These Terms are governed by the laws of the State of Florida, without regard to its conflict of laws rules. Any dispute arising under these Terms will be resolved in the state or federal courts located in Hillsborough County, Florida.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>13. Changes to These Terms</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We may update these Terms from time to time. We will post the updated version on this page and update the "Last updated" date. Your continued use of the Services after changes are posted constitutes your acceptance of the new Terms.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>14. Contact</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Questions about these Terms? Contact Archive Yours, LLC at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#D97A43' }}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  )
}
