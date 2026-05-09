'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  { minQty: 100, label: '100+ prints', prices: { '4x6': 0.29, '5x7': 0.69, '8x10': 1.49, 'square-4': 0.35, 'square-5': 0.69, 'square-8': 1.29 } },
  { minQty: 50,  label: '50–99 prints', prices: { '4x6': 0.39, '5x7': 0.89, '8x10': 1.79, 'square-4': 0.49, 'square-5': 0.89, 'square-8': 1.59 } },
  { minQty: 20,  label: '20–49 prints', prices: { '4x6': 0.59, '5x7': 1.09, '8x10': 1.99, 'square-4': 0.69, 'square-5': 1.09, 'square-8': 1.79 } },
  { minQty: 10,  label: '10–19 prints', prices: { '4x6': 0.79, '5x7': 1.29, '8x10': 2.19, 'square-4': 0.89, 'square-5': 1.29, 'square-8': 1.99 } },
  { minQty: 1,   label: '1–9 prints',   prices: { '4x6': 0.99, '5x7': 1.49, '8x10': 2.49, 'square-4': 1.09, 'square-5': 1.49, 'square-8': 2.29 } },
]

function getActiveTier(qty: number) {
  return BULK_TIERS.find(t => qty >= t.minQty) ?? BULK_TIERS[BULK_TIERS.length - 1]
}
function getNextTier(qty: number) {
  return [...BULK_TIERS].reverse().find(t => t.minQty > qty) ?? null
}
function getPrice(size: string, qty: number): number {
  return (getActiveTier(qty).prices as any)[size] ?? 0.99
}

const DEFAULT_STAMP: StampConfig = {
  showDate: true, showTime: false, showLocation: false,
  locationText: '', customText: '', position: 'bl',
  style: 'analog', fontSize: 'sm', capturedAt: new Date().toISOString(),
}

function drawCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement, stamp: StampConfig, size: string) {
  const ARS: Record<string, number> = { '4x6': 6/4, '5x7': 7/5, '8x10': 10/8, 'square-4': 1, 'square-5': 1, 'square-8': 1 }
  const ar = ARS[size] ?? 1.5
  const maxW = canvas.parentElement?.clientWidth ?? 600
  const maxH = 460
  let cw, ch
  if (img.naturalWidth / img.naturalHeight > 1 / ar) { ch = Math.min(maxH, img.naturalHeight); cw = ch / ar }
  else { cw = Math.min(maxW, img.naturalWidth); ch = cw * ar }
  canvas.width = Math.round(cw); canvas.height = Math.round(ch)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, cw, ch)
  if (stamp.position === 'back' || stamp.style === 'none') return
  const lines: string[] = []
  const d = new Date(stamp.capturedAt)
  if (stamp.showDate) lines.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
  if (stamp.showTime) lines.push(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  if (stamp.showLocation && stamp.locationText) lines.push(stamp.locationText)
  if (stamp.customText) lines.push(stamp.customText)
  if (!lines.length) return
  const fs = stamp.fontSize === 'sm' ? cw * 0.022 : stamp.fontSize === 'lg' ? cw * 0.038 : cw * 0.028
  ctx.font = `${fs}px 'Courier New', monospace`
  const pad = cw * 0.03
  const lineH = fs * 1.5
  const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2
  const boxH = lines.length * lineH + pad
  let bx = pad, by = ch - boxH - pad
  if (stamp.position === 'br') { bx = cw - boxW - pad; by = ch - boxH - pad }
  if (stamp.position === 'tl') { bx = pad; by = pad }
  if (stamp.position === 'tr') { bx = cw - boxW - pad; by = pad }
  // Analog style — faded, warm
  ctx.fillStyle = 'rgba(247,243,238,0.72)'
  ctx.fillRect(bx, by, boxW, boxH)
  ctx.fillStyle = 'rgba(43,42,40,0.75)'
  lines.forEach((line, i) => ctx.fillText(line, bx + pad * 0.8, by + pad * 0.5 + (i + 1) * lineH - lineH * 0.2))
}

