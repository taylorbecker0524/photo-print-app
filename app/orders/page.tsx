'use client'
import { useState } from 'react'

const STATUS_STEPS = ['Order received', 'Printing', 'Quality check', 'Shipped', 'Delivered']

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#F0EBE3', color: '#8A6F5A' },
  paid:       { bg: '#F0EBE3', color: '#8A6F5A' },
  processing: { bg: '#FAEEDA', color: '#854F0B' },
  shipped:    { bg: '#E1F5EE', color: '#0F6E56' },
  delivered:  { bg: '#E1F5EE', color: '#0F6E56' },
  cancelled:  { bg: '#FDE8E8', color: '#C0392B' },
}

const STATUS_STEP_MAP: Record<string, number> = {
  pending: 0, paid: 1, processing: 2, shipped: 3, delivered: 4,
}

export default function TrackOrderPage() {
  const [email, setEmail] = useState('')
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setOrder(null)
    try {
      const res = await fetch(`/api/orders/${orderId}?email=${encodeURIComponent(email)}`)
      if (!res.ok) { setError('No order found with that email and order ID. Please check and try again.'); setLoading(false); return }
      const data = await res.json()
      setOrder(data)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const currentStep = order ? (STATUS_STEP_MAP[order.status] ?? 0) : 0

  const inp: React.CSSProperties = { width: '100%', padding: '13px 16px', fontSize: 15, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 10, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 400, color: '#2B2A28', marginBottom: 8 }}>
          Track your <em style={{ color: '#8A6F5A', fontStyle: 'italic' }}>order</em>
        </h1>
        <p style={{ fontSize: 14, color: '#8A6F5A' }}>Enter your email and order ID to see your print status</p>
      </div>

      {!order ? (
        <form onSubmit={handleLookup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', display: 'block', marginBottom: 6 }}>Email address</label>
            <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontFamily: 'Courier New, monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', display: 'block', marginBottom: 6 }}>Order ID</label>
            <input type="text" required placeholder="e.g. A8F2D1C3" value={orderId} onChange={e => setOrderId(e.target.value.toUpperCase())} style={{ ...inp, fontFamily: 'Courier New, monospace', letterSpacing: '0.06em' }} />
            <p style={{ fontSize: 11, color: '#8A6F5A', marginTop: 4, fontStyle: 'italic' }}>Found in your confirmation email from orders@archiveyours.com</p>
          </div>
          {error && <div style={{ background: '#FDE8E8', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#C0392B' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ padding: '14px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 10, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', cursor: loading ? 'default' : 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Looking up...' : 'Track order'}
          </button>
        </form>
      ) : (
        <div>
          {/* Order found */}
          <div style={{ background: '#EFE8DF', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Order</p>
                <p style={{ fontFamily: 'Courier New, monospace', fontSize: 14, color: '#2B2A28', fontWeight: 500 }}>#{order.id?.slice(0, 8).toUpperCase()}</p>
              </div>
              <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'Courier New, monospace', ...(STATUS_COLORS[order.status] ?? STATUS_COLORS.pending) }}>
                {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                {STATUS_STEPS.map((step, i) => (
                  <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: i <= currentStep ? '#D97A43' : '#F7F3EE', border: `2px solid ${i <= currentStep ? '#D97A43' : 'rgba(43,42,40,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontSize: 11, color: i <= currentStep ? 'white' : '#8A6F5A', fontWeight: 700 }}>
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <p style={{ fontFamily: 'Courier New, monospace', fontSize: 8, color: i <= currentStep ? '#2B2A28' : '#8A6F5A', letterSpacing: '0.04em', lineHeight: 1.3 }}>{step}</p>
                  </div>
                ))}
              </div>
              <div style={{ height: 3, background: 'rgba(43,42,40,0.1)', borderRadius: 2, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: '#D97A43', borderRadius: 2, width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* Order details */}
            <div style={{ borderTop: '0.5px solid rgba(43,42,40,0.1)', paddingTop: 14 }}>
              {order.items?.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: '#8A6F5A' }}>
                  <span>{item.quantity}x {item.size}" prints</span>
                  <span style={{ color: '#2B2A28' }}>${((item.unit_price_cents ?? 99) * item.quantity / 100).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: '#8A6F5A' }}>
                <span>Shipping</span><span style={{ color: '#2B2A28' }}>$4.99</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, marginTop: 8, paddingTop: 8, borderTop: '0.5px solid rgba(43,42,40,0.1)' }}>
                <span>Total</span><span>${(order.total_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tracking link */}
          {order.tracking_url && (
            <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '13px', background: '#D97A43', color: '#F7F3EE', borderRadius: 10, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', textDecoration: 'none', marginBottom: 12 }}>
              Track shipment →
            </a>
          )}

          <button onClick={() => { setOrder(null); setEmail(''); setOrderId('') }} style={{ width: '100%', padding: '13px', background: 'transparent', color: '#8A6F5A', border: '1px solid rgba(43,42,40,0.2)', borderRadius: 10, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', cursor: 'pointer' }}>
            Look up another order
          </button>
        </div>
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
