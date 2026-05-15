'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Filter = 'original' | 'film' | 'sepia' | 'bw' | 'faded' | 'vivid' | 'cool'
type StampStyle = 'burn' | 'overlay' | 'back' | 'none'
type StampPosition = 'bl' | 'br' | 'tl' | 'tr'

type StampConfig = {
  showDate: boolean
  showTime: boolean
  showLocation: boolean
  locationText: string
  customText: string
  style: StampStyle
  position: StampPosition
  fontSize: 'sm' | 'md' | 'lg'
  capturedAt: string
}

type Photo = {
  id: string
  file: File
  url: string
  selected: boolean
  filter: Filter
  stamp: StampConfig
  size: string
  quantity: number
}

type CartItem = {
  photoId: string
  url: string
  size: string
  quantity: number
  filter: Filter
  stamp: StampConfig
  fileName: string
}

const SIZES = [
  { key: '4x6', label: '4×6"' }, { key: '5x7', label: '5×7"' },
  { key: '8x10', label: '8×10"' }, { key: 'square-4', label: '4×4"' },
  { key: 'square-5', label: '5×5"' }, { key: 'square-8', label: '8×8"' },
]

const BULK_TIERS = [
  { minQty: 100, prices: { '4x6': 0.29, '5x7': 0.69, '8x10': 1.49, 'square-4': 0.35, 'square-5': 0.69, 'square-8': 1.29 } },
  { minQty: 50,  prices: { '4x6': 0.39, '5x7': 0.89, '8x10': 1.79, 'square-4': 0.49, 'square-5': 0.89, 'square-8': 1.59 } },
  { minQty: 20,  prices: { '4x6': 0.59, '5x7': 1.09, '8x10': 1.99, 'square-4': 0.69, 'square-5': 1.09, 'square-8': 1.79 } },
  { minQty: 10,  prices: { '4x6': 0.79, '5x7': 1.29, '8x10': 2.19, 'square-4': 0.89, 'square-5': 1.29, 'square-8': 1.99 } },
  { minQty: 1,   prices: { '4x6': 0.99, '5x7': 1.49, '8x10': 2.49, 'square-4': 1.09, 'square-5': 1.49, 'square-8': 2.29 } },
]

const FILTERS: { key: Filter; label: string; css: string }[] = [
  { key: 'original', label: 'Original', css: 'none' },
  { key: 'film',     label: 'Film',     css: 'sepia(0.2) contrast(1.1) saturate(0.9) brightness(0.95)' },
  { key: 'sepia',    label: 'Sepia',    css: 'sepia(0.85) contrast(1.05)' },
  { key: 'bw',       label: 'B&W',      css: 'grayscale(1) contrast(1.1)' },
  { key: 'faded',    label: 'Faded',    css: 'contrast(0.85) saturate(0.7) brightness(1.05)' },
  { key: 'vivid',    label: 'Vivid',    css: 'saturate(1.4) contrast(1.1)' },
  { key: 'cool',     label: 'Cool',     css: 'saturate(0.9) hue-rotate(15deg) brightness(1.02)' },
]

function getFilterCss(f: Filter) {
  return FILTERS.find(x => x.key === f)?.css ?? 'none'
}

function getPrice(size: string, totalQty: number): number {
  const tier = BULK_TIERS.find(t => totalQty >= t.minQty) ?? BULK_TIERS[BULK_TIERS.length - 1]
  return (tier.prices as any)[size] ?? 0.99
}

const DEFAULT_STAMP: StampConfig = {
  showDate: true, showTime: false, showLocation: false,
  locationText: '', customText: '', style: 'burn',
  position: 'bl', fontSize: 'sm', capturedAt: new Date().toISOString(),
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      position: 'relative', width: 34, height: 18, borderRadius: 20, border: 'none',
      cursor: 'pointer', background: checked ? '#D97A43' : 'rgba(43,42,40,0.15)',
      transition: 'background 0.2s', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 2, width: 14, height: 14, background: '#F7F3EE', borderRadius: '50%', transition: 'left 0.2s', left: checked ? 17 : 2 }} />
    </button>
  )
}

