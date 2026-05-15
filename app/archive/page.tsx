'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Order = {
  id: string
  status: string
  totalCents: number
  items: Array<{ size: string; quantity: number; unit_price_cents: number }>
  createdAt: string
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

// Mock data for demo — in production this fetches from /api/orders
const MOCK_ORDERS: Order[] = [
  { id: 'a8f2d1c3-0001', status: 'shipped', totalCents: 1497, items: [{ size: '4x6', quantity: 5, unit_price_cents: 99 }], createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'c4e9b3f2-0002', status: 'processing', totalCents: 2098, items: [{ size: '5x7', quantity: 3, unit_price_cents: 149 }, { size: '4x6', quantity: 5, unit_price_cents: 79 }], createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
]

const card: React.CSSProperties = { background: '#EFE8DF', border: '0.5px solid rgba(43,42,40,0.1)', borderRadius: 12, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '12px 20px', borderBottom: '0.5px solid rgba(43,42,40,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const cardLabel: React.CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A6F5A' }

export default function ArchivePage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [userName] = useState('taylor') // In production: from auth session

  const totalPrints = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0)
  const totalSpent = orders.reduce((s, o) => s + o.totalCents, 0)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A6F5A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          welcome back, {userName}
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
          { num: orders.filter(o => o.status === 'delivered').length, label: 'delivered' },
          { num: `$${(totalSpent / 100).toFixed(2)}`, label: 'total spent', raw: true },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#F7F3EE', padding: '20px 20px' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 400, color: '#2B2A28' }}>{stat.num}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A6F5A', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <button onClick={() => router.push('/studio')} style={{ padding: '11px 24px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
          + Print new photos
        </button>
        <button onClick={() => router.push('/studio')} style={{ padding: '11px 24px', background: 'transparent', color: '#2B2A28', border: '1px solid rgba(43,42,40,0.2)', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
          Reorder previous prints
        </button>
      </div>

      {/* Saved photos grid */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={cardHead}>
          <span style={cardLabel}>Saved photos</span>
          <button onClick={() => router.push('/studio')} style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#D97A43', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>
            + Add photos
          </button>
        </div>
        <div style={{ padding: 16 }}>
          {/* Placeholder grid — in production shows actual saved photos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
            {['#B8956A', '#7B6B55', '#6B7B6B', '#C9A882', '#7A8B9A', '#A67C5B', '#8B9A7A', '#9A8B7A'].map((bg, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: 6, background: bg, position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', bottom: 4, right: 4, fontFamily: "'Courier New', monospace", fontSize: 7, color: '#E8841A', fontWeight: 700, textShadow: '0 0 2px rgba(232,132,26,0.5)' }}>
                  {['7·23', '12·23', '9·23', '11·24', '8·22', '6·23', '3·24', '1·24'][i]}
                </div>
              </div>
            ))}
            <div onClick={() => router.push('/studio')} style={{ aspectRatio: '1', borderRadius: 6, border: '1.5px dashed rgba(43,42,40,0.2)', background: '#F7F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8A6F5A', fontSize: 22 }}>+</div>
          </div>
        </div>
      </div>

      {/* Orders */}
      <div style={card}>
        <div style={cardHead}>
          <span style={cardLabel}>Recent orders</span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A' }}>{orders.length} orders</span>
        </div>
        <div>
          {orders.map((order, i) => {
            const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending
            const itemSummary = order.items.map(item => `${item.quantity}× ${item.size}"`).join(', ')
            const date = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <div key={order.id} style={{ padding: '14px 20px', borderBottom: i < orders.length - 1 ? '0.5px solid rgba(43,42,40,0.07)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: '#2B2A28', fontWeight: 500 }}>
                    #{order.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: '#8A6F5A', marginTop: 2 }}>{itemSummary} · {date}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', ...sc }}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: '#2B2A28', fontWeight: 500 }}>
                    ${(order.totalCents / 100).toFixed(2)}
                  </span>
                  <a href={`/orders/${order.id}`} style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#D97A43', textDecoration: 'none', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {order.status === 'shipped' ? 'Track →' : 'View →'}
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <button style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
