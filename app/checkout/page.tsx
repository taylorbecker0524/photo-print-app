'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// FIX A1: cart now carries the real Supabase photoPath written by the studio
// page's goToCheckout flow. Previously this was a placeholder string and
// Prodigi would receive `url: undefined`.
type CartItem = { size: string; quantity: number; stamp: any; fileName: string; photoPath: string }

const BULK_TIERS = [
  { minQty: 100, prices: { '4x6': 0.29, '5x7': 0.69, '8x10': 1.49, 'square-4': 0.35, 'square-5': 0.69, 'square-8': 1.29 } },
  { minQty: 50,  prices: { '4x6': 0.39, '5x7': 0.89, '8x10': 1.79, 'square-4': 0.49, 'square-5': 0.89, 'square-8': 1.59 } },
  { minQty: 20,  prices: { '4x6': 0.59, '5x7': 1.09, '8x10': 1.99, 'square-4': 0.69, 'square-5': 1.09, 'square-8': 1.79 } },
  { minQty: 10,  prices: { '4x6': 0.79, '5x7': 1.29, '8x10': 2.19, 'square-4': 0.89, 'square-5': 1.29, 'square-8': 1.99 } },
  { minQty: 1,   prices: { '4x6': 0.99, '5x7': 1.49, '8x10': 2.49, 'square-4': 1.09, 'square-5': 1.49, 'square-8': 2.29 } },
]

function getPrice(size: string, qty: number): number {
  const tier = BULK_TIERS.find(t => qty >= t.minQty) ?? BULK_TIERS[BULK_TIERS.length - 1]
  return (tier.prices as any)[size] ?? 0.99
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid rgba(43,42,40,0.15)', borderRadius: 10,
  background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#8A6F5A', display: 'block', marginBottom: 4,
}

