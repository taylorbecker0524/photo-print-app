'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Filter = 'original' | 'film' | 'sepia' | 'bw' | 'faded' | 'vivid' | 'cool'
type StampStyle = 'burn' | 'overlay' | 'back' | 'none'
type StampPos = 'bl' | 'br' | 'tl' | 'tr'

type StampConfig = {
  showDate: boolean
  showTime: boolean
  showLocation: boolean
  locationText: string
  customText: string
  style: StampStyle
  position: StampPos
  fontSize: 'sm' | 'md' | 'lg'
  capturedAt: string | null
  hasExifDate: boolean
}

type Photo = {
  id: string
  file: File
  url: string
  sessionId: string
  filter: Filter
  stamp: StampConfig
  size: string
}

type OrderItem = {
  id: string
  photoId: string
  url: string
  fileName: string
  filter: Filter
  stamp: StampConfig
  size: string
  quantity: number
}

type Session = {
  id: string
  name: string
  date: Date
  photoIds: string[]
  isRenaming: boolean
}

const SIZES = [
  { key: '4x6', label: '4×6"', price: 0.99 },
  { key: '5x7', label: '5×7"', price: 1.49 },
  { key: '8x10', label: '8×10"', price: 2.49 },
  { key: 'square-4', label: '4×4"', price: 1.09 },
  { key: 'square-5', label: '5×5"', price: 1.49 },
  { key: 'square-8', label: '8×8"', price: 2.29 },
]

const BULK_TIERS = [
  { minQty: 100, mult: 0.29 },
  { minQty: 50, mult: 0.39 },
  { minQty: 20, mult: 0.59 },
  { minQty: 10, mult: 0.79 },
  { minQty: 1, mult: 1.00 },
]

const FILTERS: { key: Filter; label: string; css: string }[] = [
  { key: 'original', label: 'Original', css: 'none' },
  { key: 'film', label: 'Film', css: 'sepia(0.2) contrast(1.1) saturate(0.9) brightness(0.95)' },
  { key: 'sepia', label: 'Sepia', css: 'sepia(0.85) contrast(1.05)' },
  { key: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { key: 'faded', label: 'Faded', css: 'contrast(0.85) saturate(0.7) brightness(1.05)' },
  { key: 'vivid', label: 'Vivid', css: 'saturate(1.4) contrast(1.1)' },
  { key: 'cool', label: 'Cool', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.02)' },
]

function getFilterCss(f: Filter) { return FILTERS.find(x => x.key === f)?.css ?? 'none' }
function getBasePrice(size: string) { return SIZES.find(s => s.key === size)?.price ?? 0.99 }
function getPrice(size: string, totalQty: number) {
  const base = getBasePrice(size)
  const tier = BULK_TIERS.find(t => totalQty >= t.minQty) ?? BULK_TIERS[BULK_TIERS.length - 1]
  return base * tier.mult
}
function formatSessionName(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

async function readExifDate(file: File): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer
        const view = new DataView(buf)
        if (view.getUint16(0) !== 0xFFD8) { resolve(null); return }
        const arr = Array.from(new Uint8Array(buf, 0, Math.min(65536, buf.byteLength)))
        for (let i = 0; i < arr.length - 19; i++) {
          if (arr[i] >= 49 && arr[i] <= 50 &&
            arr[i + 4] === 58 && arr[i + 7] === 58 &&
            arr[i + 10] === 32 && arr[i + 13] === 58 && arr[i + 16] === 58) {
            const dateStr = arr.slice(i, i + 19).map(c => String.fromCharCode(c)).join('')
            try {
              const [datePart, timePart] = dateStr.split(' ')
              const [y, m, d] = datePart.split(':')
              resolve(new Date(`${y}-${m}-${d}T${timePart}`).toISOString())
              return
            } catch { break }
          }
        }
        resolve(null)
      } catch { resolve(null) }
    }
    reader.readAsArrayBuffer(file.slice(0, 65536))
  })
}

const DEFAULT_STAMP: StampConfig = {
  showDate: false, showTime: false, showLocation: false,
  locationText: '', customText: '', style: 'burn',
  position: 'bl', fontSize: 'sm', capturedAt: null, hasExifDate: false,
}

