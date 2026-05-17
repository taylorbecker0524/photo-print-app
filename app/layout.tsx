import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'archive — Date & Location Stamp Photo Prints',
  description: 'Upload your photos and get them printed with the exact date and location stamped on them — just like old disposable cameras. Ships to your door.',
  keywords: 'timestamp photos, location stamp photos, date stamp prints, disposable camera prints, photo printing, stamped photo prints',
  openGraph: {
    title: 'archive — Date & Location Stamp Photo Prints',
    description: 'Upload your photos and get them printed with the exact date and location stamped on them. Ships to your door.',
    url: 'https://www.archiveyours.com',
    siteName: 'archive',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="google-site-verification" content="LO-G4F3qX2tPGzBMUrq2GwMC01jyAjeKFiXjbSRdLog" />
      </head>
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
            <a href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 24, letterSpacing: '0.1em', color: '#2B2A28', textDecoration: 'none', fontWeight: 400, flexShrink: 0 }}>archive</a>
            <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6F5A' }}>Print - Preserve - Cherish</span>
            <a href="/orders" style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', textDecoration: 'none', flexShrink: 0 }}>track order</a>
          </div>
        </nav>
        <main style={{ width: '100%', boxSizing: 'border-box' }}>{children}</main>
        <footer style={{ borderTop: '1px solid rgba(43,42,40,0.08)', padding: '28px 20px', textAlign: 'center', background: '#EFE8DF', marginTop: 60, width: '100%', boxSizing: 'border-box' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#8A6F5A', fontStyle: 'italic', marginBottom: 6 }}>Every photo tells a story.</p>
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            support@archiveyours.com
          </p>
        </footer>
      </body>
    </html>
  )
}
