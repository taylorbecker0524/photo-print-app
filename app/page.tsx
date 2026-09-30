'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { getWithTTL } from '@/lib/storage'

// Must match SNAPSHOT_KEY in app/studio/page.tsx.
const STUDIO_SNAPSHOT_KEY = 'archive-studio'

const STORY = [
  '"nearing our daughter\'s first birthday, we wanted to archive all of our favorite moments — each beach trip, every holiday, her first steps, every ordinary tuesday that somehow felt extraordinary.',
  'we started printing her photos and stamping each one with the date and location it was taken. so that someday, when she holds a print in her hands, she can be taken right back to that moment.',
  'we can\'t freeze time. but we can preserve it.',
  'that\'s why archive exists."'
]

/**
 * The note tucked into the collage.
 *
 * The full story used to live here, set at 11px inside a card that the row
 * scales by about 1.03 — so as the prints grew it became the one thing on the
 * page nobody could read. It now says just enough to earn a second look, and
 * the story itself gets its own section below the band at a size meant for
 * reading.
 */
const STORY_NOTE = [
  '"we started printing her photos with the date and place stamped on each one.',
  'we can\'t freeze time. but we can preserve it."',
]

const PHOTOS = [
  { src: '/photos/photo1.jpg', stamp: '8 - 14 - 22', cap: null, loc: null, rot: -3.5, stampPos: 'br' },
  { src: '/photos/photo2.jpg', stamp: '9 - 18 - 23', cap: null, loc: 'SCOTLAND', rot: 2.5, stampPos: 'tr' },
  { src: '/photos/photo3.jpg', stamp: '7 - 04 - 23', cap: 'first beach', loc: null, rot: -2, stampPos: 'br' },
  { src: '/photos/photo4.jpg', stamp: '11 - 30 - 24', cap: null, loc: null, rot: 3, stampPos: 'br' },
  { src: '/photos/photo5.jpg', stamp: '12 - 25 - 23', cap: 'first christmas', loc: 'Kennett Square, PA', rot: -1.5, stampPos: 'bl' },
  { src: '/photos/photo6.jpg', stamp: '7 - 12 - 24', cap: null, loc: 'Chesapeake Bay, MD', rot: 2, stampPos: 'br' },
]

// Natural size of the desktop scrapbook row. The whole row is laid out at this
// width and then scaled to the viewport, so ROW_NATURAL_W is the lever that
// decides how large the prints end up: the row always spans the window, so a
// NARROWER natural width means a bigger scale factor and bigger photos.
//
// That is what OVERLAP buys. Shingling the prints takes real width out of the
// row without removing anything from it, which pays for prints about 40% larger
// than the old side-by-side layout could fit.
//
// The stacking runs left to right — each card sits ON TOP of the one after it —
// because the date stamps live in the bottom-right corner of every print. Stack
// it the other way and each print's neighbour covers the one thing the whole
// product is about. The notecards take no overlap at all, so they never cover a
// print's stamped corner either.
const OVERLAP = -56
// The three prints in the middle get more air than the rest, so the row reads
// as a cluster with breathing room rather than one solid deck of cards.
const OVERLAP_AIR = -16
// The row is scaled to slightly MORE than the window, so the first and last
// prints run off both edges instead of stopping politely inside them. The
// scrapbook then reads as wider than the screen, which is the point.
const BLEED = 90
const ROW_NATURAL_W = 1960

/**
 * How fast the phone's photo strip drifts, in pixels per second.
 *
 * The strip ended flush with the screen edge, so nothing on screen said it
 * could be scrolled, and it wasn't. Motion is the fix: a row that is already
 * moving when you land on it cannot be mistaken for a dead end.
 *
 * Expressed as a speed rather than a duration on purpose. A duration would
 * silently change the feel the moment a photo is added or a print resized,
 * because the lap would still have to finish in the same time. At 25px/s one
 * print passes roughly every seven seconds — slow enough to read the date
 * stamp as it goes by, which is the one thing the whole product is about.
 */