const card: React.CSSProperties = { background: '#EFE8DF', border: '0.5px solid rgba(43,42,40,0.1)', borderRadius: 12, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '10px 16px', borderBottom: '0.5px solid rgba(43,42,40,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const mono: React.CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A6F5A' }
const fieldLabel: React.CSSProperties = { ...mono, display: 'block', marginBottom: 4, marginTop: 10 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 6, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none' }
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' as const }
const togRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(43,42,40,0.06)' }
const primaryBtn: React.CSSProperties = { padding: '11px 20px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'inherit', cursor: 'pointer' }
const accentBtn: React.CSSProperties = { ...primaryBtn, background: '#D97A43' }
const ghostBtn: React.CSSProperties = { padding: '7px 14px', background: 'transparent', color: '#2B2A28', border: '1px solid rgba(43,42,40,0.2)', borderRadius: 6, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: 'inherit', cursor: 'pointer' }

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ position: 'relative', width: 34, height: 18, borderRadius: 20, border: 'none', cursor: 'pointer', background: checked ? '#D97A43' : 'rgba(43,42,40,0.15)', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, width: 14, height: 14, background: '#F7F3EE', borderRadius: '50%', transition: 'left 0.2s', left: checked ? 17 : 2 }} />
    </button>
  )
}

export default function StudioPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)

  const activePhoto = photos.find(p => p.id === activePhotoId)
  const totalQty = orderItems.reduce((s, i) => s + i.quantity, 0)
  const orderTotal = orderItems.reduce((s, i) => s + getPrice(i.size, totalQty) * i.quantity, 0)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    const sessionId = Math.random().toString(36).slice(2)
    const sessionDate = new Date()
    const newPhotoIds: string[] = []
    const newPhotos: Photo[] = await Promise.all(
      Array.from(files).filter(f => f.type.startsWith('image/')).map(async (f) => {
        const id = Math.random().toString(36).slice(2)
        newPhotoIds.push(id)
        const capturedAt = await readExifDate(f)
        const hasExifDate = !!capturedAt
        return {
          id, file: f, url: URL.createObjectURL(f), sessionId,
          filter: 'original' as Filter,
          stamp: { ...DEFAULT_STAMP, capturedAt, hasExifDate, showDate: hasExifDate },
          size: '4x6',
        }
      })
    )
    setPhotos(prev => [...prev, ...newPhotos])
    setSessions(prev => [
      { id: sessionId, name: formatSessionName(sessionDate), date: sessionDate, photoIds: newPhotoIds, isRenaming: false },
      ...prev,
    ])
  }, [])

  useEffect(() => {
    if (!activePhoto) return
    const img = new Image()
    img.onload = () => setLoadedImg(img)
    img.src = activePhoto.url
  }, [activePhotoId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !loadedImg || !activePhoto) return
    const maxW = Math.min(canvas.parentElement?.clientWidth ?? 700, 700)
    const maxH = 480
    let cw = Math.min(maxW, loadedImg.naturalWidth)
    let ch = (cw / loadedImg.naturalWidth) * loadedImg.naturalHeight
    if (ch > maxH) { ch = maxH; cw = (ch / loadedImg.naturalHeight) * loadedImg.naturalWidth }
    canvas.width = Math.round(cw); canvas.height = Math.round(ch)
    const ctx = canvas.getContext('2d')!
    ctx.filter = getFilterCss(activePhoto.filter)
    ctx.drawImage(loadedImg, 0, 0, cw, ch)
    ctx.filter = 'none'
    const { stamp } = activePhoto
    if (stamp.style === 'none' || stamp.style === 'back') return
    const lines: string[] = []
    if (stamp.showDate && stamp.capturedAt) {
      const d = new Date(stamp.capturedAt)
      lines.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
      if (stamp.showTime) lines.push(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    }
    if (stamp.showLocation && stamp.locationText) lines.push(stamp.locationText)
    if (stamp.customText) lines.push(stamp.customText)
    if (!lines.length) return
    const fs = stamp.fontSize === 'sm' ? cw * 0.022 : stamp.fontSize === 'lg' ? cw * 0.04 : cw * 0.03
    ctx.font = `bold ${Math.round(fs)}px 'Courier New', monospace`
    const pad = cw * 0.025, lineH = fs * 1.45
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
      ctx.fillStyle = 'rgba(247,243,238,0.65)'; ctx.fillRect(bx, by, boxW, boxH)
      ctx.fillStyle = 'rgba(43,42,40,0.85)'
      lines.forEach((line, i) => ctx.fillText(line, bx + pad * 0.8, by + pad * 0.4 + (i + 1) * lineH - lineH * 0.2))
    }
  }, [loadedImg, activePhoto?.stamp, activePhoto?.filter])

  const updatePhoto = (id: string, updates: Partial<Photo>) => setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  const updateStamp = (id: string, updates: Partial<StampConfig>) => setPhotos(prev => prev.map(p => p.id === id ? { ...p, stamp: { ...p.stamp, ...updates } } : p))

  const detectLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json()).then(d => {
          const city = d.address.city || d.address.town || ''
          const state = d.address.state || ''
          const loc = city && state ? `${city}, ${state}` : d.display_name.split(',')[0]
          if (activePhotoId) updateStamp(activePhotoId, { locationText: loc, showLocation: true })
        })
    })
  }, [activePhotoId])

  const addToOrder = (photo: Photo) => {
    setOrderItems(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      photoId: photo.id, url: photo.url, fileName: photo.file.name,
      filter: photo.filter, stamp: { ...photo.stamp }, size: photo.size, quantity: 1,
    }])
  }

  const updateOrderQty = (itemId: string, delta: number) => {
    setOrderItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0))
  }

  const photoOrderCount = (photoId: string) => orderItems.filter(i => i.photoId === photoId).reduce((s, i) => s + i.quantity, 0)

  const goToCheckout = () => {
    sessionStorage.setItem('print-cart', JSON.stringify(orderItems.map(i => ({ size: i.size, quantity: i.quantity, stamp: i.stamp, filter: i.filter, fileName: i.fileName }))))
    router.push('/checkout')
  }

  if (photos.length === 0) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, color: '#2B2A28', marginBottom: 6, textAlign: 'center' }}>Upload your photos</h1>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#8A6F5A', marginBottom: 8 }}>Drop as many as you like — choose which ones to print after</p>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#C4B5A5', marginBottom: 24, fontFamily: "'Courier New', monospace" }}>We'll automatically read the date & location from your photos</p>
        <div style={{ background: '#EFE8DF', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: 12, color: '#8A6F5A', fontStyle: 'italic' }}>💡 Create a free archive to save your photos and track orders easily</p>
          <a href="/login" style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#D97A43', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Sign in →</a>
        </div>
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }} onClick={() => fileInputRef.current?.click()}
          style={{ border: '1.5px dashed rgba(43,42,40,0.2)', borderRadius: 20, background: '#EFE8DF', padding: '56px 32px', textAlign: 'center', cursor: 'pointer' }}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F7F3EE', border: '1px solid rgba(43,42,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A6F5A" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          </div>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, color: '#2B2A28', marginBottom: 6 }}>Drop your photos here</p>
          <p style={{ fontSize: 13, color: '#8A6F5A' }}>or <span style={{ color: '#D97A43', textDecoration: 'underline', cursor: 'pointer' }}>browse your camera roll</span></p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 30, fontWeight: 400, color: '#2B2A28' }}>Your photos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={addMoreRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <button onClick={() => addMoreRef.current?.click()} style={ghostBtn}>+ Add more photos</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activePhotoId ? '1fr 300px' : '1fr', gap: 28 }}>
        <div>
          {sessions.map(session => {
            const sessionPhotos = photos.filter(p => session.photoIds.includes(p.id))
            if (!sessionPhotos.length) return null
            return (
              <div key={session.id} style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  {session.isRenaming ? (
                    <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => setSessions(prev => prev.map(s => s.id === session.id ? { ...s, name: renameValue || s.name, isRenaming: false } : s))}
                      onKeyDown={e => { if (e.key === 'Enter') setSessions(prev => prev.map(s => s.id === session.id ? { ...s, name: renameValue || s.name, isRenaming: false } : s)) }}
                      autoFocus style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, color: '#2B2A28', border: 'none', borderBottom: '1px solid #D97A43', background: 'transparent', outline: 'none', padding: '2px 4px', minWidth: 200 }} />
                  ) : (
                    <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, color: '#2B2A28' }}>{session.name}</h3>
                  )}
                  <button onClick={() => { setRenameValue(session.name); setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isRenaming: true } : s)) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#8A6F5A', fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', textDecoration: 'underline' }}>rename</button>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#C4B5A5' }}>{sessionPhotos.length} photos</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {sessionPhotos.map(photo => {
                    const inOrder = photoOrderCount(photo.id)
                    const isActive = photo.id === activePhotoId
                    return (
                      <div key={photo.id} style={{ position: 'relative' }}>
                        <div onClick={() => setActivePhotoId(photo.id === activePhotoId ? null : photo.id)}
                          style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: `2px solid ${isActive ? '#D97A43' : 'transparent'}`, cursor: 'pointer', position: 'relative' }}>
                          <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: getFilterCss(photo.filter) }} />
                          {photo.stamp.showDate && photo.stamp.capturedAt && photo.stamp.style === 'burn' && (
                            <div style={{ position: 'absolute', bottom: 4, right: 4, fontFamily: "'Courier New', monospace", fontSize: 7, color: '#E8841A', fontWeight: 700, textShadow: '0 0 2px rgba(232,132,26,0.5)' }}>
                              {new Date(photo.stamp.capturedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                            </div>
                          )}
                        </div>
                        {inOrder > 0 && (
                          <div style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, background: '#D97A43', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', border: '2px solid #F7F3EE', zIndex: 10 }}>{inOrder}</div>
                        )}
                        <button onClick={() => addToOrder(photo)}
                          style={{ width: '100%', marginTop: 5, padding: '5px', background: inOrder > 0 ? '#F2D5C0' : '#EFE8DF', border: `0.5px solid ${inOrder > 0 ? 'rgba(217,122,67,0.3)' : 'rgba(43,42,40,0.15)'}`, borderRadius: 5, fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: '0.03em', color: inOrder > 0 ? '#8A3A10' : '#8A6F5A', cursor: 'pointer' }}>
                          {inOrder > 0 ? `+ add again` : '+ add to order'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Preview */}
          {activePhoto && (
            <div style={{ marginTop: 8, ...card }}>
              <div style={cardHead}>
                <span style={mono}>Preview</span>
                <button onClick={() => setActivePhotoId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A6F5A', fontSize: 18 }}>×</button>
              </div>
              <div style={{ background: '#1C1A18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: 480, display: 'block', borderRadius: 3 }} />
              </div>
            </div>
          )}

          {/* IN YOUR ORDER */}
          {orderItems.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 30, fontWeight: 400, color: '#2B2A28' }}>In your order</h2>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A6F5A' }}>{totalQty} prints</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                {orderItems.map((item, idx) => (
                  <div key={item.id} style={card}>
                    <div style={{ position: 'relative' }}>
                      <img src={item.url} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block', filter: getFilterCss(item.filter) }} />
                      <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(43,42,40,0.72)', color: '#F7F3EE', borderRadius: 4, padding: '2px 7px', fontFamily: "'Courier New', monospace", fontSize: 10 }}>
                        #{idx + 1}
                      </div>
                      {item.stamp.showDate && item.stamp.capturedAt && item.stamp.style === 'burn' && (
                        <div style={{ position: 'absolute', bottom: 5, right: 5, fontFamily: "'Courier New', monospace", fontSize: 8, color: '#E8841A', fontWeight: 700, textShadow: '0 0 2px rgba(232,132,26,0.5)' }}>
                          {new Date(item.stamp.capturedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <select value={item.size} onChange={e => setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, size: e.target.value } : i))}
                        style={{ ...selectStyle, fontSize: 12, padding: '5px 8px', marginBottom: 8 }}>
                        {SIZES.map(s => <option key={s.key} value={s.key}>{s.label} — ${getPrice(s.key, totalQty).toFixed(2)}/ea</option>)}
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => updateOrderQty(item.id, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(43,42,40,0.2)', background: '#F7F3EE', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                          <button onClick={() => updateOrderQty(item.id, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(43,42,40,0.2)', background: '#F7F3EE', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 500, color: '#2B2A28' }}>${(getPrice(item.size, totalQty) * item.quantity).toFixed(2)}</span>
                          <button onClick={() => setOrderItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4B5A5', fontSize: 16 }}>×</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky checkout */}
              <div style={{ position: 'sticky', bottom: 20, marginTop: 20, background: '#2B2A28', borderRadius: 12, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 32px rgba(43,42,40,0.2)', zIndex: 50 }}>
                <div>
                  <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: 'rgba(247,243,238,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{totalQty} prints · $4.99 shipping</p>
                  <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, color: '#F7F3EE', fontWeight: 400 }}>${(orderTotal + 4.99).toFixed(2)}</p>
                </div>
                <button onClick={goToCheckout} style={{ ...accentBtn, fontSize: 13, padding: '13px 32px' }}>Proceed to checkout →</button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        {activePhoto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!activePhoto.stamp.hasExifDate && (
              <div style={{ background: '#FAEEDA', border: '1px solid rgba(186,117,23,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 15, color: '#854F0B', marginBottom: 4 }}>No date found in this photo</p>
                <p style={{ fontSize: 11, color: '#8A6F5A', marginBottom: 10 }}>Add the date this photo was taken:</p>
                <input type="datetime-local" onChange={e => { if (e.target.value) updateStamp(activePhoto.id, { capturedAt: new Date(e.target.value).toISOString(), hasExifDate: true, showDate: true }) }}
                  style={{ ...inputStyle, fontSize: 12 }} />
              </div>
            )}

            <div style={card}>
              <div style={cardHead}><span style={mono}>Filter</span></div>
              <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => updatePhoto(activePhoto.id, { filter: f.key })}
                    style={{ padding: '5px 3px', fontSize: 10, fontFamily: "'Courier New', monospace", border: `1px solid ${activePhoto.filter === f.key ? '#D97A43' : 'rgba(43,42,40,0.15)'}`, borderRadius: 5, background: activePhoto.filter === f.key ? '#F2D5C0' : '#F7F3EE', cursor: 'pointer', color: activePhoto.filter === f.key ? '#8A3A10' : '#2B2A28' }}>{f.label}</button>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}><span style={mono}>Timestamp</span></div>
              <div style={{ padding: '8px 16px 12px' }}>
                <div style={togRow}>
                  <div>
                    <p style={{ fontSize: 13, color: '#2B2A28' }}>Date</p>
                    <p style={{ fontSize: 11, color: '#8A6F5A' }}>{activePhoto.stamp.capturedAt ? new Date(activePhoto.stamp.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date found'}</p>
                  </div>
                  <Toggle checked={activePhoto.stamp.showDate && !!activePhoto.stamp.capturedAt} onChange={() => updateStamp(activePhoto.id, { showDate: !activePhoto.stamp.showDate })} />
                </div>
                <div style={togRow}>
                  <div>
                    <p style={{ fontSize: 13, color: '#2B2A28' }}>Time</p>
                    <p style={{ fontSize: 11, color: '#8A6F5A' }}>{activePhoto.stamp.capturedAt ? new Date(activePhoto.stamp.capturedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</p>
                  </div>
                  <Toggle checked={activePhoto.stamp.showTime && !!activePhoto.stamp.capturedAt} onChange={() => updateStamp(activePhoto.id, { showTime: !activePhoto.stamp.showTime })} />
                </div>
                <div style={togRow}>
                  <div>
                    <p style={{ fontSize: 13, color: '#2B2A28' }}>Location</p>
                    <p style={{ fontSize: 11, color: '#8A6F5A' }}>{activePhoto.stamp.locationText || <span onClick={detectLocation} style={{ color: '#D97A43', cursor: 'pointer', textDecoration: 'underline' }}>Detect my location</span>}</p>
                  </div>
                  <Toggle checked={activePhoto.stamp.showLocation && !!activePhoto.stamp.locationText} onChange={() => updateStamp(activePhoto.id, { showLocation: !activePhoto.stamp.showLocation })} />
                </div>
                <span style={fieldLabel}>Custom text / notes</span>
                <input style={inputStyle} placeholder="e.g. Amalfi Coast, 2025" value={activePhoto.stamp.customText} onChange={e => updateStamp(activePhoto.id, { customText: e.target.value })} />
                <span style={fieldLabel}>Stamp style</span>
                <select style={selectStyle} value={activePhoto.stamp.style} onChange={e => updateStamp(activePhoto.id, { style: e.target.value as StampStyle })}>
                  <option value="burn">Classic burn</option>
                  <option value="overlay">Subtle overlay</option>
                  <option value="back">Back of photo</option>
                  <option value="none">No stamp</option>
                </select>
                {activePhoto.stamp.style !== 'back' && activePhoto.stamp.style !== 'none' && (
                  <>
                    <span style={fieldLabel}>Position</span>
                    <select style={selectStyle} value={activePhoto.stamp.position} onChange={e => updateStamp(activePhoto.id, { position: e.target.value as StampPos })}>
                      <option value="bl">Bottom left</option>
                      <option value="br">Bottom right</option>
                      <option value="tl">Top left</option>
                      <option value="tr">Top right</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}><span style={mono}>Default size</span></div>
              <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {SIZES.map(s => (
                  <button key={s.key} onClick={() => updatePhoto(activePhoto.id, { size: s.key })}
                    style={{ padding: '6px', fontSize: 11, border: `1px solid ${activePhoto.size === s.key ? '#D97A43' : 'rgba(43,42,40,0.15)'}`, borderRadius: 5, background: activePhoto.size === s.key ? '#F2D5C0' : '#F7F3EE', cursor: 'pointer', color: activePhoto.size === s.key ? '#8A3A10' : '#2B2A28', fontFamily: 'inherit' }}>{s.label}</button>
                ))}
              </div>
            </div>

            <button onClick={() => addToOrder(activePhoto)} style={{ ...accentBtn, width: '100%', textAlign: 'center' }}>
              Add to order with these settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
