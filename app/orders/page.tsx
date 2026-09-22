'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'

let _sb: ReturnType<typeof createBrowserSupabase> | null = null
const getSupabase = () => (_sb ??= createBrowserSupabase())

type OrderSummary = {
  id: string
  status: string
  totalCents: number
  createdAt: string
  hasTracking: boolean
  itemCount: number
  itemSummary: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', paid: 'Confirmed', processing: 'Printing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#F0EBE3', color: '#8A6F5A' },
  paid:       { bg: '#F0EBE3', color: '#8A6F5A' },
  processing: { bg: '#FAEEDA', color: '#854F0B' },
  shipped:    { bg: '#E1F5EE', color: '#0F6E56' },
  delivered:  { bg: '#E1F5EE', color: '#0F6E56' },
  cancelled:  { bg: '#FDE8E8', color: '#C0392B' },
}

export default function TrackOrderPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [error, setError] = useState('')
  // null while we are still asking Supabase whether there is a session.
  const [signedInAs, setSignedInAs] = useState<string | null | undefined>(undefined)
  const [linkSent, setLinkSent] = useState(false)

  // Typing an address used to be enough to read that person's order history.
  // Now the address has to be proved, which a magic link does as a side effect
  // of asking. Someone already signed in skips the step entirely.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession()
        if (!active) return
        if (!session) { setSignedInAs(null); return }
        setSignedInAs(session.user?.email ?? '')
        const res = await fetch('/api/orders/lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (!active) return
        if (!res.ok) {
          // A rejected token used to leave the page claiming "Signed in as ..."
          // above an error, with nothing to click. If the session is no longer
          // good, say so and put the sign-in form back.
          if (res.status === 401) {
            setSignedInAs(null)
            setError(data?.error ?? 'Your sign-in has expired. Please request a new link.')
            return
          }
          setError(data?.error ?? 'Could not load your orders.')
          return
        }
        setOrders(data.orders ?? [])
      } catch {
        if (active) {
          setSignedInAs(null)
          setError('We could not reach the server. Please check your connection and try again.')
        }
      }
    })()
    return () => { active = false }
  }, [])

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setOrders(null)
    try {
      const { error: otpErr } = await getSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/orders` },
      })
      if (otpErr) { setError(otpErr.message); setLoading(false); return }
      setLinkSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '13px 16px', fontSize: 15, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 10, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 400, color: '#2B2A28', marginBottom: 8 }}>
          Track your <em style={{ color: '#8A6F5A', fontStyle: 'italic' }}>orders</em>
        </h1>
        <p style={{ fontSize: 14, color: '#8A6F5A' }}>
          {signedInAs ? `Signed in as ${signedInAs}` : 'Sign in to see the status of your prints'}
        </p>
      </div>

      {error && <div style={{ background: '#FDE8E8', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#C0392B', marginBottom: 16 }}>{error}</div>}

      {signedInAs === undefined && (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#8A6F5A', fontStyle: 'italic' }}>Loading…</p>
      )}

      {signedInAs === null && (
        linkSent ? (
          <div style={{ textAlign: 'center', background: '#EFE8DF', borderRadius: 14, padding: '28px 24px' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#2B2A28', marginBottom: 6 }}>Check your email</p>
            <p style={{ fontSize: 13, color: '#8A6F5A' }}>
              We sent a sign-in link to <strong>{email}</strong>. Open it on this device and your orders will be here.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', display: 'block', marginBottom: 6 }}>Email address</label>
              <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
              <p style={{ fontSize: 11, color: '#8A6F5A', marginTop: 4, fontStyle: 'italic' }}>Use the email you entered at checkout. We'll send you a link — no password.</p>
            </div>
            <button type="submit" disabled={loading} style={{ padding: '14px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 10, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', cursor: loading ? 'default' : 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p style={{ fontSize: 11, color: '#8A6F5A', textAlign: 'center', fontStyle: 'italic', marginTop: 4 }}>
              Just bought prints? The link in your receipt goes straight to that order — no sign-in needed.
            </p>
          </form>
        )
      )}

      {orders && (
        orders.length === 0 ? (
          <div style={{ marginTop: 28, textAlign: 'center', background: '#EFE8DF', borderRadius: 14, padding: '28px 24px' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#2B2A28', marginBottom: 6 }}>No orders found</p>
            <p style={{ fontSize: 13, color: '#8A6F5A' }}>We couldn't find any orders for that email. Double-check the address you used at checkout.</p>
          </div>
        ) : (
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} found
            </p>
            {orders.map(o => {
              const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending
              const date = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <a key={o.id} href={`/orders/${o.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none', background: '#EFE8DF', border: '0.5px solid rgba(43,42,40,0.1)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 13, color: '#2B2A28', fontWeight: 500 }}>
                      #{o.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12, color: '#8A6F5A', marginTop: 3 }}>
                      {o.itemSummary || `${o.itemCount} prints`} · {date}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontFamily: 'Courier New, monospace', letterSpacing: '0.04em', ...sc }}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#2B2A28', fontWeight: 500 }}>
                      ${(o.totalCents / 100).toFixed(2)}
                    </span>
                    <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#D97A43', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {o.status === 'shipped' && o.hasTracking ? 'Track →' : 'View →'}
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        )
      )}

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#8A6F5A', fontStyle: 'italic' }}>
          Questions? Email us at{' '}
          <a href="mailto:support@archiveyours.com" style={{ color: '#D97A43', textDecoration: 'none' }}>support@archiveyours.com</a>
        </p>
      </div>
    </div>
  )
}
