import { Metadata } from 'next'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'Privacy Policy — Archive Yours',
  description: 'How Archive Yours collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', color: '#2B2A28', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 400, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: '#8A6F5A', marginBottom: 40, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Last updated: June 29, 2026
      </p>

      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Archive Yours, LLC ("we," "us," "our") respects your privacy. This Privacy Policy explains how we collect, use, share, and protect information about you when you visit archiveyours.com (the "Site") or use our photo printing services (the "Services").
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
        By using the Services, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use the Services.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>1. Information We Collect</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>We collect the following categories of information:</p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>Order information:</strong> name, shipping address, email address, and the photos you upload to be printed.</li>
        <li style={{ marginBottom: 8 }}><strong>Payment information:</strong> handled directly by Stripe, our payment processor. We do not store full card numbers.</li>
        <li style={{ marginBottom: 8 }}><strong>Photo metadata:</strong> EXIF data (date taken, GPS coordinates if present) embedded in your photos. You can choose whether to display this on prints.</li>
        <li style={{ marginBottom: 8 }}><strong>Device and usage data:</strong> browser type, IP address, pages visited, and similar technical information collected through cookies and analytics tools.</li>
      </ul>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>2. How We Use Your Information</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>We use the information we collect to:</p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}>Fulfill your print orders and ship them to you;</li>
        <li style={{ marginBottom: 8 }}>Process payments and prevent fraud;</li>
        <li style={{ marginBottom: 8 }}>Send order confirmations, shipping updates, and support messages;</li>
        <li style={{ marginBottom: 8 }}>Respond to customer inquiries;</li>
        <li style={{ marginBottom: 8 }}>Improve the Services and develop new features;</li>
        <li style={{ marginBottom: 8 }}>Comply with legal obligations.</li>
      </ul>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>3. Sharing Your Information</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>We share your information with the following third parties only as needed to provide the Services:</p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>Prodigi:</strong> our print fulfillment partner. We share your shipping address, contact email, and uploaded photos so they can print and ship your order.</li>
        <li style={{ marginBottom: 8 }}><strong>Stripe:</strong> our payment processor. Stripe collects and handles your payment information directly under its own privacy policy.</li>
        <li style={{ marginBottom: 8 }}><strong>Resend:</strong> our email delivery provider, used to send transactional emails.</li>
        <li style={{ marginBottom: 8 }}><strong>Supabase:</strong> our backend infrastructure provider, which hosts order data and uploaded photos.</li>
        <li style={{ marginBottom: 8 }}><strong>Vercel:</strong> our hosting provider.</li>
      </ul>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We do not sell your personal information. We may disclose your information if required by law, subpoena, or to protect our rights or the safety of others.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>4. Photo Storage and Retention</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Photos you upload for printing are stored on our servers only as long as needed to fulfill your order. Photos are typically deleted within 90 days of order completion. We do not use your photos for any purpose other than printing them for you.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>5. Cookies and Tracking</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We use cookies and similar technologies to keep you signed in, remember your cart, and analyze how the Services are used. You can control cookies through your browser settings, though disabling them may affect Site functionality.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>6. Your Rights</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>Depending on where you live, you may have the right to:</p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24, paddingLeft: 24 }}>
        <li style={{ marginBottom: 8 }}>Access the personal information we have about you;</li>
        <li style={{ marginBottom: 8 }}>Request that we correct or delete your information;</li>
        <li style={{ marginBottom: 8 }}>Opt out of marketing emails;</li>
        <li style={{ marginBottom: 8 }}>Request a copy of your data in a portable format.</li>
      </ul>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#D97A43' }}>{CONTACT_EMAIL}</a>.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>7. Children's Privacy</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Our Services are not intended for children under 13. We do not knowingly collect information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>8. Security</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We use industry-standard measures to protect your information, including encryption in transit (HTTPS) and at rest. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>9. Changes to This Policy</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        We may update this Privacy Policy from time to time. We will post the updated version on this page and update the "Last updated" date at the top. Material changes will be communicated by email when appropriate.
      </p>

      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, marginTop: 32, marginBottom: 12 }}>10. Contact Us</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Questions about this Privacy Policy? Contact Archive Yours, LLC at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#D97A43' }}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  )
}
