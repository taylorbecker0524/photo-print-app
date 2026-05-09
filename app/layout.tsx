import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Archive — Your memories, archived.',
  description: 'Premium photo prints with date, time, and location stamps. Shipped straight to your door.',
  openGraph: {
    title: 'Archive',
    description: 'Your memories, archived.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          borderBottom: '1px solid rgba(43,42,40,0.08)',
          background: 'rgba(247,243,238,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{
            maxWidth: 1100, margin: '0 auto', padding: '0 24px',
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <a href="/" style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 22, fontWeight: 500, letterSpacing: '0.08em',
              color: '#2B2A28', textDecoration: 'none', textTransform: 'uppercase',
            }}>
              Archive
            </a>
            <a href="/orders" style={{
              fontSize: 12, color: '#8A6F5A', textDecoration: 'none',
              letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500,
            }}>
              Track order
            </a>
          </div>
        </nav>
        <main>{children}</main>
        <footer style={{
          borderTop: '1px solid rgba(43,42,40,0.08)',
          marginTop: 96, padding: '40px 24px',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 18, color: '#8A6F5A', fontStyle: 'italic', marginBottom: 8,
          }}>
            Your memories, archived.
          </p>
          <p style={{ fontSize: 11, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            © {new Date().getFullYear()} Archive &nbsp;·&nbsp;{' '}
            <a href="mailto:hello@archiveprints.com" style={{ color: '#8A6F5A' }}>Contact</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
  )
}