export default function CheckoutPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [step, setStep] = useState<'shipping' | 'payment' | 'preparing' | 'processing'>('shipping')
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState('')
  const [stripeReady, setStripeReady] = useState(false)
  const paymentRef = useRef<HTMLDivElement>(null)
  // FIX 9 (audit): use refs instead of window.__stripeElements
  const stripeStateRef = useRef<{ stripe: any; elements: any } | null>(null)
  const [shipping, setShipping] = useState({
    name: '', email: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'US'
  })

  useEffect(() => {
    const stored = sessionStorage.getItem('print-cart')
    if (!stored) { router.push('/'); return }
    try {
      const parsed = JSON.parse(stored)
      // FIX A1: validate cart has real photoPath values (not placeholder fileName)
      // If any item is missing photoPath, the user hit checkout in an inconsistent
      // state and we should bounce them back to /studio rather than create a doomed order.
      if (!Array.isArray(parsed) || parsed.some((i:any) => !i.photoPath)) {
        sessionStorage.removeItem('print-cart')
        router.push('/studio')
        return
      }
      setCart(parsed)
    } catch {
      router.push('/')
    }
  }, [])

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cart.reduce((s, i) => s + getPrice(i.size, totalQty) * i.quantity, 0)
  const total = subtotal + 4.99

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setStep('preparing')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: shipping.email,
          items: cart.map(item => ({
            size: item.size,
            quantity: item.quantity,
            stamp: item.stamp,
            photoPath: item.photoPath,  // FIX A1: real path from Supabase upload
          })),
          shippingAddress: {
            name: shipping.name, line1: shipping.line1, line2: shipping.line2,
            city: shipping.city, state: shipping.state, zip: shipping.zip, country: shipping.country,
          },
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setOrderId(data.orderId)
      clientSecretRef.current = data.clientSecret
      setStep('payment')
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
      setStep('shipping')
    }
  }

  // FIX A8 (audit issue #8): mount Stripe Elements via effect when step becomes 'payment'
  const clientSecretRef = useRef<string | null>(null)
  useEffect(() => {
    if (step !== 'payment') return
    if (!paymentRef.current) return
    if (stripeStateRef.current) return // already mounted
    const cs = clientSecretRef.current
    if (!cs) return

    let cancelled = false
    ;(async () => {
      const stripe = await stripePromise
      if (!stripe || cancelled || !paymentRef.current) return
      const elements = stripe.elements({
        clientSecret: cs,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#D97A43',
            colorBackground: '#F7F3EE',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        },
      })
      const paymentEl = elements.create('payment')
      paymentEl.mount(paymentRef.current)
      paymentEl.on('ready', () => { if (!cancelled) setStripeReady(true) })
      stripeStateRef.current = { stripe, elements }
    })()

    return () => { cancelled = true }
  }, [step])

  const handlePaymentSubmit = async () => {
    if (!stripeReady || !stripeStateRef.current) return
    setStep('processing')
    try {
      const { stripe, elements } = stripeStateRef.current
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderId}?success=true`,
        },
      })
      if (stripeError) {
        setError(stripeError.message ?? 'Payment failed')
        setStep('payment')
      }
    } catch (err: any) {
      setError(err.message ?? 'Payment failed')
      setStep('payment')
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 400, marginBottom: 8, color: '#2B2A28' }}>Checkout</h1>
      <p style={{ fontSize: 13, color: '#8A6F5A', marginBottom: 40, letterSpacing: '0.04em' }}>Complete your order below</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32 }}>
        <div>
          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            {['Shipping', 'Payment'].map((s, i) => {
              const active = (i === 0 && (step === 'shipping' || step === 'preparing')) || (i === 1 && (step === 'payment' || step === 'processing'))
              const done = i === 0 && (step === 'payment' || step === 'processing')
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: done ? '#D97A43' : active ? '#2B2A28' : 'rgba(43,42,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: active || done ? '#F7F3EE' : '#8A6F5A' }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: active ? '#2B2A28' : '#8A6F5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s}</span>
                  {i === 0 && <div style={{ width: 32, height: 1, background: 'rgba(43,42,40,0.1)' }} />}
                </div>
              )
            })}
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#FDE8E8', border: '1px solid #F5C6C6', borderRadius: 10, color: '#C0392B', fontSize: 13 }}>
              {error}
            </div>
          )}

          {(step === 'shipping' || step === 'preparing') && (
            <form onSubmit={handleShippingSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Full name</label>
                  <input required style={inputStyle} value={shipping.name} onChange={e => setShipping(s => ({ ...s, name: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Email</label>
                  <input required type="email" style={inputStyle} value={shipping.email} onChange={e => setShipping(s => ({ ...s, email: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Street address</label>
                  <input required style={inputStyle} value={shipping.line1} onChange={e => setShipping(s => ({ ...s, line1: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <input style={inputStyle} placeholder="Apt, suite (optional)" value={shipping.line2} onChange={e => setShipping(s => ({ ...s, line2: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <input required style={inputStyle} value={shipping.city} onChange={e => setShipping(s => ({ ...s, city: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input required style={inputStyle} placeholder="FL" value={shipping.state} onChange={e => setShipping(s => ({ ...s, state: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>ZIP code</label>
                  <input required style={inputStyle} value={shipping.zip} onChange={e => setShipping(s => ({ ...s, zip: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <select style={inputStyle} value={shipping.country} onChange={e => setShipping(s => ({ ...s, country: e.target.value }))}>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={step === 'preparing'} style={{ width: '100%', marginTop: 24, padding: 14, background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', opacity: step === 'preparing' ? 0.6 : 1 }}>
                {step === 'preparing' ? 'Preparing...' : 'Continue to payment →'}
              </button>
            </form>
          )}

          {(step === 'payment' || step === 'processing') && (
            <div>
              {!stripeReady && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8A6F5A', fontSize: 13 }}>
                  Loading payment form...
                </div>
              )}
              <div ref={paymentRef} style={{ minHeight: stripeReady ? 'auto' : 0 }} />
              {stripeReady && (
                <button
                  onClick={handlePaymentSubmit}
                  disabled={step === 'processing'}
                  style={{ width: '100%', marginTop: 20, padding: 14, background: '#D97A43', color: '#F7F3EE', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: step === 'processing' ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: step === 'processing' ? 0.6 : 1 }}>
                  {step === 'processing' ? 'Processing...' : `Pay $${total.toFixed(2)}`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Order summary */}
        <div style={{ background: '#EFE8DF', borderRadius: 20, border: '1px solid rgba(43,42,40,0.08)', padding: 24, height: 'fit-content' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, marginBottom: 16 }}>Order summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {cart.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#8A6F5A' }}>{item.quantity}× {item.size}" print</span>
                <span style={{ fontWeight: 500 }}>${(getPrice(item.size, totalQty) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(43,42,40,0.1)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8A6F5A' }}>
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8A6F5A' }}>
              <span>Shipping</span><span>$4.99</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, paddingTop: 8, borderTop: '1px solid rgba(43,42,40,0.1)', marginTop: 4 }}>
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 11, color: '#8A6F5A', textAlign: 'center', letterSpacing: '0.04em' }}>🔒 Secure checkout via Stripe</p>
        </div>
      </div>
    </div>
  )
}