const card: React.CSSProperties = { background: '#EFE8DF', border: '0.5px solid rgba(43,42,40,0.1)', borderRadius: 12, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '10px 16px', borderBottom: '0.5px solid rgba(43,42,40,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const cardLabel: React.CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6F5A' }
const fieldLabel: React.CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', display: 'block', marginBottom: 4, marginTop: 10 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 6, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 6, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', appearance: 'none' }
const togRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(43,42,40,0.06)' }
const primaryBtn: React.CSSProperties = { width: '100%', padding: '11px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }
const accentBtn: React.CSSProperties = { width: '100%', padding: '11px', background: '#D97A43', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: '#2B2A28', border: '1px solid rgba(43,42,40,0.2)', borderRadius: 6, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }

export default function StudioPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [globalStamp, setGlobalStamp] = useState<StampConfig>(DEFAULT_STAMP)
  const [globalSize, setGlobalSize] = useState('4x6')
  const [globalFilter, setGlobalFilter] = useState<Filter>('original')
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)

  const activePhoto = photos.find(p => p.id === activeId)
  const selectedPhotos = photos.filter(p => p.selected)
  const cartQty = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + getPrice(i.size, cartQty) * i.quantity, 0)
  const nextTier = BULK_TIERS.slice().reverse().find(t => t.minQty > cartQty)
  const toNext = nextTier ? nextTier.minQty - cartQty : 0

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const newPhotos: Photo[] = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        id: Math.random().toString(36).slice(2),
        file: f, url: URL.createObjectURL(f), selected: false,
        filter: 'original', stamp: { ...DEFAULT_STAMP }, size: '4x6', quantity: 1,
      }))
    setPhotos(prev => [...prev, ...newPhotos])
  }, [])

  useEffect(() => {
    if (!activePhoto) return
    const img = new Image()
    img.onload = () => setLoadedImg(img)
    img.src = activePhoto.url
  }, [activeId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !loadedImg || !activePhoto) return
    drawPreview(canvas, loadedImg, activePhoto.stamp, activePhoto.filter)
  }, [loadedImg, activePhoto?.stamp, activePhoto?.filter])

  function drawPreview(canvas: HTMLCanvasElement, img: HTMLImageElement, stamp: StampConfig, filter: Filter) {
    const maxW = Math.min(canvas.parentElement?.clientWidth ?? 560, 560)
    const maxH = 380
    let cw = Math.min(maxW, img.naturalWidth)
    let ch = (cw / img.naturalWidth) * img.naturalHeight
    if (ch > maxH) { ch = maxH; cw = (ch / img.naturalHeight) * img.naturalWidth }
    canvas.width = Math.round(cw); canvas.height = Math.round(ch)
    const ctx = canvas.getContext('2d')!
    ctx.filter = getFilterCss(filter)
    ctx.drawImage(img, 0, 0, cw, ch)
    ctx.filter = 'none'
    if (stamp.style === 'none' || stamp.style === 'back') return
    const lines: string[] = []
    const d = new Date(stamp.capturedAt)
    if (stamp.showDate) lines.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
    if (stamp.showTime) lines.push(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    if (stamp.showLocation && stamp.locationText) lines.push(stamp.locationText)
    if (stamp.customText) lines.push(stamp.customText)
    if (!lines.length) return
    const fs = stamp.fontSize === 'sm' ? cw * 0.022 : stamp.fontSize === 'lg' ? cw * 0.04 : cw * 0.03
    ctx.font = `bold ${Math.round(fs)}px 'Courier New', monospace`
    const pad = cw * 0.025
    const lineH = fs * 1.45
    const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2
    const boxH = lines.length * lineH + pad * 0.8
    let bx = pad, by = ch - boxH - pad
    if (stamp.position === 'br') bx = cw - boxW - pad
    if (stamp.position === 'tl') by = pad
    if (stamp.position === 'tr') { bx = cw - boxW - pad; by = pad }
    if (stamp.style === 'burn') {
      ctx.fillStyle = '#E8841A'
      ctx.shadowColor = 'rgba(232,132,26,0.6)'; ctx.shadowBlur = 3
      lines.forEach((line, i) => ctx.fillText(line, bx, by + pad * 0.4 + (i + 1) * lineH - lineH * 0.2))
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = 'rgba(247,243,238,0.62)'
      ctx.fillRect(bx, by, boxW, boxH)
      ctx.fillStyle = 'rgba(43,42,40,0.82)'
      lines.forEach((line, i) => ctx.fillText(line, bx + pad * 0.8, by + pad * 0.4 + (i + 1) * lineH - lineH * 0.2))
    }
  }

  const updatePhoto = (id: string, updates: Partial<Photo>) => setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  const updateStamp = (id: string, updates: Partial<StampConfig>) => setPhotos(prev => prev.map(p => p.id === id ? { ...p, stamp: { ...p.stamp, ...updates } } : p))
  const applyGlobalToAll = () => setPhotos(prev => prev.map(p => ({ ...p, stamp: { ...globalStamp }, size: globalSize, filter: globalFilter })))
  const applyGlobalToSelected = () => setPhotos(prev => prev.map(p => p.selected ? { ...p, stamp: { ...globalStamp }, size: globalSize, filter: globalFilter } : p))
  const toggleSelect = (id: string) => setPhotos(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p))
  const toggleSelectAll = () => { const all = photos.every(p => p.selected); setPhotos(prev => prev.map(p => ({ ...p, selected: !all }))) }

  const detectLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json()).then(d => {
          const city = d.address.city || d.address.town || ''
          const state = d.address.state || ''
          const loc = city && state ? `${city}, ${state}` : d.display_name.split(',')[0]
          if (activeId) updateStamp(activeId, { locationText: loc, showLocation: true })
          else setGlobalStamp(s => ({ ...s, locationText: loc, showLocation: true }))
        })
    })
  }, [activeId])

  const addToCart = () => {
    const toAdd = selectedPhotos.length > 0 ? selectedPhotos : photos
    const items: CartItem[] = toAdd.map(p => ({
      photoId: p.id, url: p.url, size: p.size, quantity: p.quantity,
      filter: p.filter, stamp: { ...p.stamp }, fileName: p.file.name,
    }))
    setCart(prev => [...prev, ...items])
  }

  const goToCheckout = () => {
    sessionStorage.setItem('print-cart', JSON.stringify(
      cart.map(item => ({ size: item.size, quantity: item.quantity, stamp: item.stamp, filter: item.filter, fileName: item.fileName }))
    ))
    router.push('/checkout')
  }

  if (photos.length === 0) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 400, color: '#2B2A28', marginBottom: 6, textAlign: 'center' }}>Upload your photos</h1>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#8A6F5A', marginBottom: 32 }}>Drop as many as you like — select which ones to print after</p>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: '1.5px dashed rgba(43,42,40,0.2)', borderRadius: 20, background: '#EFE8DF', padding: '56px 32px', textAlign: 'center', cursor: 'pointer' }}
        >
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F7F3EE', border: '1px solid rgba(43,42,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A6F5A" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          </div>
          <p style={{ fontSize: 13, color: '#8A6F5A' }}>Drag & drop or <span style={{ color: '#D97A43', textDecoration: 'underline' }}>browse</span></p>
          <p style={{ fontSize: 11, color: '#C4B5A5', marginTop: 6, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em' }}>JPEG · PNG · HEIC — up to 20MB each</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 60px' }}>
      {/* Global settings bar */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          <span style={{ ...cardLabel, marginRight: 4 }}>Global settings</span>
          <select value={globalFilter} onChange={e => setGlobalFilter(e.target.value as Filter)} style={{ ...selectStyle, width: 'auto', padding: '5px 28px 5px 10px', fontSize: 12 }}>
            {FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={globalSize} onChange={e => setGlobalSize(e.target.value)} style={{ ...selectStyle, width: 'auto', padding: '5px 28px 5px 10px', fontSize: 12 }}>
            {SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={globalStamp.style} onChange={e => setGlobalStamp(s => ({ ...s, style: e.target.value as StampStyle }))} style={{ ...selectStyle, width: 'auto', padding: '5px 28px 5px 10px', fontSize: 12 }}>
            <option value="burn">Classic burn</option>
            <option value="overlay">Subtle overlay</option>
            <option value="back">Back of photo</option>
            <option value="none">No stamp</option>
          </select>
          <button onClick={applyGlobalToAll} style={ghostBtn}>Apply to all</button>
          {selectedPhotos.length > 0 && (
            <button onClick={applyGlobalToSelected} style={{ ...ghostBtn, color: '#D97A43', borderColor: 'rgba(217,122,67,0.4)' }}>
              Apply to {selectedPhotos.length} selected
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <input ref={addMoreRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            <button onClick={() => addMoreRef.current?.click()} style={ghostBtn}>+ Add more</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activePhoto ? '1fr 300px' : '1fr', gap: 20 }}>
        <div>
          {/* Select toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button onClick={toggleSelectAll} style={ghostBtn}>{photos.every(p => p.selected) ? 'Deselect all' : 'Select all'}</button>
            {selectedPhotos.length > 0 && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A6F5A' }}>{selectedPhotos.length} of {photos.length} selected</span>}
          </div>

          {/* Photo grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {photos.map(photo => (
              <div key={photo.id}>
                <div
                  onClick={() => setActiveId(photo.id === activeId ? null : photo.id)}
                  style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: `2px solid ${photo.id === activeId ? '#D97A43' : photo.selected ? '#2B2A28' : 'transparent'}`, position: 'relative', cursor: 'pointer', transition: 'border-color 0.15s' }}
                >
                  <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: getFilterCss(photo.filter) }} />
                  {photo.stamp.showDate && photo.stamp.style === 'burn' && (
                    <div style={{ position: 'absolute', bottom: 5, right: 5, fontFamily: "'Courier New', monospace", fontSize: 8, color: '#E8841A', fontWeight: 700, textShadow: '0 0 3px rgba(232,132,26,0.6)', lineHeight: 1.3 }}>
                      {new Date(photo.stamp.capturedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 6, right: 6 }} onClick={e => { e.stopPropagation(); toggleSelect(photo.id) }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${photo.selected ? '#D97A43' : 'rgba(255,255,255,0.8)'}`, background: photo.selected ? '#D97A43' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {photo.selected && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: '#8A6F5A' }}>{SIZES.find(s => s.key === photo.size)?.label}</span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: '#8A6F5A' }}>×{photo.quantity}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing nudge */}
          {nextTier && cartQty > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#F2D5C0', borderRadius: 8, fontSize: 11, color: '#8A3A10', fontFamily: "'Courier New', monospace" }}>
              Add {toNext} more print{toNext !== 1 ? 's' : ''} to unlock better pricing!
            </div>
          )}

          {/* Add to order */}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button onClick={addToCart} style={{ ...primaryBtn, width: 'auto', padding: '11px 28px', flex: 1 }}>
              {selectedPhotos.length > 0 ? `Add ${selectedPhotos.length} selected to order` : `Add all ${photos.length} photos to order`}
            </button>
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div style={{ ...card, marginTop: 16 }}>
              <div style={{ ...cardHead }}>
                <span style={cardLabel}>Your order — {cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: '#D97A43', fontWeight: 500 }}>${(cartTotal + 4.99).toFixed(2)}</span>
              </div>
              <div style={{ padding: '10px 16px' }}>
                {cart.slice(0, 4).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#8A6F5A' }}>
                    <span>{item.quantity}× {item.size}" — {FILTERS.find(f => f.key === item.filter)?.label}</span>
                    <span style={{ color: '#2B2A28' }}>${(getPrice(item.size, cartQty) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {cart.length > 4 && <div style={{ fontSize: 11, color: '#8A6F5A', fontFamily: "'Courier New', monospace", marginBottom: 8 }}>+{cart.length - 4} more</div>}
                <div style={{ borderTop: '0.5px solid rgba(43,42,40,0.08)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: '#8A6F5A' }}>Shipping</span><span>$4.99</span>
                </div>
                <button onClick={goToCheckout} style={accentBtn}>Proceed to checkout →</button>
              </div>
            </div>
          )}
        </div>

        {/* Individual editor */}
        {activePhoto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={cardHead}>
                <span style={cardLabel}>Preview</span>
                <button onClick={() => setActiveId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A6F5A', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ background: '#1C1A18', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: 280, display: 'block' }} />
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}><span style={cardLabel}>Filter</span></div>
              <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => updatePhoto(activePhoto.id, { filter: f.key })}
                    style={{ padding: '5px 3px', fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: '0.03em', border: `1px solid ${activePhoto.filter === f.key ? '#D97A43' : 'rgba(43,42,40,0.15)'}`, borderRadius: 5, background: activePhoto.filter === f.key ? '#F2D5C0' : '#F7F3EE', cursor: 'pointer', color: activePhoto.filter === f.key ? '#8A3A10' : '#2B2A28' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}><span style={cardLabel}>Timestamp</span></div>
              <div style={{ padding: '8px 16px 12px' }}>
                {[
                  { key: 'showDate', label: 'Date', sub: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                  { key: 'showTime', label: 'Time', sub: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
                ].map(row => (
                  <div key={row.key} style={togRow}>
                    <div>
                      <p style={{ fontSize: 13, color: '#2B2A28' }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: '#8A6F5A' }}>{row.sub}</p>
                    </div>
                    <Toggle checked={(activePhoto.stamp as any)[row.key]} onChange={() => updateStamp(activePhoto.id, { [row.key]: !(activePhoto.stamp as any)[row.key] })} />
                  </div>
                ))}
                <div style={togRow}>
                  <div>
                    <p style={{ fontSize: 13, color: '#2B2A28' }}>Location</p>
                    <p style={{ fontSize: 11, color: '#8A6F5A' }}>{activePhoto.stamp.locationText || <span onClick={detectLocation} style={{ color: '#D97A43', cursor: 'pointer' }}>Detect location</span>}</p>
                  </div>
                  <Toggle checked={activePhoto.stamp.showLocation} onChange={() => updateStamp(activePhoto.id, { showLocation: !activePhoto.stamp.showLocation })} />
                </div>
                <span style={fieldLabel}>Custom text</span>
                <input style={inputStyle} placeholder="e.g. Amalfi Coast, 2025" value={activePhoto.stamp.customText} onChange={e => updateStamp(activePhoto.id, { customText: e.target.value })} />
                <span style={fieldLabel}>Stamp style</span>
                <select style={selectStyle} value={activePhoto.stamp.style} onChange={e => updateStamp(activePhoto.id, { style: e.target.value as StampStyle })}>
                  <option value="burn">Classic burn</option>
                  <option value="overlay">Subtle overlay</option>
                  <option value="back">Back of photo</option>
                  <option value="none">No stamp</option>
                </select>
                <span style={fieldLabel}>Position</span>
                <select style={selectStyle} value={activePhoto.stamp.position} onChange={e => updateStamp(activePhoto.id, { position: e.target.value as StampPosition })}>
                  <option value="bl">Bottom left</option>
                  <option value="br">Bottom right</option>
                  <option value="tl">Top left</option>
                  <option value="tr">Top right</option>
                </select>
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}><span style={cardLabel}>Size & quantity</span></div>
              <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 10 }}>
                {SIZES.map(s => (
                  <button key={s.key} onClick={() => updatePhoto(activePhoto.id, { size: s.key })}
                    style={{ padding: '6px', fontSize: 11, border: `1px solid ${activePhoto.size === s.key ? '#D97A43' : 'rgba(43,42,40,0.15)'}`, borderRadius: 5, background: activePhoto.size === s.key ? '#F2D5C0' : '#F7F3EE', cursor: 'pointer', color: activePhoto.size === s.key ? '#8A3A10' : '#2B2A28', fontFamily: 'inherit' }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: '0 12px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#8A6F5A', flex: 1 }}>Qty</span>
                <button onClick={() => updatePhoto(activePhoto.id, { quantity: Math.max(1, activePhoto.quantity - 1) })} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(43,42,40,0.15)', background: '#F7F3EE', cursor: 'pointer', fontSize: 14 }}>−</button>
                <span style={{ fontSize: 14, fontWeight: 500, minWidth: 24, textAlign: 'center' }}>{activePhoto.quantity}</span>
                <button onClick={() => updatePhoto(activePhoto.id, { quantity: activePhoto.quantity + 1 })} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(43,42,40,0.15)', background: '#F7F3EE', cursor: 'pointer', fontSize: 14 }}>+</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
