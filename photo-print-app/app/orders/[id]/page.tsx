'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type Order = {
  id: string
  status: string
  trackingNumber: string | null
  trackingUrl: string | null
  totalCents: number
  items: Array<{ size: string; quantity: number; unit_price_cents: number }>
  createdAt: string
  shippingAddress: { name: string; city: string; state: string; country: string }
}

const STATUS_STEPS = ['paid', 'processing', 'shipped', 'delivered']
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending payment',
  paid: 'Payment confirmed',
  processing: 'Printing your photos',
  shipped: 'On its way to you',
  delivered: 'Delivered!',
  cancelled: 'Cancelled',
}

export default function OrderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const success = searchParams.get('success') === 'true'

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/orders/${params.id}`)
      .then(r => r.json())
      .then(data => { setOrder(data); setLoading(false) })
      .catch(() => { setError('Order not found'); setLoading(false) })
  }, [params.id])

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center text-stone-400">
      Loading your order…
    </div>
  )

  if (error || !order) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-stone-500 mb-4">We couldn't find that order.</p>
      <a href="/" className="text-brand-600 hover:underline">Start a new order</a>
    </div>
  )

  const stepIdx = STATUS_STEPS.indexOf(order.status)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {success && (
        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 text-sm">
          🎉 Payment confirmed! We'll start printing your photos right away and email you when they ship.
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Order details</h1>
          <p className="text-sm text-stone-400 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium
          ${order.status === 'delivered' ? 'bg-teal-100 text-teal-700' :
            order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
            order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
            'bg-amber-100 text-amber-700'}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </div>
      </div>

      {/* Progress bar */}
      {order.status !== 'cancelled' && order.status !== 'pending' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 transition-all
                  ${i <= stepIdx ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-300'}`}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <p className={`text-xs text-center ${i <= stepIdx ? 'text-stone-700 font-medium' : 'text-stone-300'}`}>
                  {STATUS_LABELS[step]}
                </p>
                {i < STATUS_STEPS.length - 1 && (
                  <div className="absolute" style={{ display: 'none' }} />
                )}
              </div>
            ))}
          </div>
          {/* Connector line */}
          <div className="relative h-1 bg-stone-100 rounded-full mt-0 -mt-12 mx-4" style={{ marginTop: '-2.5rem', zIndex: -1 }}>
            <div className="h-full bg-brand-600 rounded-full transition-all"
              style={{ width: `${Math.max(0, (stepIdx / (STATUS_STEPS.length - 1)) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Tracking */}
      {order.trackingNumber && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
          <h2 className="font-medium mb-3">Tracking</h2>
          <p className="text-sm text-stone-500 mb-2">Tracking number: <span className="font-mono text-stone-800">{order.trackingNumber}</span></p>
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
              Track your package →
            </a>
          )}
        </div>
      )}

      {/* Order items */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
        <h2 className="font-medium mb-4">Items</h2>
        <div className="space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-stone-600">{item.quantity}× {item.size}" print</span>
              <span className="font-medium">${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-100 mt-4 pt-4 flex justify-between font-semibold">
          <span>Total paid</span>
          <span>${(order.totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      {/* Shipping address */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h2 className="font-medium mb-2">Shipping to</h2>
        <p className="text-sm text-stone-600">{order.shippingAddress.name}</p>
        <p className="text-sm text-stone-400">{order.shippingAddress.city}, {order.shippingAddress.state} · {order.shippingAddress.country}</p>
      </div>

      <div className="mt-8 text-center">
        <a href="/" className="text-sm text-brand-600 hover:underline">Print more photos →</a>
      </div>
    </div>
  )
}
