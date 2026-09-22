'use client'
import { useState } from 'react'

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/archive` }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '13px 16px', fontSize: 15, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 10, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '56px 20px 80px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 400, color: '#2B2A28', marginBottom: 8 }}>
        your <em style={{ color: '#8A6F5A', fontStyle: 'italic' }}>archive</em>
      </h1>
      <p style={{ fontSize: 14, color: '#8A6F5A', marginBottom: 36 }}>We'll email you a link — no password to remember</p>

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
