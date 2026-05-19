'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function LoginPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/archive` }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/archive` }
    })
  }

  const inp: React.CSSProperties = { width: '100%', padding: '13px 16px', fontSize: 15, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 10, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '56px 20px 80px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 400, color: '#2B2A28', marginBottom: 8 }}>
        your <em style={{ color: '#8A6F5A', fontStyle: 'italic' }}>archive</em>
      </h1>
      <p style={{ fontSize: 14, color: '#8A6F5A', marginBottom: 36 }}>Sign in to view your photos, orders and reprints</p>

      <button onClick={handleGoogle} style={{ width: '100%', padding: '14px 20px', background: 'white', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 12, fontSize: 15, color: '#2B2A28', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>

      <button style={{ width: '100%', padding: '14px 20px', background: '#000', border: 'none', borderRadius: 12, fontSize: 15, color: 'white', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="18" height="20" viewBox="0 0 814 1000" fill="white"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-42.3-155.5-127.5C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.5-317.3 99.8 0 183 65.7 245.5 65.7 59.2 0 152.2-69.2 271.5-69.2zm-134.2-99.5c-60.7 26.3-115 97.3-115 169.5 0 4.5.6 9.1 1.3 13.6 4.5.6 9.1.6 13 .6 56.7 0 107.3-27.5 139.2-72.5 23.1-31.5 39.5-78.5 39.5-122.5 0-4.5-.6-9.1-1.3-13.6-9.7.3-21.3 2.9-76.7 24.4z"/></svg>
        Continue with Apple
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(43,42,40,0.1)' }} />
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#8A6F5A', letterSpacing: '0.06em' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(43,42,40,0.1)' }} />
      </div>

      {!sent ? (
        <form onSubmit={handleMagicLink}>
          <div style={{ background: '#EFE8DF', borderRadius: 14, padding: '20px' }}>
            <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
            {error && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 8 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 10, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ background: '#EFE8DF', borderRadius: 14, padding: '24px 20px' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#2B2A28', marginBottom: 8 }}>Check your inbox ✦</p>
          <p style={{ fontSize: 14, color: '#8A6F5A' }}>We sent a sign-in link to <strong>{email}</strong></p>
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: 12, color: '#8A6F5A', fontFamily: 'Courier New, monospace', letterSpacing: '0.04em' }}>
        New here? <a href="/studio" style={{ color: '#D97A43', textDecoration: 'none' }}>Start printing →</a>
      </p>
    </div>
  )
}
