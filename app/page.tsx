'use client'
import { useRouter } from 'next/navigation'

const PHOTOS = [
  { rot: -3.5, left: 6, top: 10, w: 200, h: 258, bg: '#B8956A', tape: 'top', stamp: '7 · 04 · 23', cap: 'summer', loc: null },
  { rot: 2.2, left: 198, top: 4, w: 185, h: 240, bg: '#7B6B55', tape: 'corner', stamp: '12 · 25 · 23', cap: 'first christmas', loc: 'HOME' },
  { rot: -1.8, left: 370, top: 14, w: 158, h: 205, bg: '#6B7B6B', tape: 'top', stamp: '9 · 18 · 23', cap: 'highlands trip', loc: 'SCOTLAND' },
  { rot: 2.8, left: 20, top: 248, w: 178, h: 215, bg: '#C9A882', tape: 'corner', stamp: '11 · 30 · 24', cap: 'friday nights', loc: null },
  { rot: -2, left: 196, top: 260, w: 220, h: 185, bg: '#7A8B9A', tape: 'top', stamp: '8 · 14 · 22', cap: 'first beach day', loc: null },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div>
      {/* Scrapbook hero */}
      <div style={{ position: 'relative', height: 440, background: '#EDE6DC', overflow: 'hidden' }}>
        {PHOTOS.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: p.left, top: p.top,
            width: p.w, height: p.h,
            background: 'white',
            padding: '7px 7px 28px',
            transform: `rotate(${p.rot}deg)`,
            zIndex: i + 1,
            boxShadow: '0 2px 8px rgba(43,42,40,0.1)',
          }}>
            {p.tape === 'top' && (
              <div style={{ position: 'absolute', width: 44, height: 12, background: 'rgba(255,235,170,0.72)', border: '0.5px solid rgba(200,165,80,0.25)', borderRadius: 1, top: -6, left: '50%', transform: 'translateX(-50%)' }} />
            )}
            {p.tape === 'corner' && (<>
              <div style={{ position: 'absolute', width: 17, height: 17, background: 'rgba(255,235,170,0.72)', border: '0.5px solid rgba(200,165,80,0.25)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-12deg)' }} />
              <div style={{ position: 'absolute', width: 17, height: 17, background: 'rgba(255,235,170,0.72)', border: '0.5px solid rgba(200,165,80,0.25)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(12deg)' }} />
            </>)}
            <div style={{ width: p.w - 14, height: p.h - 35, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "'Courier New', monospace", color: '#E8841A', fontWeight: 700, fontSize: p.loc ? 9 : 10, position: 'absolute', bottom: 31, right: p.loc ? undefined : 7, left: p.loc ? 6 : undefined, lineHeight: 1.35, letterSpacing: '0.07em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>
                {p.stamp}{p.loc && <><br />{p.loc}</>}
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{p.cap}</div>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 188, top: 222, fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A', fontStyle: 'italic', transform: 'rotate(-4deg)', zIndex: 10 }}>memories ✦</div>
        <div style={{ position: 'absolute', right: 16, top: 242, fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A6F5A', fontStyle: 'italic', transform: 'rotate(3deg)', zIndex: 10 }}>2022 — 2024</div>
      </div>

      {/* Hero */}
      <div style={{ background: '#F7F3EE', padding: '40px 24px 32px', textAlign: 'center', borderTop: '1px solid rgba(43,42,40,0.07)' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 400, color: '#2B2A28', lineHeight: 1.08, marginBottom: 24 }}>
          Every photo tells a story.<br />
          <em style={{ color: '#8A6F5A', fontStyle: 'italic' }}>Archive yours.</em>
        </h1>
        <button
          onClick={() => router.push('/studio')}
          style={{ padding: '14px 48px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 6, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Courier New', monospace", cursor: 'pointer' }}>
          Get started
        </button>
      </div>

      {/* Already have an archive */}
      <div style={{ background: '#EFE8DF', padding: '20px 24px', borderTop: '1px solid rgba(43,42,40,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8A6F5A', fontStyle: 'italic', marginRight: 4 }}>already have an archive?</span>
        <a href="/login?provider=google" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: "'Courier New', monospace", textDecoration: 'none', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </a>
        <span style={{ fontSize: 10, color: '#C4B5A5' }}>·</span>
        <a href="/login?provider=apple" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1C1A18', color: '#F7F3EE', border: '1px solid #1C1A18', borderRadius: 5, fontSize: 11, fontFamily: "'Courier New', monospace", textDecoration: 'none' }}>
          <svg width="11" height="13" viewBox="0 0 814 1000" fill="white"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.8 0 129.5 46.4 173.1 46.4 42.8 0 109.8-49 192.3-49 30.5 0 110.9 2.6 173.1 78.4zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>
          Continue with Apple
        </a>
        <span style={{ fontSize: 10, color: '#C4B5A5' }}>·</span>
        <a href="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: "'Courier New', monospace", textDecoration: 'none' }}>
          ✉ Magic link
        </a>
      </div>
    </div>
  )
}