// Styles
const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' },
  hero: { textAlign: 'center', padding: '72px 24px 56px' },
  heroTitle: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(42px, 6vw, 72px)', fontWeight: 400, lineHeight: 1.05, color: '#2B2A28', marginBottom: 16 },
  heroSub: { fontSize: 15, color: '#8A6F5A', fontWeight: 300, letterSpacing: '0.02em', maxWidth: 480, margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, alignItems: 'start' },
  card: { background: '#EFE8DF', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(43,42,40,0.08)' },
  cardHead: { padding: '14px 20px', borderBottom: '1px solid rgba(43,42,40,0.08)', display: 'flex', alignItems: 'center', gap: 8 },
  cardHeadLabel: { fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A6F5A' },
  cardBody: { padding: '16px 20px' },
  canvasWrap: { background: '#2B2A28', minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  uploadZone: { border: '1.5px dashed rgba(43,42,40,0.2)', borderRadius: 20, background: '#EFE8DF', padding: '64px 32px', textAlign: 'center' as const, cursor: 'pointer', transition: 'all 0.2s' },
  uploadTitle: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 400, color: '#2B2A28', marginBottom: 8 },
  uploadSub: { fontSize: 13, color: '#8A6F5A', fontWeight: 300 },
  togRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' },
  togLabel: { fontSize: 13, color: '#2B2A28' },
  togSub: { fontSize: 11, color: '#8A6F5A', marginTop: 1 },
  input: { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 8, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none' },
  select: { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 8, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', appearance: 'none' as const },
  label: { fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8A6F5A', display: 'block', marginBottom: 4, marginTop: 12 },
  btn: { width: '100%', padding: '13px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: 'inherit', transition: 'background 0.15s' },
  btnAccent: { width: '100%', padding: '13px', background: '#D97A43', color: '#F7F3EE', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: 'inherit', transition: 'background 0.15s' },
  thumb: { width: 52, height: 52, objectFit: 'cover' as const, borderRadius: 8, cursor: 'pointer', border: '2px solid transparent', flexShrink: 0, transition: 'border-color 0.15s' },
  sizeBtn: { padding: '8px 6px', fontSize: 12, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 8, background: '#F7F3EE', cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s', color: '#2B2A28', fontFamily: 'inherit' },
  sizeBtnActive: { padding: '8px 6px', fontSize: 12, border: '1px solid #D97A43', borderRadius: 8, background: '#F2D5C0', cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s', color: '#2B2A28', fontFamily: 'inherit' },
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      position: 'relative', width: 36, height: 20, borderRadius: 20, border: 'none', cursor: 'pointer',
      background: checked ? '#D97A43' : 'rgba(43,42,40,0.15)', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 3, width: 14, height: 14, background: '#F7F3EE',
        borderRadius: '50%', transition: 'left 0.2s', left: checked ? 18 : 3,
      }} />
    </button>
  )
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addlFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviewUrls(urls)
    const imgs: HTMLImageElement[] = []
    let loaded = 0
    if (!urls.length) return
    urls.forEach((url, i) => {
      const img = new Image()
      img.onload = () => { imgs[i] = img; if (++loaded === urls.length) setLoadedImgs([...imgs]) }
      img.src = url
    })
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [files])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = loadedImgs[activeIdx]
    if (!canvas || !img) return
    drawCanvas(canvas, img, stamp, size)
  }, [loadedImgs, activeIdx, stamp, size])

  const detectLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json()).then(d => {
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

  const cartQty = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + getPrice(i.size, cartQty) * i.quantity, 0)
  const activeTier = getActiveTier(cartQty)
  const nextTier = getNextTier(cartQty)
  const toNext = nextTier ? nextTier.minQty - cartQty : 0

  const addToCart = () => {
    if (!files[activeIdx]) return
    setCart(prev => [...prev, { file: files[activeIdx], previewUrl: previewUrls[activeIdx], size, quantity, stamp: { ...stamp } }])
  }
  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx))

  const goToCheckout = () => {
    sessionStorage.setItem('print-cart', JSON.stringify(cart.map(item => ({ size: item.size, quantity: item.quantity, stamp: item.stamp, fileName: item.file.name }))))
    router.push('/checkout')
  }

  const now = new Date()

  return (
    <div>
      {/* Hero */}
      <div style={S.hero} className="animate-fade-up">
        <h1 style={S.heroTitle}>
          Your memories,<br /><em>beautifully archived.</em>
        </h1>
        <p style={S.heroSub} className="animate-fade-up-delay">
          Upload a photo, add your timestamp — we print and ship it straight to you.
        </p>
      </div>

      <div style={S.page}>
        {files.length === 0 ? (
          // Upload zone
          <div
            style={{ ...S.uploadZone, ...(dragging ? { borderColor: '#D97A43', background: '#F2D5C0' } : {}) }}
            className="animate-fade-up-delay-2"
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F7F3EE', border: '1px solid rgba(43,42,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A6F5A" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h2 style={S.uploadTitle}>Drop your photos here</h2>
            <p style={S.uploadSub}>JPEG, PNG, HEIC — up to 20MB each</p>
            <button style={{ ...S.btn, width: 'auto', padding: '10px 28px', marginTop: 24, display: 'inline-block' }}>
              Choose photos
            </button>
          </div>
        ) : (
          <div style={S.grid}>
            {/* Left: canvas */}
            <div>
              <div style={S.card}>
                <div style={S.canvasWrap}>
                  <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: 460, display: 'block' }} />
                </div>
                {files.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, padding: 12, background: '#2B2A28', overflowX: 'auto' }}>
                    {previewUrls.map((url, i) => (
                      <img key={i} src={url} alt="" onClick={() => setActiveIdx(i)}
                        style={{ ...S.thumb, borderColor: i === activeIdx ? '#D97A43' : 'transparent' }} />
                    ))}
                    <button onClick={() => addlFileRef.current?.click()} style={{ width: 52, height: 52, borderRadius: 8, border: '1.5px dashed rgba(247,243,238,0.3)', background: 'transparent', color: '#8A6F5A', cursor: 'pointer', flexShrink: 0, fontSize: 20 }}>+</button>
                    <input ref={addlFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
                  </div>
                )}
              </div>
            </div>

            {/* Right: controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Size */}
              <div style={S.card}>
                <div style={S.cardHead}><span style={S.cardHeadLabel}>Print size</span></div>
                <div style={S.cardBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {SIZES.map(s => (
                      <button key={s.key} onClick={() => setSize(s.key)}
                        style={size === s.key ? S.sizeBtnActive : S.sizeBtn}>
                        <div style={{ fontWeight: 500 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: '#8A6F5A', marginTop: 2 }}>from ${BULK_TIERS[BULK_TIERS.length-1].prices[s.key as keyof typeof BULK_TIERS[0]['prices']]?.toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stamp */}
              <div style={S.card}>
                <div style={S.cardHead}><span style={S.cardHeadLabel}>Timestamp</span></div>
                <div style={S.cardBody}>
                  {[
                    { key: 'showDate', label: 'Date', sub: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                    { key: 'showTime', label: 'Time', sub: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
                  ].map(row => (
                    <div key={row.key} style={{ ...S.togRow, borderBottom: '1px solid rgba(43,42,40,0.07)' }}>
                      <div>
                        <p style={S.togLabel}>{row.label}</p>
                        <p style={S.togSub}>{row.sub}</p>
                      </div>
                      <Toggle checked={(stamp as any)[row.key]} onChange={() => setStamp(s => ({ ...s, [row.key]: !(s as any)[row.key] }))} />
                    </div>
                  ))}
                  <div style={{ ...S.togRow, borderBottom: '1px solid rgba(43,42,40,0.07)' }}>
                    <div>
                      <p style={S.togLabel}>Location</p>
                      <p style={S.togSub}>
                        {stamp.locationText || (
                          <span onClick={detectLocation} style={{ color: '#D97A43', cursor: 'pointer' }}>Detect location</span>
                        )}
                      </p>
                    </div>
                    <Toggle checked={stamp.showLocation} onChange={() => setStamp(s => ({ ...s, showLocation: !s.showLocation }))} />
                  </div>
                  <div style={S.togRow}>
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <p style={S.togLabel}>Custom text</p>
                      <input style={S.input} placeholder="e.g. Amalfi Coast, 2025" value={stamp.customText} onChange={e => setStamp(s => ({ ...s, customText: e.target.value }))} />
                    </div>
                  </div>

                  <span style={S.label}>Position</span>
                  <select style={S.select} value={stamp.position} onChange={e => setStamp(s => ({ ...s, position: e.target.value as any }))}>
                    <option value="bl">Front — bottom left</option>
                    <option value="br">Front — bottom right</option>
                    <option value="tl">Front — top left</option>
                    <option value="tr">Front — top right</option>
                    <option value="back">Back of photo</option>
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div style={{ ...S.card, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#2B2A28', fontWeight: 500 }}>Quantity</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(43,42,40,0.15)', background: '#F7F3EE', cursor: 'pointer', fontSize: 16, color: '#2B2A28', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 500, minWidth: 20, textAlign: 'center' }}>{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(43,42,40,0.15)', background: '#F7F3EE', cursor: 'pointer', fontSize: 16, color: '#2B2A28', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>

              {/* Pricing */}
              <div style={{ ...S.card, padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A6F5A', marginBottom: 6 }}>
                  <span>{quantity}× {size}" @ ${getPrice(size, cartQty + quantity).toFixed(2)} each</span>
                  <span>${(getPrice(size, cartQty + quantity) * quantity).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A6F5A', paddingBottom: 10, borderBottom: '1px solid rgba(43,42,40,0.08)' }}>
                  <span>Shipping</span><span>$4.99</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, paddingTop: 10 }}>
                  <span>Total</span>
                  <span>${(getPrice(size, cartQty + quantity) * quantity + 4.99).toFixed(2)}</span>
                </div>
                {nextTier && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#F2D5C0', borderRadius: 8, fontSize: 11, color: '#8A6F5A' }}>
                    Add {toNext} more print{toNext !== 1 ? 's' : ''} to unlock <strong style={{ color: '#D97A43' }}>{nextTier.label}</strong> pricing
                  </div>
                )}
              </div>

              <button onClick={addToCart} style={S.btn}>Add to order</button>

              {/* Cart */}
              {cart.length > 0 && (
                <div style={S.card}>
                  <div style={{ ...S.cardHead, justifyContent: 'space-between' }}>
                    <span style={S.cardHeadLabel}>Your order</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#D97A43' }}>${(cartTotal + 4.99).toFixed(2)}</span>
                  </div>
                  <div>
                    {cart.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(43,42,40,0.07)' }}>
                        <img src={item.previewUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 500 }}>{item.quantity}× {item.size}" print</p>
                          <p style={{ fontSize: 11, color: '#8A6F5A' }}>${(getPrice(item.size, cartQty) * item.quantity).toFixed(2)}</p>
                        </div>
                        <button onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A6F5A', fontSize: 16 }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 16 }}>
                    <button onClick={goToCheckout} style={S.btnAccent}>Proceed to checkout →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
