'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type Order = {
  id: string; status: string; trackingNumber: string | null; trackingUrl: string | null
  totalCents: number; items: Array<{ size: string; quantity: number; unit_price_cents: number }>
  createdAt: string; shippingAddress: { name: string; city: string; state: string; country: string }
}

const STATUS_STEPS = ['paid', 'processing', 'shipped', 'delivered']
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending payment', paid: 'Order confirmed', processing: 'Printing your photos',
  shipped: 'On its way', delivered: 'Delivered', cancelled: 'Cancelled',
}

export default function OrderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const success = searchParams.get('success') === 'true'

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/orders/${params.id}`).then(r => r.json()).then(data => { setOrder(data); setLoading(false) }).catch(() => setLoading(false))
  }, [params.id])

  const stepIdx = order ? STATUS_STEPS.indexOf(order.status) : -1

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      {success && (
        <div style={{ marginBottom: 32, padding: '16px 20px', background: '#EFE8DF', border: '1px solid rgba(43,42,40,0.1)', borderRadius: 12, borderLeft: '3px solid #D97A43' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, color: '#2B2A28' }}>Your order is confirmed ✦</p>
          <p style={{ fontSize: 13, color: '#8A6F5A', marginTop: 4 }}>We'll start printing right away and email you when they ship.</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#8A6F5A', fontSize: 14 }}>Loading your order…</p>
      ) : !order ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ color: '#8A6F5A', marginBottom: 16 }}>Order not found.</p>
          <a href="/" style={{ color: '#D97A43', fontSize: 13, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Start a new order →</a>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, color: '#2B2A28' }}>Order details</h1>
              <p style={{ fontSize: 12, color: '#8A6F5A', fontFamily: 'monospace', marginTop: 4 }}>#{order.id.slice(0,8).toUpperCase()}</p>
            </div>
            <div style={{ padding: '6px 14px', borderRadius: 20, background: order.status === 'delivered' ? '#D4EDDA' : '#EFE8DF', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: order.status === 'delivered' ? '#155724' : '#8A6F5A' }}>
              {STATUS_LABELS[order.status] ?? order.status}
            </div>
          </div>

          {/* Progress */}
          {stepIdx >= 0 && (
            <div style={{ background: '#EFE8DF', borderRadius: 16, padding: 24, marginBottom: 20, border: '1px solid rgba(43,42,40,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 11, left: '12.5%', right: '12.5%', height: 1, background: 'rgba(43,42,40,0.1)', zIndex: 0 }} />
                <div style={{ position: 'absolute', top: 11, left: '12.5%', height: 1, background: '#D97A43', zIndex: 1, width: `${(stepIdx / (STATUS_STEPS.length - 1)) * 75}%`, transition: 'width 0.5s ease' }} />
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, position: 'relative', zIndex: 2 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: i <= stepIdx ? '#D97A43' : '#F7F3EE', border: `1px solid ${i <= stepIdx ? '#D97A43' : 'rgba(43,42,40,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: i <= stepIdx ? '#F7F3EE' : '#8A6F5A' }}>
                      {i < stepIdx ? '✓' : i + 1}
                    </div>
                    <p style={{ fontSize: 10, textAlign: 'center', color: i <= stepIdx ? '#2B2A28' : '#8A6F5A', letterSpacing: '0.04em', lineHeight: 1.3 }}>{STATUS_LABELS[step]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking */}
          {order.trackingNumber && (
            <div style={{ background: '#EFE8DF', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid rgba(43,42,40,0.08)' }}>
              <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', marginBottom: 8 }}>Tracking</p>
              <p style={{ fontSize: 13, fontFamily: 'monospace', color: '#2B2A28', marginBottom: 6 }}>{order.trackingNumber}</p>
              {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#D97A43', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Track package →</a>}
            </div>
          )}

          {/* Items */}
          <div style={{ background: '#EFE8DF', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid rgba(43,42,40,0.08)' }}>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', marginBottom: 12 }}>Items</p>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#8A6F5A' }}>{item.quantity}× {item.size}" print</span>
                <span style={{ fontWeight: 500 }}>${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(43,42,40,0.08)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Total paid</span><span>${(order.totalCents / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Address */}
          <div style={{ background: '#EFE8DF', borderRadius: 16, padding: 20, border: '1px solid rgba(43,42,40,0.08)' }}>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', marginBottom: 8 }}>Shipping to</p>
            <p style={{ fontSize: 13, color: '#2B2A28' }}>{order.shippingAddress.name}</p>
            <p style={{ fontSize: 12, color: '#8A6F5A' }}>{order.shippingAddress.city}, {order.shippingAddress.state} · {order.shippingAddress.country}</p>
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <a href="/" style={{ fontSize: 12, color: '#D97A43', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Archive more memories →</a>
          </div>
        </>
      )}
    </div>
  )
}
