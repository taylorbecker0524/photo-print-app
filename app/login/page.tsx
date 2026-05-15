'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // In production: call Supabase auth.signInWithOtp({ email })
    setTimeout(() => { setSent(true); setLoading(false) }, 1000)
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '64px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, color: '#2B2A28', marginBottom: 8 }}>
          your <em style={{ fontStyle: 'italic', color: '#8A6F5A' }}>archive</em>
        </h1>
        <p style={{ fontSize: 13, color: '#8A6F5A' }}>Sign in to view your photos, orders and reprints</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Google */}
        <a href="/api/auth/google" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '12px 20px', background: 'white', border: '1px solid rgba(43,42,40,0.15)',
          borderRadius: 8, fontSize: 13, color: '#2B2A28', textDecoration: 'none',
          fontFamily: 'inherit', cursor: 'pointer', transition: 'background 0.15s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>

        {/* Apple */}
        <a href="/api/auth/apple" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '12px 20px', background: '#1C1A18', border: '1px solid #1C1A18',
          borderRadius: 8, fontSize: 13, color: '#F7F3EE', textDecoration: 'none',
          fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <svg width="16" height="19" viewBox="0 0 814 1000" fill="white">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.8 0 129.5 46.4 173.1 46.4 42.8 0 109.8-49 192.3-49 30.5 0 110.9 2.6 173.1 78.4zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
          </svg>
          Continue with Apple
        </a>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(43,42,40,0.1)' }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A', letterSpacing: '0.08em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(43,42,40,0.1)' }} />
        </div>

        {/* Magic link */}
        {!sent ? (
          <form onSubmit={handleMagicLink}>
            <p style={{ fontSize: 12, color: '#8A6F5A', marginBottom: 8, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>Magic link — no password needed</p>
            <input
              type="email" required placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 8, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', marginBottom: 8 }}
            />
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px', background: '#EFE8DF', color: '#2B2A28', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.04em' }}>
              {loading ? 'Sending...' : '✉ Send magic link'}
            </button>
          </form>
        ) : (
          <div style={{ padding: '20px', background: '#EFE8DF', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: '#2B2A28', marginBottom: 6 }}>Check your inbox ✦</p>
            <p style={{ fontSize: 12, color: '#8A6F5A' }}>We sent a sign-in link to <strong>{email}</strong></p>
          </div>
        )}
      </div>

      <p style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#8A6F5A', fontFamily: "'Courier New', monospace", letterSpacing: '0.04em' }}>
        New here?{' '}
        <a href="/studio" style={{ color: '#D97A43', textDecoration: 'none' }}>Start printing →</a>
      </p>
    </div>
  )
}