const DRIFT_PX_PER_SEC = 25
/** How long after a thumb lets go before the drift takes over again. */
const DRIFT_RESUME_MS = 2000

export default function HomePage() {
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const [viewportW, setViewportW] = useState(0)
  // The row's unscaled height is whatever its tallest item needs. Measuring it
  // beats hard-coding: a guess that came up short cropped the story note, and
  // the number would go stale the moment a photo or card changed size.
  const photoRowRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [rowNaturalH, setRowNaturalH] = useState(0)
  // null = nothing saved (or not checked yet); a number = prints waiting.
  const [savedPrints, setSavedPrints] = useState<number | null>(null)

  useEffect(() => {
    try {
      const snap = getWithTTL<{
        photos?: unknown[]
        orderItems?: Array<{ quantity?: number }>
      }>(STUDIO_SNAPSHOT_KEY)
      if (!snap?.photos?.length) return
      const prints = (snap.orderItems ?? []).reduce((n, i) => n + (Number(i?.quantity) || 0), 0)
      setSavedPrints(prints)
    } catch {
      // Storage can be unavailable (private browsing). Then there is simply
      // nothing to resume, and the page behaves as it always did.
    }
  }, [])

  const startFresh = () => {
    try { localStorage.removeItem(STUDIO_SNAPSHOT_KEY) } catch {}
    try { sessionStorage.removeItem(STUDIO_SNAPSHOT_KEY) } catch {}
    setSavedPrints(null)
    router.push('/studio')
  }

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 680)
      setViewportW(window.innerWidth)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // The desktop scrapbook is a fixed composition — eight items at hand-picked
  // sizes and angles — that used to be laid out at its natural size and simply
  // clipped by `overflow: hidden` when the window was narrower than it. On a
  // 1440px laptop that meant the last print was sliced in half by the right
  // edge. Scaling the whole row as one unit keeps every print on screen at any
  // width and preserves the composition exactly, instead of reflowing it into
  // something that no longer reads as a row of photos on a table.
  const photoScale = viewportW ? Math.min(1.8, Math.max(0.28, (viewportW + BLEED) / ROW_NATURAL_W)) : 1

  // offsetHeight is the pre-transform layout height, so this stays correct no
  // matter what scale is applied.
  useEffect(() => {
    const el = photoRowRef.current
    if (!el) return
    const measure = () => setRowNaturalH(el.offsetHeight)
    measure()
    // Fonts and images land after first paint and can change the tallest item.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [isMobile])

  /**
   * The drift.
   *
   * Deliberately NOT a CSS animation on a transformed track. That looks the
   * same but takes the strip out of the browser's hands: a transform cannot be
   * swiped, so we would have had to rebuild momentum scrolling ourselves and
   * would have got it wrong on iOS. This keeps a plain overflow scroller — real
   * flick, real momentum, real accessibility — and just nudges scrollLeft each
   * frame. A thumb on the strip stops the nudging; two seconds after it lifts,
   * the drift picks up from wherever the reader left it.
   *
   * The loop is seamless because PHOTOS is rendered twice. Once the first copy
   * has fully passed, scrollLeft is reduced by exactly one copy's width, which
   * lands on a pixel-identical frame — there is nothing to see.
   */
  useEffect(() => {
    const el = stripRef.current
    if (!isMobile || !el) return
    // Someone who has asked their phone to stop moving things gets a strip that
    // sits still and is swiped by hand, exactly as it is today.
    const reduced = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let raf = 0
    let last = 0
    let pos = 0
    let held = false
    let resumeAt = 0

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      // One copy of the set. Rendering the set twice with a right margin on
      // every card (rather than flex `gap`, which is not applied after the last
      // child) makes this exactly half the scrollable width.
      const lap = el.scrollWidth / 2
      const dt = last ? Math.min(100, t - last) : 0
      last = t
      if (lap <= 0) return

      if (held || t < resumeAt) {
        // Hands off while the reader is scrolling, and while iOS is still
        // playing out the momentum from their flick. Track where they have got
        // to so the drift resumes from there instead of snapping back.
        pos = el.scrollLeft
      } else {
        pos += (DRIFT_PX_PER_SEC * dt) / 1000
        if (pos >= lap) pos -= lap
        el.scrollLeft = pos
      }

      // A hard flick can carry the reader past the seam on its own.
      if (el.scrollLeft >= lap) { el.scrollLeft -= lap; pos = el.scrollLeft }
      else if (el.scrollLeft < 0) { el.scrollLeft += lap; pos = el.scrollLeft }
    }

    const hold = () => { held = true }
    const release = () => { held = false; resumeAt = performance.now() + DRIFT_RESUME_MS }

    el.addEventListener('pointerdown', hold)
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('touchstart', hold, { passive: true })
    el.addEventListener('touchend', release, { passive: true })
    el.addEventListener('touchcancel', release, { passive: true })
    // A mouse wheel or trackpad never fires pointerdown, so without this the
    // drift would fight anyone scrolling the strip on a laptop.
    el.addEventListener('wheel', release, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', hold)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('touchstart', hold)
      el.removeEventListener('touchend', release)
      el.removeEventListener('touchcancel', release)
      el.removeEventListener('wheel', release)
    }
  }, [isMobile])

  // FIX 7: notecard typography helper
  // Bigger size, no italic on body, darker color for contrast.
  // The closing line ("that's why archive exists") is the only italic line
  // for emphasis — typographic hierarchy carries emotional weight.
  const noteBody = (size: number) => ({
    fontSize: size,
    lineHeight: 1.65,
    color: '#3D3128',                     // darker than old #5C4A3A
    fontFamily: 'Georgia, serif',
    fontStyle: 'normal' as const,         // was italic — too hard to read at small size
  })
  const noteClose = (size: number) => ({  // closing line keeps italic
    fontSize: size,
    lineHeight: 1.65,
    color: '#3D3128',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic' as const,
  })


  const TapeTop = () => <div style={{ position: 'absolute', width: 42, height: 12, background: 'rgba(255,235,170,0.78)', border: '0.5px solid rgba(200,165,80,0.3)', borderRadius: 1, top: -6, left: '50%', transform: 'translateX(-50%)' }} />

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>

      {/* How it works bar. Every step is a link into the studio, the same place
          the Get started button goes: people read these four words to decide
          whether to try it, so a tap on one was a dead end. */}
      <div style={{ background: '#EFE8DF', borderBottom: '1px solid rgba(43,42,40,0.08)', padding: '10px 0', width: '100%', display: 'flex', alignItems: 'center' }}>
        {[
          { n: '1', title: 'Upload', sub: 'photos' },
          { n: '2', title: 'Stamp', sub: 'date + location' },
          { n: '3', title: 'Print', sub: 'any size' },
          { n: '4', title: 'Ship', sub: 'to your door' },
        ].map((step, i) => (
          <a
            key={i}
            href="/studio"
            className="howto-step"
            aria-label={`Start your order — step ${step.n}, ${step.title} ${step.sub}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRight: i < 3 ? '1px solid rgba(43,42,40,0.1)' : 'none', alignSelf: 'stretch', padding: '4px 0' }}
          >
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F7F3EE', border: '1px solid rgba(43,42,40,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Courier New, monospace', fontSize: 9, color: '#8A6F5A', flexShrink: 0 }}>{step.n}</div>
            <div>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2B2A28' }}>{step.title}</div>
              <div style={{ fontSize: 9, color: '#8A6F5A', fontStyle: 'italic' }}>{step.sub}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Hero. This used to sit at the very bottom, under the whole photo wall,
          so on a phone the only button on the page was ~100px below the fold:
          you landed on four step labels and a long first-person story with
          nothing to act on. Offer first, story after — the collage below is
          the proof, not the gatekeeper. */}
      <div style={{ background: '#F7F3EE', padding: isMobile ? '32px 20px 30px' : '48px 24px 44px', textAlign: 'center', borderBottom: '1px solid rgba(43,42,40,0.07)', width: '100%' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: isMobile ? 'clamp(28px, 8vw, 38px)' : 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: '#2B2A28', lineHeight: 1.08, marginBottom: 14 }}>
          Every photo tells a story.<br /><em style={{ color: '#8A6F5A' }}>Archive yours.</em>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: isMobile ? 15 : 17, color: '#8A6F5A', lineHeight: 1.5, margin: '0 auto 26px', maxWidth: 440 }}>
          The date and location stamped on every print — just like old
          disposable cameras.
        </p>
        {/* The studio keeps an unfinished order for seven days, but the only way
            back into it was a button saying "Get started" — which reads like
            throwing the order away and beginning again. Nobody part-way through
            would trust it. When there is something to come back to, say so. */}
        <button onClick={() => router.push('/studio')} style={{ padding: '15px 48px', background: '#2B2A28', color: '#F7F3EE', border: 'none', borderRadius: 6, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace', cursor: 'pointer', width: isMobile ? '100%' : 'auto', maxWidth: 340 }}>
          {savedPrints === null
            ? 'Get started'
            : savedPrints > 0
              ? `Continue your order · ${savedPrints} print${savedPrints === 1 ? '' : 's'}`
              : 'Continue your photos'}
        </button>
        {savedPrints !== null && (
          <p style={{ marginTop: 12, fontSize: 12, color: '#8A6F5A', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            Your photos are still here. <button onClick={startFresh} style={{ background: 'none', border: 'none', padding: 0, color: '#D97A43', fontSize: 12, fontFamily: 'inherit', fontStyle: 'italic', textDecoration: 'underline', cursor: 'pointer' }}>Start a new order instead</button>
          </p>
        )}
      </div>


      {/* DESKTOP — single horizontal row.
          The outer element clips and reserves the scaled height; the inner one
          keeps the composition at its natural size and is scaled as a unit.
          alignItems must be flex-start: the default `stretch` would make the
          inner row inherit the outer's height, and since the outer's height is
          derived from the inner's, the two feed back into each other — the band
          collapsed below 1700px and ran to tens of thousands of pixels above. */}
      {!isMobile && (
        <div style={{ background: '#EDE6DC', width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: rowNaturalH ? Math.round(rowNaturalH * photoScale) : undefined }}>
        <div ref={photoRowRef} style={{ width: ROW_NATURAL_W, flexShrink: 0, padding: '34px 0 30px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, transform: `scale(${photoScale})`, transformOrigin: 'top center' }}>

          {/* Photo 1 */}
          <div style={{ background: 'white', padding: '7px 7px 26px', transform: 'rotate(-3.5deg)', boxShadow: '0 3px 12px rgba(43,42,40,0.12)', position: 'relative', flexShrink: 0, zIndex: 9 }}>
            <TapeTop />
            <img src="/photos/photo1.jpg" alt="memory" style={{ width: 248, height: 326, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 28, right: 8, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 11, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>8 - 14 - 22</div>
          </div>

          {/* Story notecard — FIX 7: larger size, no italic on body, darker color */}
          <div style={{ background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '15px 17px', boxShadow: '0 2px 8px rgba(43,42,40,0.08)', position: 'relative', flexShrink: 0, width: 200, zIndex: 8, transform: 'rotate(1.5deg)', alignSelf: 'center' }}>
            <div style={{ position: 'absolute', width: 34, height: 10, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
            {STORY_NOTE.map((p, i) => {
              const isLast = i === STORY_NOTE.length - 1
              return (
                <p key={i} style={{ ...(isLast ? noteClose(15) : noteBody(15)), marginBottom: isLast ? 0 : 10 }}>{p}</p>
              )
            })}
          </div>

          {/* Photo 2 — Scotland */}
          <div style={{ background: 'white', padding: '7px 7px 26px', transform: 'rotate(2.5deg)', boxShadow: '0 3px 12px rgba(43,42,40,0.12)', position: 'relative', flexShrink: 0, marginLeft: OVERLAP, zIndex: 7 }}>
            <TapeTop />
            <img src="/photos/photo2.jpg" alt="Scotland" style={{ width: 245, height: 319, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', top: 10, right: 8, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 11, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>9 - 18 - 23<br />SCOTLAND</div>
          </div>

          {/* Photo 3 — beach */}
          <div style={{ background: 'white', padding: '7px 7px 26px', transform: 'rotate(-2deg)', boxShadow: '0 3px 12px rgba(43,42,40,0.12)', position: 'relative', flexShrink: 0, marginLeft: OVERLAP_AIR, zIndex: 6 }}>
            <TapeTop />
            <img src="/photos/photo3.jpg" alt="first beach" style={{ width: 251, height: 329, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 28, right: 8, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 11, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>7 - 04 - 23</div>
            <div style={{ position: 'absolute', bottom: 7, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>first beach</div>
          </div>

          {/* Photo 4 — dinner */}
          <div style={{ background: 'white', padding: '7px 7px 26px', transform: 'rotate(3deg)', boxShadow: '0 3px 12px rgba(43,42,40,0.12)', position: 'relative', flexShrink: 0, marginLeft: OVERLAP_AIR, zIndex: 5 }}>
            <TapeTop />
            <img src="/photos/photo4.jpg" alt="memory" style={{ width: 240, height: 313, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 28, right: 8, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 11, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>11 - 30 - 24</div>
          </div>

          {/* Feature notecard — FIX 7: larger size, less italic, darker */}
          <div style={{ background: '#FDFAF5', border: '0.5px solid rgba(43,42,40,0.1)', padding: '15px 17px', boxShadow: '0 2px 8px rgba(43,42,40,0.08)', position: 'relative', flexShrink: 0, width: 300, zIndex: 4, transform: 'rotate(-1.5deg)', alignSelf: 'center' }}>
            <div style={{ position: 'absolute', width: 13, height: 13, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -3, left: -3, transform: 'rotate(-15deg)' }} />
            <div style={{ position: 'absolute', width: 13, height: 13, background: 'rgba(255,235,170,0.8)', borderRadius: 1, top: -3, right: -3, transform: 'rotate(15deg)' }} />
            <p style={{ fontSize: 15, color: '#3D3128', fontFamily: 'Georgia, serif', lineHeight: 1.55, marginBottom: 10 }}>
              Remember the date stamp on old disposable camera prints? <em style={{ color: '#D97A43', fontStyle: 'italic' }}>We brought it back.</em>
            </p>
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 13.5, color: '#E8841A', fontWeight: 700, marginBottom: 10, letterSpacing: '0.07em' }}>5 - 13 - 25 - TAMPA, FL</div>
            <p style={{ fontSize: 14, color: '#5C4A3A', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
              Upload your photos, choose your stamp style, and we print and ship them to your door.
            </p>
          </div>

          {/* Photo 6 — dog at bay */}
          <div style={{ background: 'white', padding: '7px 7px 26px', transform: 'rotate(2deg)', boxShadow: '0 3px 12px rgba(43,42,40,0.12)', position: 'relative', flexShrink: 0, marginLeft: OVERLAP, zIndex: 3 }}>
            <TapeTop />
            <img src="/photos/photo6.jpg" alt="Chesapeake Bay" style={{ width: 240, height: 316, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 28, right: 8, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 11, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>7 - 12 - 24<br />Chesapeake Bay, MD</div>
          </div>

          {/* Photo 5 — B&W christmas */}
          <div style={{ background: 'white', padding: '7px 7px 26px', transform: 'rotate(-1.5deg)', boxShadow: '0 3px 12px rgba(43,42,40,0.12)', position: 'relative', flexShrink: 0, marginLeft: OVERLAP, zIndex: 2 }}>
            <TapeTop />
            <img src="/photos/photo5.jpg" alt="first christmas" style={{ width: 245, height: 319, objectFit: 'cover', display: 'block' }} loading="eager" />
            <div style={{ position: 'absolute', bottom: 28, right: 8, fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 11, lineHeight: 1.4, letterSpacing: '0.06em', textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>12 - 25 - 23<br />Kennett Square, PA</div>
            <div style={{ position: 'absolute', bottom: 7, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>first christmas</div>
          </div>

        </div>
        </div>
      )}

      {/* MOBILE scrapbook */}
      {/* The phone band.
          It used to be a notecard, a strip nobody knew could scroll, and a
          second notecard — two blocks of text squeezing a row that looked like
          it ended at the screen edge. Both cards are gone: the hero above says
          the disposable-camera line already, and the family story has its own
          section below. What is left is the product, moving. */}
      {isMobile && (
        <div style={{ background: '#EDE6DC', width: '100%', padding: '20px 0 22px', overflow: 'hidden' }}>
          <div
            ref={stripRef}
            className="ay-strip"
            role="group"
            aria-label="Prints with the date and place stamped on them"
            style={{ display: 'flex', overflowX: 'auto', paddingTop: 6, paddingBottom: 6 }}
          >
            {[...PHOTOS, ...PHOTOS].map((p, i) => (
              <div
                key={i}
                /* The second copy exists only so the loop has nothing to catch
                   on. A screen reader should hear the six prints once. */
                aria-hidden={i >= PHOTOS.length || undefined}
                style={{ background: 'white', padding: '6px 6px 25px', marginRight: 12, transform: `rotate(${p.rot}deg)`, boxShadow: '0 2px 8px rgba(43,42,40,0.1)', position: 'relative', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', width: 38, height: 11, background: 'rgba(255,235,170,0.75)', borderRadius: 1, top: -5, left: '50%', transform: 'translateX(-50%)' }} />
                <img src={p.src} alt={p.cap ?? 'memory'} style={{ width: 170, height: 220, objectFit: 'cover', display: 'block' }} loading="eager" />
                <div style={{ position: 'absolute', ...(p.stampPos === 'tr' ? { top: 10, right: 8 } : p.stampPos === 'bl' ? { bottom: 29, left: 7 } : { bottom: 28, right: 8 }), fontFamily: 'Courier New, monospace', color: '#E8841A', fontWeight: 700, fontSize: 9.5, lineHeight: 1.4, textShadow: '0 0 3px rgba(232,132,26,0.4)' }}>
                  {p.stamp}{p.loc && <><br />{p.loc}</>}
                </div>
                {p.cap && <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 9.5, color: '#8A6F5A', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{p.cap}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The founder story, at reading size.
          It spent its life as 11px inside a card in the collage. The collage
          keeps a two-line note so it still reads as a scrapbook; the story
          itself gets room here. */}
      <div style={{ background: '#F7F3EE', padding: isMobile ? '38px 22px' : '58px 24px', borderTop: '1px solid rgba(43,42,40,0.07)', width: '100%' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          {STORY.map((para, i) => (
            <p key={i} style={{
              fontFamily: 'Georgia, serif',
              fontSize: isMobile ? 16 : 19,
              lineHeight: 1.62,
              color: '#3D3128',
              fontStyle: i === STORY.length - 1 ? 'italic' : 'normal',
              marginBottom: i === STORY.length - 1 ? 18 : 15,
            }}>{para}</p>
          ))}
          <p style={{ fontFamily: 'Courier New, monospace', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6F5A', margin: 0 }}>
            <svg width="11" height="10" viewBox="0 0 24 22" fill="#D97A43" style={{ verticalAlign: 'middle', marginRight: 6 }}><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" /></svg>the archive family
          </p>
        </div>
      </div>

      {/* Already have an archive */}
      <div style={{ background: '#EFE8DF', padding: '18px 20px', borderTop: '1px solid rgba(43,42,40,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#8A6F5A', fontStyle: 'italic' }}>already have an archive?</span>
        <a href="/login" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: '1px solid rgba(43,42,40,0.15)', borderRadius: 5, background: 'white', fontSize: 11, color: '#2B2A28', fontFamily: 'Courier New, monospace', textDecoration: 'none' }}>
          Sign in
        </a>
      </div>
    </div>
  )
}
