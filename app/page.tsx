'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const STORY = [
  '"nearing our daughter\'s first birthday, we wanted to archive all of our favorite moments — each beach trip, every christmas morning, her first steps, every ordinary tuesday that somehow felt extraordinary.',
  'we started printing her photos and stamping each one with the date and location it was taken. so that someday, when she holds a print in her hands, she can be taken right back to that moment.',
  'we can\'t freeze time. but we can preserve it.',
  'that\'s why archive exists."'
]

export default function HomePage() {
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 680)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const HeartSig = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontFamily: 'Courier New, monospace', fontSize: 9, color: '#8A6F5A' }}>
      <svg width="10" height="9" viewBox="0 0 24 22" fill="#D97A43"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" /></svg>
      the archive family
    </div>
  )

  const tapeTop = () => <div style={{ position: 'absolute', width: 36, height: 10, background: 'rgba(255,235,170,0.78)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
  const cornerTape = () => (<>
    <div style={{ position: 'absolute', width: 15, height: 15, background: 'rgba(255,235,170,0.78)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-12deg)' }} />
    <div style={{ position: 'absolute', width: 15, height: 15, background: 'rgba(255,235,170,0.78)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(12deg)' }} />
  </>)

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>

      {/* How it works bar */}
      <div style={{ background: '#EFE8DF', borderBottom: '1px solid rgba(43,42,40,0.08)', padding: '10px 0', width: '100%', display: 'flex', alignItems: 'center' }}>
        {[
          { n: '1', title: 'Upload', sub: 'photos' },
          { n: '2', title: 'Stamp', sub: 'date + location' },
          { n: '3', title: 'Print', sub: 'any size' },
          { n: '4', title: 'Ship', sub: 'to your door' },
        ].map((step, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRight: i < 3 ? '1px solid rgba(43,42,40,0.1)' : 'none' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F7F3EE', border: '1px solid rgba(43,42,40,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Courier New, monospace', fontSize: 9, color: '#8A6F5A', flexShrink: 0 }}>{step.n}</div>
            <div>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2B2A28' }}>{step.title}</div>
              <div style={{ fontSize: 9, color: '#8A6F5A', fontStyle: 'italic' }}>{step.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP scrapbook */}
      {!isMobile && (
        <div style={{ position: 'relative', height: 460, background: '#EDE6DC', overflow: 'hidden', width: '100%' }}>

          {/* TOP ROW */}

          {/* Photo 1 — baby, far left partially cut */}
          <div style={{ position: 'absolute', left: -10, top: 10, zIndex: 3, background: 'white', padding: '6px 6px 22px', transform: 'rotate(-4deg)', boxShadow: '0 2px 8px rgba(43,42,40,0.1)' }}>
            {tapeTop()}
            <img src="/photos/photo1.jpg" alt="memory" style={{ width: 155, height: 200, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 25, right: 7, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 8, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>8 - 14 - 22</div>
          </div>

          {/* Story notecard — overlaps photo 1 */}
          <div style={{ position: 'absolute', left: 130, top: 10, width: 205, background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '13px 15px', boxShadow: '0 2px 6px rgba(43,42,40,0.08)', zIndex: 20, transform: 'rotate(1deg)' }}>
            <div style={{ position: 'absolute', width: 34, height: 10, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
            {STORY.map((p, i) => (
              <p key={i} style={{ fontSize: 9, lineHeight: 1.65, color: '#5C4A3A', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: i < STORY.length - 1 ? 5 : 0 }}>{p}</p>
            ))}
            <HeartSig />
          </div>

          {/* Photo 2 — Scotland, stamp top right */}
          <div style={{ position: 'absolute', left: '26%', top: 6, zIndex: 2, background: 'white', padding: '6px 6px 22px', transform: 'rotate(2.5deg)', boxShadow: '0 2px 8px rgba(43,42,40,0.1)' }}>
            {tapeTop()}
            <img src="/photos/photo2.jpg" alt="Scotland" style={{ width: 158, height: 202, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', top: 8, right: 7, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 8, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>9 - 18 - 23<br />SCOTLAND</div>
          </div>

          {/* Photo 3 — beach, center top */}
          <div style={{ position: 'absolute', left: '50%', top: 14, zIndex: 3, background: 'white', padding: '6px 6px 22px', transform: 'rotate(-2deg)', boxShadow: '0 2px 8px rgba(43,42,40,0.1)' }}>
            {tapeTop()}
            <img src="/photos/photo3.jpg" alt="first beach" style={{ width: 160, height: 206, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 25, right: 7, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 8, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>7 - 04 - 23</div>
            <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>first beach</div>
          </div>

          {/* BOTTOM ROW */}

          {/* Photo 4 — dinner, bottom left */}
          <div style={{ position: 'absolute', left: '3%', top: 258, zIndex: 4, background: 'white', padding: '6px 6px 22px', transform: 'rotate(3deg)', boxShadow: '0 2px 8px rgba(43,42,40,0.1)' }}>
            {cornerTape()}
            <img src="/photos/photo4.jpg" alt="memory" style={{ width: 152, height: 188, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 25, right: 7, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 8, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>11 - 30 - 24</div>
          </div>

          {/* Photo 5 — B&W christmas, bottom center-right */}
          <div style={{ position: 'absolute', left: '26%', top: 265, zIndex: 3, background: 'white', padding: '6px 6px 22px', transform: 'rotate(-2deg)', boxShadow: '0 2px 8px rgba(43,42,40,0.1)' }}>
            {tapeTop()}
            <img src="/photos/photo5.jpg" alt="first christmas" style={{ width: 155, height: 192, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 25, left: 7, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 8, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>12 - 25 - 23<br />Kennett Square, PA</div>
            <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>first christmas</div>
          </div>

          {/* Feature notecard — center bottom where arrow pointed */}
          <div style={{ position: 'absolute', left: '50%', bottom: 16, width: 188, background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '12px 14px', boxShadow: '0 2px 6px rgba(43,42,40,0.08)', zIndex: 25, transform: 'rotate(1.5deg)' }}>
            <div style={{ position: 'absolute', width: 13, height: 13, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-15deg)' }} />
            <div style={{ position: 'absolute', width: 13, height: 13, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(15deg)' }} />
            <p style={{ fontSize: 8.5, color: '#2B2A28', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.5, marginBottom: 6 }}>
              Remember the date stamp on old disposable camera prints? <em style={{ color: '#D97A43' }}>We brought it back.</em>
            </p>
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 9, color: '#E8841A', fontWeight: 700, marginBottom: 6, letterSpacing: '0.07em' }}>5 - 13 - 25 - TAMPA, FL</div>
            <p style={{ fontSize: 7.5, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
              Upload your photos, choose your stamp style, and we print and ship them to your door.
            </p>
          </div>

          <div style={{ position: 'absolute', right: 20, bottom: 16, fontFamily: 'Courier New, monospace', fontSize: 9, color: '#8A6F5A', fontStyle: 'italic', transform: 'rotate(2deg)', zIndex: 10 }}>2022 - 2024</div>
        </div>
      )}

      {/* MOBILE scrapbook */}
      {isMobile && (
        <div style={{ background: '#EDE6DC', width: '100%', paddingBottom: 16 }}>
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '14px 16px', boxShadow: '0 2px 6px rgba(43,42,40,0.08)', position: 'relative' }}>
              <div style={{ position: 'absolute', width: 34, height: 10, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
              {STORY.map((p, i) => (
                <p key={i} style={{ fontSize: 12, lineHeight: 1.65, color: '#5C4A3A', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: i < STORY.length - 1 ? 8 : 0 }}>{p}</p>
              ))}
              <HeartSig />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '16px 16px 8px', scrollbarWidth: 'none' }}>
            {[
              { src: '/photos/photo1.jpg', stamp: '8 - 14 - 22', cap: null, loc: null, rot: -4, stampPos: 'br' },
              { src: '/photos/photo2.jpg', stamp: '9 - 18 - 23', cap: null, loc: 'SCOTLAND', rot: 2.5, stampPos: 'tr' },
              { src: '/photos/photo3.jpg', stamp: '7 - 04 - 23', cap: 'first beach', loc: null, rot: -2, stampPos: 'br' },
              { src: '/photos/photo4.jpg', stamp: '11 - 30 - 24', cap: null, loc: null, rot: 3, stampPos: 'br' },
              { src: '/photos/photo5.jpg', stamp: '12 - 25 - 23', cap: 'first christmas', loc: 'Kennett Square, PA', rot: -1.5, stampPos: 'bl' },
            ].map((p, i) => (
              <div key={i} style={{ background: 'white', padding: '5px 5px 20px', transform: `rotate(${p.rot}deg)`, boxShadow: '0 2px 8px rgba(43,42,40,0.1)', position: 'relative', flexShrink: 0, width: 145 }}>
                <div style={{ position: 'absolute', width: 34, height: 10, background: 'rgba(255,235,170,0.75)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
                <img src={p.src} alt={p.cap ?? 'memory'} style={{ width: 135, height: 175, objectFit: 'cover', display: 'block' }} loading="eager" />
                <div style={{ position: 'absolute', ...(p.stampPos === 'tr' ? { top: 8, right: 6 } : p.stampPos === 'bl' ? { bottom: 23, left: 5 } : { bottom: 22, right: 6 }), fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 7.5, lineHeight: 1.4, textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>
                  {p.stamp}{p.loc && <><br />{p.loc}</>}
                </div>
                {p.cap && <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 7.5, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{p.cap}</div>}
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 16px 0' }}>
            <div style={{ background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '14px 16px', boxShadow: '0 2px 6px rgba(43,42,40,0.08)', position: 'relative' }}>
              <div style={{ position: 'absolute', width: 13, height: 13, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-15deg)' }} />
              <div style={{ position: 'absolute', width: 13, height: 13, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(15deg)' }} />
              <p style={{ fontSize: 12, color: '#2B2A28', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.5, marginBottom: 8 }}>
                Remember the date stamp on old disposable camera prints? <em style={{ color: '#D97A43' }}>We brought it back.</em>
              </p>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#E8841A', fontWeight: 700, marginBottom: 8, letterSpacing: '0.07em' }}>5 - 13 - 25 - TAMPA, FL</div>
              <p style={{ fontSize: 11, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
                Upload your photos, choose your stamp style, and we print and ship them to your door.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{ background: '#F7F3EE', padding: isMobile ? '36px 20px 28px' : '44px 24px 36px', textAlign: 'center', borderTop: '1px solid rgba(43,42,40,0.07)', width: '100%' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: isMobile ? 'clamp(28px, 8vw, 38px)' : 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: '#2B2A28', lineHeight: 1.08, marginBottom: 24 }}>
          Every photo tells a story.<br /><em style={{ color: '#8A6F5A' }}>Archive yours.</em>
        </h1>
        <button onClick={() => router.push('/studio')} style={{ padding: '15px 48px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 6, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', cursor: 'pointer', width: isMobile ? '100%' : 'auto', maxWidth: 340 }}>
          Get started
        </button>
      </div>

      {/* Already have an archive */}
      <div style={{ background: '#EFE8DF', padding: '18px 20px', borderTop: '1px solid rgba(43,42,40,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#8A6F5A', fontStyle: 'italic' }}>already have an archive?</span>
        <a href="/login?provider=google" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: 'Courier New, monospace', textDecoration: 'none' }}>
          <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Google
        </a>
        <a href="/login" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: 'Courier New, monospace', textDecoration: 'none' }}>
          Magic link
        </a>
      </div>
    </div>
  )
}
