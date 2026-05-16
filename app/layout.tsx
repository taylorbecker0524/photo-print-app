import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'archive — Print · Preserve · Cherish',
  description: 'Premium photo prints with date, time and location stamps. Upload your memories, we print and ship them to you.',
  openGraph: { title: 'archive', description: 'Print · Preserve · Cherish' },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#F7F3EE', minHeight: '100vh', margin: 0, padding: 0, overflowX: 'hidden' }}>
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
            <a href="/" style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 24, letterSpacing: '0.1em',
              color: '#2B2A28', textDecoration: 'none',
              fontWeight: 400, flexShrink: 0,
            }}>archive</a>
            <span style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#8A6F5A',
              display: 'none',
            }} className="nav-tagline">Print · Preserve · Cherish</span>
            <a href="/orders" style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#8A6F5A',
              textDecoration: 'none', flexShrink: 0,
            }}>track order</a>
          </div>
        </nav>
        <main style={{ width: '100%', boxSizing: 'border-box' }}>{children}</main>
        <footer style={{
          borderTop: '1px solid rgba(43,42,40,0.08)',
          padding: '28px 20px',
          textAlign: 'center',
          background: '#EFE8DF',
          marginTop: 60,
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16, color: '#8A6F5A', fontStyle: 'italic', marginBottom: 6 }}>
            Every photo tells a story.
          </p>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            © {new Date().getFullYear()} archive &nbsp;·&nbsp;
            <a href="mailto:support@archiveyours.com" style={{ color: '#D97A43' }}>support@archiveyours.com</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
              fontFamily: "'Courier New', monospace",
              fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#8A6F5A',
              textDecoration: 'none',
            }}>track order</a>
          </div>
        </nav>
        <main>{children}</main>
        <footer style={{
          borderTop: '1px solid rgba(43,42,40,0.08)',
          padding: '36px 28px',
          textAlign: 'center',
          background: '#EFE8DF',
          marginTop: 80,
        }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: '#8A6F5A', fontStyle: 'italic', marginBottom: 8 }}>
            Every photo tells a story.
          </p>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            © {new Date().getFullYear()} archive &nbsp;·&nbsp;
            <a href="mailto:support@archiveyours.com" style={{ color: '#D97A43' }}>support@archiveyours.com</a>
            &nbsp;·&nbsp;
            <a href="/orders" style={{ color: '#8A6F5A' }}>track order</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
