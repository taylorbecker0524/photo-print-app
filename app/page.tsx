'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
type StampConfig = {
  showDate: boolean
  showTime: boolean
  showLocation: boolean
  locationText: string
  customText: string
  position: 'bl' | 'br' | 'tl' | 'tr' | 'back'
  style: string
  fontSize: 'sm' | 'md' | 'lg'
  capturedAt: string
}

type CartItem = {
  file: File
  previewUrl: string
  size: string
  quantity: number
  stamp: StampConfig
}

const SIZES = [
  { key: '4x6', label: '4×6"', desc: 'Classic' },
  { key: '5x7', label: '5×7"', desc: 'Standard' },
  { key: '8x10', label: '8×10"', desc: 'Large' },
  { key: 'square-4', label: '4×4"', desc: 'Square' },
  { key: 'square-5', label: '5×5"', desc: 'Square' },
  { key: 'square-8', label: '8×8"', desc: 'Square' },
]

const BULK_TIERS = [
  { minQty: 1,   label: '1–9 prints',    prices: { '4x6': 0.99, '5x7': 1.49, '8x10': 2.49, 'square-4': 1.09, 'square-5': 1.49, 'square-8': 2.29 } },
  { minQty: 10,  label: '10–19 prints',  prices: { '4x6': 0.79, '5x7': 1.29, '8x10': 2.19, 'square-4': 0.89, 'square-5': 1.29, 'square-8': 1.99 } },
  { minQty: 20,  label: '20–49 prints',  prices: { '4x6': 0.59, '5x7': 1.09, '8x10': 1.99, 'square-4': 0.69, 'square-5': 1.09, 'square-8': 1.79 } },
  { minQty: 50,  label: '50–99 prints',  prices: { '4x6': 0.39, '5x7': 0.89, '8x10': 1.79, 'square-4': 0.49, 'square-5': 0.89, 'square-8': 1.59 } },
  { minQty: 100, label: '100+ prints',   prices: { '4x6': 0.29, '5x7': 0.69, '8x10': 1.49, 'square-4': 0.35, 'square-5': 0.69, 'square-8': 1.29 } },
]
function getActiveTier(totalQty: number) {
  return [...BULK_TIERS].reverse().find(t => totalQty >= t.minQty) ?? BULK_TIERS[0]
}
function getNextTier(totalQty: number) {
  return BULK_TIERS.find(t => t.minQty > totalQty) ?? null
}
function getPricePerPrint(size: string, totalQty: number): number {
  const tier = getActiveTier(totalQty)
  return (tier.prices as any)[size] ?? 0.99
}

const STAMP_STYLES = [
  { key: 'classic', label: 'Classic', bg: 'rgba(0,0,0,0.6)', text: '#fff' },
  { key: 'amber',   label: 'Film',    bg: 'rgba(20,14,0,0.85)', text: '#FABC40' },
  { key: 'white',   label: 'Light',   bg: 'rgba(255,255,255,0.85)', text: '#111' },
  { key: 'neon',    label: 'Neon',    bg: '#000', text: '#39ff14' },
  { key: 'retro',   label: 'Retro',   bg: 'rgba(40,22,10,0.9)', text: '#e8c99a' },
  { key: 'none',    label: 'None',    bg: 'transparent', text: '#666' },
]

const DEFAULT_STAMP: StampConfig = {
  showDate: true, showTime: true, showLocation: false,
  locationText: '', customText: '', position: 'bl',
  style: 'classic', fontSize: 'md', capturedAt: new Date().toISOString(),
}

