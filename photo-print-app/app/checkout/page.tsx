'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type CartItem = {
  size: string
  quantity: number
  stamp: any
  fileName: string
}

const BULK_TIERS = [
  { minQty: 1,   prices: { '4x6': 0.99, '5x7': 1.49, '8x10': 2.49, 'square-4': 1.09, 'square-5': 1.49, 'square-8': 2.29 } },
  { minQty: 10,  prices: { '4x6': 0.79, '5x7': 1.29, '8x10': 2.19, 'square-4': 0.89, 'square-5': 1.29, 'square-8': 1.99 } },
  { minQty: 20,  prices: { '4x6': 0.59, '5x7': 1.09, '8x10': 1.99, 'square-4': 0.69, 'square-5': 1.09, 'square-8': 1.79 } },
  { minQty: 50,  prices: { '4x6': 0.39, '5x7': 0.89, '8x10': 1.79, 'square-4': 0.49, 'square-5': 0.89, 'square-8': 1.59 } },
  { minQty: 100, prices: { '4x6': 0.29, '5x7': 0.69, '8x10': 1.49, 'square-4': 0.35, 'square-5': 0.69, 'square-8': 1.29 } },
]
function getPricePerPrint(size: string, totalQty: number): number {
  const tier = [...BULK_TIERS].reverse().find(t => totalQty >= t.minQty) ?? BULK_TIERS[0]
  return (tier.prices as any)[size] ?? 0.99
}

export default function CheckoutPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [step, setStep] = useState<'shipping' | 'payment' | 'uploading' | 'processing'>('shipping')
  const [error, setError] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [orderId, setOrderId] = useState('')
  const paymentRef = useRef<HTMLDivElement>(null)

  const [shipping, setShipping] = useState({
    name: '', email: '', line1: '', line2: '',
    city: '', state: '', zip: '', country: 'US',
  })

  useEffect(() => {
    const stored = sessionStorage.getItem('print-cart')
    if (!stored) { router.push('/'); return }
    setCart(JSON.parse(stored))
  }, [])

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = cart.reduce((s, i) => s + getPricePerPrint(i.size, totalQty) * i.quantity, 0)
  const total = subtotal + 4.99

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setStep('uploading')

    try {
      // Get original files from session (they were stored by the studio page)
      // In production you'd have the files in a state manager or re-upload from session storage blobs
      // For this flow, we'll just proceed with checkout using the stored cart data

      // Create checkout session
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: shipping.email,
          items: cart.map(item => ({
            size: item.size,
            quantity: item.quantity,
            stamp: item.stamp,
            photoPath: `uploads/placeholder-${item.fileName}`, // replaced by real upload flow
          })),
          shippingAddress: {
            name: shipping.name,
            line1: shipping.line1,
            line2: shipping.line2,
            city: shipping.city,
            state: shipping.state,
            zip: shipping.zip,
            country: shipping.country,
          },
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setClientSecret(data.clientSecret)
      setOrderId(data.orderId)
      setStep('payment')

      // Mount Stripe Elements
      setTimeout(async () => {
        const stripe = await stripePromise
        if (!stripe || !paymentRef.current) return
        const elements = stripe.elements({ clientSecret: data.clientSecret, appearance: { theme: 'stripe' } })
        const paymentEl = elements.create('payment')
        paymentEl.mount(paymentRef.current)

        // Store elements reference for submission
        ;(window as any).__stripeElements = { stripe, elements }
      }, 100)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
      setStep('shipping')
    }
  }

  const handlePaymentSubmit = async () => {
    setStep('processing')
    const { stripe, elements } = (window as any).__stripeElements
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}?success=true` },
    })
    if (error) {
      setError(error.message ?? 'Payment failed')
      setStep('payment')
    }
  }

  const inputCls = "w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl font-semibold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Left: form */}
        <div>
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8 text-sm">
            <div className={`flex items-center gap-2 ${step === 'shipping' ? 'text-brand-600 font-medium' : 'text-stone-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step === 'shipping' ? 'bg-brand-600 text-white' : step === 'payment' || step === 'processing' ? 'bg-teal-500 text-white' : 'bg-stone-200 text-stone-400'}`}>
                {step === 'payment' || step === 'processing' ? '✓' : '1'}
              </div>
              Shipping
            </div>
            <div className="flex-1 h-px bg-stone-200" />
            <div className={`flex items-center gap-2 ${step === 'payment' || step === 'processing' ? 'text-brand-600 font-medium' : 'text-stone-300'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step === 'payment' || step === 'processing' ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-400'}`}>2</div>
              Payment
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
          )}

          {(step === 'shipping' || step === 'uploading') && (
            <form onSubmit={handleShippingSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">Full name</label>
                  <input required className={inputCls} value={shipping.name} onChange={e => setShipping(s => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">Email</label>
                  <input required type="email" className={inputCls} value={shipping.email} onChange={e => setShipping(s => ({ ...s, email: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">Address</label>
                  <input required className={inputCls} placeholder="Street address" value={shipping.line1} onChange={e => setShipping(s => ({ ...s, line1: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <input className={inputCls} placeholder="Apt, suite, unit (optional)" value={shipping.line2} onChange={e => setShipping(s => ({ ...s, line2: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">City</label>
                  <input required className={inputCls} value={shipping.city} onChange={e => setShipping(s => ({ ...s, city: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">State</label>
                  <input required className={inputCls} placeholder="FL" value={shipping.state} onChange={e => setShipping(s => ({ ...s, state: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">ZIP code</label>
                  <input required className={inputCls} value={shipping.zip} onChange={e => setShipping(s => ({ ...s, zip: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wide">Country</label>
                  <select className={inputCls} value={shipping.country} onChange={e => setShipping(s => ({ ...s, country: e.target.value }))}>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={step === 'uploading'}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {step === 'uploading' ? 'Preparing your order...' : 'Continue to payment →'}
              </button>
            </form>
          )}

          {(step === 'payment' || step === 'processing') && (
            <div>
              <div ref={paymentRef} className="min-h-[200px]" />
              <button onClick={handlePaymentSubmit} disabled={step === 'processing'}
                className="w-full mt-4 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-800 transition-colors disabled:opacity-60">
                {step === 'processing' ? 'Processing...' : `Pay $${total.toFixed(2)}`}
              </button>
            </div>
          )}
        </div>

        {/* Right: order summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 h-fit">
          <h2 className="font-medium text-stone-900 mb-4">Order summary</h2>
          <div className="space-y-3 mb-4">
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-stone-600">{item.quantity}× {item.size}" print</span>
                <span className="font-medium">${(getPricePerPrint(item.size, totalQty) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-200 pt-3 space-y-2 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Shipping</span><span>$4.99</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-900 pt-2 border-t border-stone-200">
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-stone-400 text-center">🔒 Secure checkout via Stripe</p>
        </div>
      </div>
    </div>
  )
}
