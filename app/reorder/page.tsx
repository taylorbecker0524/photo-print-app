'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setWithTTL } from '@/lib/storage'

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Photo = {
  photoPath: string
  size: string
  stamp: any
  thumbnailUrl: string | null
  fileName: string
  lastOrderedAt: string
}

type Selection = { selected: boolean; size: string; quantity: number }

const SIZES = [
  { key: '4x6', label: '4×6"' },
  { key: '5x7', label: '5×7"' },
  { key: '8x10', label: '8×10"' },
  { key: 'square-4', label: '4×4"' },
  { key: 'square-5', label: '5×5"' },
  { key: 'square-8', label: '8×8"' },
]

export default function ReorderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [sel, setSel] = useState<Record<string, Selection>>({})

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      try {
        const res = await fetch('/api/my-photos', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (active && res.ok) {
          const list: Photo[] = data.photos ?? []
          setPhotos(list)
          const initial: Record<string, Selection> = {}
          for (const p of list) initial[p.photoPath] = { selected: false, size: p.size, quantity: 1 }
          setSel(initial)
        }
      } catch { /* keep empty */ }
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [router])

  const toggle = (path: string) =>
    setSel(s => ({ ...s, [path]: { ...s[path], selected: !s[path].selected } }))
  const setSize = (path: string, size: string) =>
    setSel(s => ({ ...s, [path]: { ...s[path], size, selected: true } }))
  const setQty = (path: string, delta: number) =>
    setSel(s => {
      const q = Math.max(1, (s[path]?.quantity ?? 1) + delta)
      return { ...s, [path]: { ...s[path], quantity: q, selected: true } }
    })

  const chosen = photos.filter(p => sel[p.photoPath]?.selected)
  const totalPrints = chosen.reduce((n, p) => n + (sel[p.photoPath]?.quantity ?? 1), 0)

  const continueToCheckout = () => {
    if (chosen.length === 0) return
    const cart = chosen.map(p => {
      const s = sel[p.photoPath]
      return {
        size: s.size,
        quantity: s.quantity,
        stamp: p.stamp ?? null,
        fileName: p.fileName,
        photoPath: p.photoPath,
      }
    })
    setWithTTL('print-cart', cart)
    router.push('/checkout')
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: '#8A6F5A', fontSize: 14 }}>Loading your photos…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 120px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A6F5A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          reorder
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 400, color: '#2B2A28', lineHeight: 1.05 }}>
          reorder your <em style={{ fontStyle: 'italic', color: '#8A6F5A' }}>prints</em>
        </h1>
        <p style={{ fontSize: 14, color: '#8A6F5A', marginTop: 8 }}>
          Pick from photos you've ordered before, set the size and quantity, and check out. No re-uploading needed.
        </p>
      </div>

      {photos.length === 0 ? (
        <div style={{ background: '#EFE8DF', border: '0.5px solid rgba(43,42,40,0.1)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, color: '#2B2A28', marginBottom: 8 }}>Nothing to reorder yet</p>
          <p style={{ fontSize: 13, color: '#8A6F5A', marginBottom: 20 }}>Once you place your first order, your photos will show up here for one-tap reordering.</p>
          <button onClick={() => router.push('/studio')} style={{ padding: '11px 24px', background: '#D97A43', color: '#F7F3EE', border: 'none', borderRadius: 8, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}>
            Start printing
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {photos.map(p => {
            const s = sel[p.photoPath] ?? { selected: false, size: p.size, quantity: 1 }
            return (
              <div
                key={p.photoPath}
                style={{
                  background: '#EFE8DF',
                  border: s.selected ? '2px solid #D97A43' : '0.5px solid rgba(43,42,40,0.12)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'border-color .15s',
                }}
              >
                <button
                  onClick={() => toggle(p.photoPath)}
                  style={{ display: 'block', width: '100%', aspectRatio: '1', background: '#E8DECC', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}
                >
                  {p.thumbnailUrl && (
                    <img src={p.thumbnailUrl} alt={p.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: s.selected ? 1 : 0.92 }} />
                  )}
                  <span style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: s.selected ? '#D97A43' : 'rgba(247,243,238,0.85)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: s.selected ? 'none' : '1px solid rgba(43,42,40,0.2)' }}>
                    {s.selected ? '✓' : ''}
                  </span>
                </button>

                <div style={{ padding: '12px 12px 14px' }}>
                  <label style={{ fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A', display: 'block', marginBottom: 4 }}>Size</label>
                  <select
                    value={s.size}
                    onChange={e => setSize(p.photoPath, e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid rgba(43,42,40,0.15)', borderRadius: 8, background: '#F7F3EE', color: '#2B2A28', fontFamily: 'inherit', outline: 'none', marginBottom: 10 }}
                  >
                    {SIZES.map(sz => <option key={sz.key} value={sz.key}>{sz.label}</option>)}
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A6F5A' }}>Qty</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setQty(p.photoPath, -1)} style={qtyBtn}>−</button>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: '#2B2A28', minWidth: 18, textAlign: 'center' }}>{s.quantity}</span>
                      <button onClick={() => setQty(p.photoPath, 1)} style={qtyBtn}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky action bar */}
      {chosen.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#2B2A28', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' }}>
          <div style={{ color: '#F7F3EE' }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22 }}>{chosen.length}</span>
            <span style={{ fontSize: 13, color: 'rgba(247,243,238,0.7)', marginLeft: 6 }}>
              {chosen.length === 1 ? 'photo' : 'photos'} · {totalPrints} {totalPrints === 1 ? 'print' : 'prints'}
            </span>
          </div>
          <button onClick={continueToCheckout} style={{ padding: '13px 28px', background: '#D97A43', color: '#F7F3EE', border: 'none', borderRadius: 10, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>
            Continue to checkout →
          </button>
        </div>
      )}
    </div>
  )
}

const qtyBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(43,42,40,0.2)',
  background: '#F7F3EE', color: '#2B2A28', fontSize: 16, lineHeight: 1, cursor: 'pointer',
  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
