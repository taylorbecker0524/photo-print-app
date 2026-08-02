'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Order = {
  id: string
  status: string
  totalCents: number
  createdAt: string
  trackingUrl: string | null
  itemCount: number
  itemSummary: string
  thumbnailUrl: string | null
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

const card: React.CSSProperties = { background: '#EFE8DF', border: '0.5px solid rgba(43,42,40,0.1)', borderRadius: 12, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '12px 20px', borderBottom: '0.5px solid rgba(43,42,40,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const cardLabel: React.CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A6F5A' }

export default function ArchivePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      if (!active) return
      setEmail(session.user?.email ?? '')
      try {
        const res = await fetch('/api/my-orders', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (active && res.ok) setOrders(data.orders ?? [])
      } catch { /* keep empty */ }
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [router])

  const signOut = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const userName = email ? email.split('@')[0] : ''
  const totalPrints = orders.reduce((s, o) => s + o.itemCount, 0)
  const totalSpent = orders.reduce((s, o) => s + o.totalCents, 0)
  const delivered = orders.filter(o => o.status === 'delivered').length
  const photos = orders.filter(o => o.thumbnailUrl)

  if (loading) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: '#8A6F5A', fontSize: 14 }}>Loading your archive…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A6F5A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          welcome back{userName ? `, ${userName}` : ''}
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 42, fontWeight: 400, color: '#2B2A28', lineHeight: 1.05 }}>
          your <em style={{ fontStyle: 'italic', color: '#8A6F5A' }}>archive</em>
        </h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(43,42,40,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
        {[
          { num: totalPrints, label: 'prints ordered' },
          { num: orders.length, label: 'orders' },
          { num: delivered, label: 'delivered' },
          { num: `$${(totalSpent / 100).toFixed(2)}`, label: 'total spent' },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#F7F3EE', padding: '20px 20px' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 400, color: '#2B2A28' }}>{stat.num}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A6F5A', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/studio')} style={{ padding: '11px 24px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
          + Print new photos
        </button>
        <button onClick={() => router.push('/studio')} style={{ padding: '11px 24px', background: 'transparent', color: '#2B2A28', border: '1px solid rgba(43,42,40,0.2)', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
          Reorder previous prints
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, color: '#2B2A28', marginBottom: 8 }}>No orders yet</p>
          <p style={{ fontSize: 13, color: '#8A6F5A', marginBottom: 20 }}>Your prints and orders will show up here once you place your first order.</p>
          <button onClick={() => router.push('/studio')} style={{ padding: '11px 24px', background: '#D97A43', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
            Start printing
          </button>
        </div>
      ) : (
        <>
          {/* Saved photos grid */}
          {photos.length > 0 && (
            <div style={{ ...card, marginBottom: 24 }}>
              <div style={cardHead}>
                <span style={cardLabel}>Your photos</span>
                <button onClick={() => router.push('/studio')} style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#D97A43', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>
                  + Add photos
                </button>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {photos.map((o) => (
                    <a key={o.id} href={`/orders/${o.id}`} style={{ display: 'block', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#E8DECC' }}>
                      {o.thumbnailUrl && <img src={o.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Orders */}
          <div style={card}>
            <div style={cardHead}>
              <span style={cardLabel}>Recent orders</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A' }}>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>
            </div>
            <div>
              {orders.map((order, i) => {
                const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending
                const date = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <div key={order.id} style={{ padding: '14px 20px', borderBottom: i < orders.length - 1 ? '0.5px solid rgba(43,42,40,0.07)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: '#2B2A28', fontWeight: 500 }}>
                        #{order.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, color: '#8A6F5A', marginTop: 2 }}>{order.itemSummary || `${order.itemCount} prints`} · {date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', ...sc }}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: '#2B2A28', fontWeight: 500 }}>
                        ${(order.totalCents / 100).toFixed(2)}
                      </span>
                      <a href={`/orders/${order.id}`} style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#D97A43', textDecoration: 'none', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {order.status === 'shipped' && order.trackingUrl ? 'Track →' : 'View →'}
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Sign out */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <button onClick={signOut} style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>
          Sign out{email ? ` (${email})` : ''}
        </button>
      </div>
    </div>
  )
}
