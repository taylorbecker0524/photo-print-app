import type { Metadata } from 'next'
import './globals.css'
import Analytics from '@/lib/analytics'

const SITE_URL = 'https://www.archiveyours.com'

// The business is called Archive Yours. The metadata said "archive".
//
// That single word is what Google was given as the site's name, and it is a
// word owned several times over by the Internet Archive, archive.org and
// archive.com — so a search for the actual brand matched nothing here. The
// wordmark in the nav can stay lowercase "archive"; what a crawler reads has
// to be the name a customer would type.
export const metadata: Metadata = {
  // Without metadataBase, Next resolves Open Graph and canonical URLs against
  // the deployment host — which on Vercel is a different preview domain on
  // every build, and duplicate hosts serving identical pages is the classic
  // way to split your own ranking.
  metadataBase: new URL(SITE_URL),
  // Deliberately a plain string rather than a title template: every sub-page
  // already spells out "— Archive Yours" itself, and a template would have
  // stamped the brand on twice.
  title: 'Archive Yours — Date & Location Stamp Photo Prints',
  description: 'Archive Yours prints your photos with the exact date and location stamped on them — just like old disposable cameras. Upload from your phone and we ship them to your door.',
  applicationName: 'Archive Yours',
  keywords: 'Archive Yours, archiveyours, timestamp photos, location stamp photos, date stamp prints, disposable camera prints, photo printing, stamped photo prints',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: 'Archive Yours — Date & Location Stamp Photo Prints',
    description: 'Photos printed with the exact date and location stamped on them, just like old disposable cameras.',
    url: SITE_URL,
    siteName: 'Archive Yours',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Archive Yours photo prints' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Archive Yours — Date & Location Stamp Photo Prints',
    description: 'Photos printed with the exact date and location stamped on them.',
    images: ['/og.jpg'],
  },
}

/**
 * Structured data naming the business.
 *
 * Meta tags describe a page; this describes the organisation behind it. It is
 * how you tell Google that the site whose logo reads "archive" belongs to a
 * company called Archive Yours, and it is what a knowledge panel is built
 * from. `alternateName` covers people who search the wordmark instead.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Archive Yours',
      legalName: 'Archive Yours, LLC',
      alternateName: ['archive', 'archiveyours', 'Archive Yours LLC'],
      url: SITE_URL,
      logo: `${SITE_URL}/og.jpg`,
      email: 'support@archiveyours.com',
      description: 'Photo printing with the date and location stamped on every print.',
      // sameAs is how Google ties the site and the social account together into
      // one entity rather than two unrelated things that happen to share a
      // name. It is also a corroborating signal for a domain this young, which
      // has no inbound links of its own yet.
      sameAs: ['https://www.instagram.com/archiveyoursprints/'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Archive Yours',
      alternateName: 'archive',
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-US',
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="google-site-verification" content="LO-G4F3qX2tPGzBMUrq2GwMC01jyAjeKFiXjbSRdLog" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body style={{ background: '#F7F3EE', minHeight: '100vh', margin: 0, padding: 0, overflowX: 'hidden' }}>
        <Analytics />
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(247,243,238,0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(43,42,40,0.08)',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{
            width: '100%',
            padding: '0 20px',
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}>
            <a href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 24, letterSpacing: '0.1em', color: '#2B2A28', textDecoration: 'none', fontWeight: 400, flexShrink: 0 }}>archive</a>
            {/* globals.css has always had a rule to show this only from 640px up,
                but the class was never applied — so the tagline rendered on phones
                too, competing for a 390px-wide bar. It survived until a third link
                was added and the row finally wrapped. Hidden by default now; the
                media query switches it back on where there is room. */}
            <span className="nav-tagline" style={{ display: 'none', fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6F5A', whiteSpace: 'nowrap' }}>Print - Preserve - Cherish</span>
            {/* There was no link to the studio anywhere on the site, so leaving it
                was a one-way trip: the only route back was a home-page button
                labelled "Get started". */}
            <div style={{ display: 'flex', gap: 14, flexShrink: 0, alignItems: 'center' }}>
              <a href="/studio" style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', textDecoration: 'none', whiteSpace: 'nowrap' }}>your photos</a>
              <a href="/orders" style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', textDecoration: 'none', whiteSpace: 'nowrap' }}>track order</a>
            </div>
          </div>
        </nav>
        <main style={{ width: '100%', boxSizing: 'border-box' }}>{children}</main>
        <footer style={{ borderTop: '1px solid rgba(43,42,40,0.08)', padding: '28px 20px', textAlign: 'center', background: '#EFE8DF', marginTop: 60, width: '100%', boxSizing: 'border-box' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#8A6F5A', fontStyle: 'italic', marginBottom: 14 }}>Every photo tells a story.</p>
          {/* Policy links live in the footer on every page: card processors (Stripe)
              require Terms, Privacy and a Refund/Shipping policy to be reachable
              from anywhere on the site before they will activate a live account. */}
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', justifyContent: 'center', marginBottom: 12 }}>
            {[
              { href: '/studio', label: 'Your photos' },
              { href: '/faq', label: 'FAQ' },
              { href: '/terms', label: 'Terms' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/refund-shipping', label: 'Shipping & Refunds' },
              { href: '/orders', label: 'Track order' },
            ].map(l => (
              <a
                key={l.href}
                href={l.href}
                style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#8A6F5A', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            support@archiveyours.com
          </p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: 'rgba(138,111,90,0.75)', letterSpacing: '0.06em', marginTop: 8 }}>
            © {new Date().getFullYear()} Archive Yours
          </p>
        </footer>
      </body>
    </html>
  )
}