// ── Canvas stamp drawing ───────────────────────────────────────────────────
function drawStampedCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  stamp: StampConfig,
  size: string
) {
  const aspectRatios: Record<string, number> = {
    '4x6': 6/4, '5x7': 7/5, '8x10': 10/8,
    'square-4': 1, 'square-5': 1, 'square-8': 1,
  }
  const ar = aspectRatios[size] ?? 1.5
  const maxW = canvas.parentElement?.clientWidth ?? 600
  const maxH = 420
  let cw, ch
  if (img.naturalWidth / img.naturalHeight > 1 / ar) {
    ch = Math.min(maxH, img.naturalHeight); cw = ch / ar
  } else {
    cw = Math.min(maxW, img.naturalWidth); ch = cw * ar
  }
  canvas.width = Math.round(cw)
  canvas.height = Math.round(ch)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, cw, ch)

  if (stamp.position === 'back' || stamp.style === 'none') return

  const lines: string[] = []
  const d = new Date(stamp.capturedAt)
  if (stamp.showDate) lines.push(d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
  if (stamp.showTime) lines.push(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  if (stamp.showLocation && stamp.locationText) lines.push(stamp.locationText)
  if (stamp.customText) lines.push(stamp.customText)
  if (!lines.length) return

  const fs = stamp.fontSize === 'sm' ? cw * 0.028 : stamp.fontSize === 'lg' ? cw * 0.052 : cw * 0.038
  ctx.font = `bold ${fs}px monospace`
  const pad = cw * 0.025
  const lineH = fs * 1.4
  const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2
  const boxH = lines.length * lineH + pad * 0.8
  const styles: Record<string, { bg: string; text: string }> = {
    classic: { bg: 'rgba(0,0,0,0.6)', text: '#fff' },
    amber:   { bg: 'rgba(20,14,0,0.85)', text: '#FABC40' },
    white:   { bg: 'rgba(255,255,255,0.85)', text: '#111' },
    neon:    { bg: 'rgba(0,0,0,0.9)', text: '#39ff14' },
    retro:   { bg: 'rgba(40,22,10,0.9)', text: '#e8c99a' },
  }
  const s = styles[stamp.style] ?? styles.classic
  let bx = pad, by = pad
  if (stamp.position === 'bl') { bx = pad; by = ch - boxH - pad }
  if (stamp.position === 'br') { bx = cw - boxW - pad; by = ch - boxH - pad }
  if (stamp.position === 'tr') { bx = cw - boxW - pad; by = pad }
  ctx.fillStyle = s.bg
  ctx.beginPath()
  const r = fs * 0.35
  ctx.moveTo(bx + r, by); ctx.lineTo(bx + boxW - r, by)
  ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r)
  ctx.lineTo(bx + boxW, by + boxH - r); ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH)
  ctx.lineTo(bx + r, by + boxH); ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r)
  ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = s.text
  lines.forEach((line, i) => ctx.fillText(line, bx + pad, by + pad * 0.5 + (i + 1) * lineH - lineH * 0.2))
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [size, setSize] = useState('4x6')
  const [quantity, setQuantity] = useState(1)
  const [stamp, setStamp] = useState<StampConfig>(DEFAULT_STAMP)
  const [cart, setCart] = useState<CartItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [loadedImgs, setLoadedImgs] = useState<HTMLImageElement[]>([])
  const [showCart, setShowCart] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load images on file change
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviewUrls(urls)
    const imgs: HTMLImageElement[] = []
    let loaded = 0
    urls.forEach((url, i) => {
      const img = new Image()
      img.onload = () => {
        imgs[i] = img
        if (++loaded === urls.length) setLoadedImgs([...imgs])
      }
      img.src = url
    })
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [files])

  // Redraw canvas when state changes
  useEffect(() => {
    const canvas = canvasRef.current
    const img = loadedImgs[activeIdx]
    if (!canvas || !img) return
    drawStampedCanvas(canvas, img, stamp, size)
  }, [loadedImgs, activeIdx, stamp, size])

  // Location detection
  const detectLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json())
        .then(d => {
          const city = d.address.city || d.address.town || d.address.village || ''
          const state = d.address.state || ''
          const loc = city && state ? `${city}, ${state}` : d.display_name.split(',')[0]
          setStamp(s => ({ ...s, locationText: loc, showLocation: true }))
        })
    })
  }, [])

  const handleFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const valid = Array.from(incoming).filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...valid])
  }, [])

  const addToCart = () => {
    if (!files[activeIdx]) return
    const item: CartItem = {
      file: files[activeIdx],
      previewUrl: previewUrls[activeIdx],
      size, quantity,
      stamp: { ...stamp },
    }
    setCart(prev => [...prev, item])
    setShowCart(true)
  }

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const cartTotalQty = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + getPricePerPrint(item.size, cartTotalQty) * item.quantity, 0)
  const activeTier = getActiveTier(cartTotalQty)
  const nextTier = getNextTier(cartTotalQty)
  const printsToNextTier = nextTier ? nextTier.minQty - cartTotalQty : 0

  const goToCheckout = () => {
    // Encode cart into session storage and navigate
    sessionStorage.setItem('print-cart', JSON.stringify(
      cart.map(item => ({
        size: item.size, quantity: item.quantity, stamp: item.stamp,
        fileName: item.file.name,
      }))
    ))
    router.push('/checkout')
  }

  if (files.length === 0 || showCart === false && files.length > 0) {
    // Show the studio UI
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl font-semibold tracking-tight mb-3">
          Your memories, <em className="font-normal text-stone-400">beautifully printed</em>
        </h1>
        <p className="text-stone-500 text-lg max-w-xl mx-auto">
          Upload a photo, add a date stamp, choose your size — we print and ship it straight to you.
        </p>
      </div>

      {files.length === 0 ? (
        // ── Upload Zone ────────────────────────────────────────────────────
        <div
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
            ${dragging ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-white hover:border-brand-400 hover:bg-stone-50'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
          <div className="w-16 h-16 bg-brand-50 border border-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-stone-800 mb-1">Drop your photos here</h2>
          <p className="text-stone-400 text-sm">JPEG, PNG, HEIC — up to 20MB each</p>
          <button className="mt-6 px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors">
            Choose photos
          </button>
        </div>
      ) : (
        // ── Studio Layout ──────────────────────────────────────────────────
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Canvas panel */}
          <div className="space-y-4">
            <div className="bg-stone-900 rounded-2xl overflow-hidden flex items-center justify-center min-h-[360px]">
              <canvas ref={canvasRef} className="max-w-full max-h-[480px] block" />
            </div>

            {/* Thumbnails */}
            {files.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {previewUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Photo ${i + 1}`}
                    onClick={() => setActiveIdx(i)}
                    className={`w-16 h-16 object-cover rounded-lg cursor-pointer flex-shrink-0 border-2 transition-all
                      ${i === activeIdx ? 'border-brand-600' : 'border-transparent hover:border-stone-300'}`}
                  />
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 hover:border-brand-400 hover:text-brand-600 transition-all flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleFiles(e.target.files)} />
              </div>
            )}
          </div>

          {/* Controls panel */}
          <div className="space-y-4">
            {/* Size */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm font-medium">Print size</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {SIZES.map(s => (
                  <button key={s.key} onClick={() => setSize(s.key)}
                    className={`p-2 rounded-lg border text-xs text-center transition-all
                      ${size === s.key ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 hover:border-brand-300 text-stone-600'}`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-stone-400">from ${BULK_TIERS[0].prices[s.key as keyof typeof BULK_TIERS[0]["prices"]]?.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Stamp */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-sm font-medium">Date &amp; time stamp</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { key: 'showDate', label: 'Date', sub: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                  { key: 'showTime', label: 'Time', sub: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
                ].map(row => (
                  <div key={row.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-700">{row.label}</p>
                      <p className="text-xs text-stone-400">{row.sub}</p>
                    </div>
                    <button
                      onClick={() => setStamp(s => ({ ...s, [row.key]: !s[row.key as keyof StampConfig] }))}
                      className={`relative w-9 h-5 rounded-full transition-colors ${(stamp as any)[row.key] ? 'bg-brand-600' : 'bg-stone-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(stamp as any)[row.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}

                {/* Location */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-700">Location</p>
                    <p className="text-xs text-stone-400">
                      {stamp.locationText || (
                        <button onClick={detectLocation} className="text-brand-600 hover:underline">
                          Detect my location
                        </button>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setStamp(s => ({ ...s, showLocation: !s.showLocation }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${stamp.showLocation ? 'bg-brand-600' : 'bg-stone-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${stamp.showLocation ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Custom text */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1">Custom text</label>
                  <input type="text" placeholder="e.g. Summer trip 2025"
                    value={stamp.customText}
                    onChange={e => setStamp(s => ({ ...s, customText: e.target.value }))}
                    className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1">Position</label>
                  <select value={stamp.position} onChange={e => setStamp(s => ({ ...s, position: e.target.value as any }))}
                    className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                    <option value="bl">Front — bottom left</option>
                    <option value="br">Front — bottom right</option>
                    <option value="tl">Front — top left</option>
                    <option value="tr">Front — top right</option>
                    <option value="back">Back of photo</option>
                  </select>
                </div>

                {/* Style swatches */}
                {stamp.position !== 'back' && (
                  <div>
                    <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1">Stamp style</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {STAMP_STYLES.map(sty => (
                        <button key={sty.key} onClick={() => setStamp(s => ({ ...s, style: sty.key }))}
                          style={{ background: sty.bg === 'transparent' ? undefined : sty.bg, color: sty.text }}
                          className={`h-8 rounded-lg border-2 text-xs font-medium transition-all
                            ${stamp.style === sty.key ? 'border-brand-600' : 'border-transparent'}
                            ${sty.bg === 'transparent' ? 'bg-stone-100 text-stone-500 border-stone-200' : ''}`}
                        >
                          {sty.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Font size */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1">Font size</label>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map(fs => (
                      <button key={fs} onClick={() => setStamp(s => ({ ...s, fontSize: fs }))}
                        className={`flex-1 py-1.5 text-xs rounded-lg border transition-all
                          ${stamp.fontSize === fs ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}
                      >
                        {fs === 'sm' ? 'Small' : fs === 'md' ? 'Medium' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-stone-500 hover:border-brand-400 hover:text-brand-600 transition-all">−</button>
                <span className="w-6 text-center font-medium">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-stone-500 hover:border-brand-400 hover:text-brand-600 transition-all">+</button>
              </div>
            </div>

            {/* Bulk pricing tier banner */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-400" />
                <span className="text-sm font-medium">Bulk pricing</span>
                <span className="ml-auto text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                  {activeTier.label}
                </span>
              </div>
              <div className="divide-y divide-stone-50">
                {BULK_TIERS.map(tier => (
                  <div key={tier.minQty}
                    className={`flex items-center justify-between px-4 py-2 text-xs transition-colors
                      ${activeTier.minQty === tier.minQty ? 'bg-brand-50 text-brand-800 font-medium' : 'text-stone-400'}`}>
                    <span>{tier.label}</span>
                    <span>${tier.prices['4x6'].toFixed(2)}/print (4×6)</span>
                    {activeTier.minQty === tier.minQty && (
                      <span className="ml-2 text-brand-600">← current</span>
                    )}
                  </div>
                ))}
              </div>
              {nextTier && (
                <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
                  Add {printsToNextTier} more print{printsToNextTier !== 1 ? 's' : ''} to unlock <strong>{nextTier.label}</strong> pricing!
                </div>
              )}
            </div>

            {/* Price summary */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm">
              <div className="flex justify-between text-stone-500 mb-1">
                <span>{quantity}× {size}" @ ${getPricePerPrint(size, cartTotalQty + quantity).toFixed(2)} each</span>
                <span>${(getPricePerPrint(size, cartTotalQty + quantity) * quantity).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500 mb-2">
                <span>Shipping</span>
                <span>$4.99</span>
              </div>
              <div className="flex justify-between font-medium text-stone-900 pt-2 border-t border-stone-200">
                <span>Total</span>
                <span>${(getPricePerPrint(size, cartTotalQty + quantity) * quantity + 4.99).toFixed(2)}</span>
              </div>
            </div>

            {/* Add to cart */}
            <button onClick={addToCart}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-800 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              Add to order
            </button>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <span className="text-sm font-medium">Your order ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                  <span className="text-sm text-brand-600 font-medium">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {cart.map((item, i) => (
                    <div key={i} className="p-3 flex items-center gap-3">
                      <img src={item.previewUrl} alt="" className="w-12 h-12 object-cover rounded-lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.quantity}× {item.size}" print</p>
                        <p className="text-xs text-stone-400">${(getPricePerPrint(item.size, cartTotalQty) * item.quantity).toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeFromCart(i)} className="text-stone-300 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-3">
                  <button onClick={goToCheckout}
                    className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors text-sm">
                    Proceed to checkout →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
