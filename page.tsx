'use client'
import { useRouter } from 'next/navigation'

const PHOTOS = [
  { src: '/photos/photo1.jpg', rot: -4.5, leftPct: '1%',  top: 10, w: 160, h: 210, tape: 'top',    stamp: '8 · 14 · 22', cap: null,          loc: null },
  { src: '/photos/photo2.jpg', rot: 2.5,  leftPct: '18%', top: 4,  w: 150, h: 198, tape: 'corner', stamp: '9 · 18 · 23', cap: null,          loc: 'SCOTLAND' },
  { src: '/photos/photo3.jpg', rot: -2,   leftPct: '34%', top: 14, w: 158, h: 206, tape: 'top',    stamp: '7 · 04 · 23', cap: 'first beach', loc: null },
  { src: '/photos/photo4.jpg', rot: 3,    leftPct: '50%', top: 6,  w: 145, h: 188, tape: 'corner', stamp: '11 · 30 · 24', cap: null,         loc: null },
  { src: '/photos/photo5.jpg', rot: -1.5, leftPct: '65%', top: 18, w: 155, h: 202, tape: 'top',    stamp: '12 · 25 · 23', cap: 'first christmas', loc: 'HOME' },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div style={{ width: '100%' }}>
      {/* How it works bar */}
      <div style={{ background: '#EFE8DF', borderBottom: '1px solid rgba(43,42,40,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, width: '100%', overflowX: 'auto' }}>
        {[
          { n: '1', title: 'Upload', sub: 'your photos' },
          { n: '2', title: 'Stamp', sub: 'date & location' },
          { n: '3', title: 'Print', sub: 'any size' },
          { n: '4', title: 'Ship', sub: 'to your door' },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRight: i < 3 ? '1px solid rgba(43,42,40,0.1)' : 'none', flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F7F3EE', border: '1px solid rgba(43,42,40,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Courier New', monospace", fontSize: 9, color: '#8A6F5A', flexShrink: 0 }}>{step.n}</div>
            <div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2B2A28' }}>{step.title}</div>
              <div style={{ fontSize: 9, color: '#8A6F5A', fontStyle: 'italic' }}>{step.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Scrapbook */}
      <div style={{ position: 'relative', height: 420, background: '#EDE6DC', overflow: 'hidden', width: '100%' }}>
        {PHOTOS.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: p.leftPct, top: p.top,
            width: p.w, height: p.h, background: 'white',
            padding: '6px 6px 24px',
            transform: `rotate(${p.rot}deg)`,
            zIndex: i + 1,
            boxShadow: '0 2px 8px rgba(43,42,40,0.1)',
          }}>
            {p.tape === 'top' && <div style={{ position: 'absolute', width: 40, height: 11, background: 'rgba(255,235,170,0.75)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -6, left: '50%', transform: 'translateX(-50%)' }} />}
            {p.tape === 'corner' && (<>
              <div style={{ position: 'absolute', width: 15, height: 15, background: 'rgba(255,235,170,0.75)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-12deg)' }} />
              <div style={{ position: 'absolute', width: 15, height: 15, background: 'rgba(255,235,170,0.75)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(12deg)' }} />
            </>)}
            <img src={p.src} alt={p.cap ?? 'memory'} style={{ width: p.w - 12, height: p.h - 30, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: p.loc ? 28 : 27, right: p.loc ? undefined : 7, left: p.loc ? 6 : undefined, fontFamily: "'Courier New', monospace", color: '#E8841A', fontWeight: 700, fontSize: 8, lineHeight: 1.4, letterSpacing: '0.07em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>
              {p.stamp}{p.loc && <><br />{p.loc}</>}
            </div>
            {p.cap && <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{p.cap}</div>}
          </div>
        ))}

        {/* Story notecard */}
        <div style={{ position: 'absolute', left: '18%', top: 12, width: 170, background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '12px 14px', boxShadow: '0 2px 6px rgba(43,42,40,0.08)', zIndex: 20, transform: 'rotate(1.5deg)' }}>
          <div style={{ position: 'absolute', width: 32, height: 10, background: 'rgba(255,235,170,0.8)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
          <p style={{ fontSize: 8.5, lineHeight: 1.65, color: '#5C4A3A', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 5 }}>
            "nearing our daughter's first birthday, we wanted to archive all of our favorite moments — each beach trip, every christmas morning, her first steps, every ordinary tuesday that somehow felt extraordinary.
          </p>
          <p style={{ fontSize: 8.5, lineHeight: 1.65, color: '#5C4A3A', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 5 }}>
            we started printing her photos and stamping each one with the date and location it was taken. so that someday, when she holds a print in her hands, she can be taken right back to that moment.
          </p>
          <p style={{ fontSize: 8.5, lineHeight: 1.65, color: '#5C4A3A', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 5 }}>
            we can't freeze time. but we can preserve it.
          </p>
          <p style={{ fontSize: 8.5, lineHeight: 1.65, color: '#5C4A3A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>that's why archive exists."</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontFamily: "'Courier New', monospace", fontSize: 8, color: '#8A6F5A' }}>
            <svg width="10" height="9" viewBox="0 0 24 22" fill="#D97A43"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>
            the archive family
          </div>
        </div>

        {/* Feature notecard — bottom right */}
        <div style={{ position: 'absolute', right: 12, bottom: 14, width: 165, background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '12px 14px', boxShadow: '0 2px 6px rgba(43,42,40,0.08)', zIndex: 20, transform: 'rotate(-1.5deg)' }}>
          <div style={{ position: 'absolute', width: 14, height: 14, background: 'rgba(255,235,170,0.8)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-15deg)' }} />
          <div style={{ position: 'absolute', width: 14, height: 14, background: 'rgba(255,235,170,0.8)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(15deg)' }} />
          <p style={{ fontSize: 8.5, color: '#2B2A28', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.5, marginBottom: 6 }}>
            Remember the date stamp on old disposable camera prints? <em style={{ color: '#D97A43' }}>We brought it back.</em>
          </p>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: '#E8841A', fontWeight: 700, textShadow: '0 0 3px rgba(232,132,26,0.4)', marginBottom: 6, letterSpacing: '0.07em' }}>
            5 · 13 · 25 · TAMPA, FL
          </div>
          <p style={{ fontSize: 8, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
            Upload your photos, choose your stamp style, and we print and ship them straight to your door — with the exact date and location burned right onto the print.
          </p>
        </div>

        <div style={{ position: 'absolute', right: 190, bottom: 16, fontFamily: "'Courier New', monospace", fontSize: 9, color: '#8A6F5A', fontStyle: 'italic', transform: 'rotate(2deg)', zIndex: 10 }}>2022 — 2024 ✦</div>
      </div>

      {/* Hero */}
      <div style={{ background: '#F7F3EE', padding: '40px 20px 32px', textAlign: 'center', borderTop: '1px solid rgba(43,42,40,0.07)', width: '100%' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(30px, 7vw, 52px)', fontWeight: 400, color: '#2B2A28', lineHeight: 1.08, marginBottom: 24 }}>
          Every photo tells a story.<br />
          <em style={{ color: '#8A6F5A' }}>Archive yours.</em>
        </h1>
        <button onClick={() => router.push('/studio')} style={{ padding: '15px 48px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 6, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Courier New', monospace", cursor: 'pointer', width: '100%', maxWidth: 320 }}>
          Get started
        </button>
      </div>

      {/* Already have an archive */}
      <div style={{ background: '#EFE8DF', padding: '18px 20px', borderTop: '1px solid rgba(43,42,40,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#8A6F5A', fontStyle: 'italic' }}>already have an archive?</span>
        <a href="/login?provider=google" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: "'Courier New', monospace", textDecoration: 'none' }}>
          <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google
        </a>
        <a href="/login" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: "'Courier New', monospace", textDecoration: 'none' }}>
          ✉ Magic link
        </a>
      </div>
    </div>
  )
}
