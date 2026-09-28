// Turning what the customer designed into the file the printer receives.
//
// This file exists because of a bug that shipped: the studio drew the date
// stamp and the filter onto a preview canvas, and checkout uploaded
// `photo.file` — the untouched original. Everything the customer chose lived
// in the browser and in the order record, and none of it reached Prodigi. The
// prints came back as bare photos.
//
// The lesson in that bug is not "we forgot a step", it is that there were two
// renderers. The preview drew the stamp one way; the export did not draw it at
// all, and nothing in the type system noticed. So the geometry and the text
// now live here, once, and BOTH the on-screen preview and the print export
// call the same functions. If the stamp moves on screen it moves on paper,
// because it is the same code.
//
// All stamp measurements are fractions of the canvas WIDTH, never pixels. A
// preview canvas is about 700px wide and a print is up to 3000px, so anything
// expressed in absolute pixels would be a hairline on paper.

export type Filter = 'original' | 'film' | 'sepia' | 'bw' | 'faded' | 'vivid' | 'cool'
export type StampStyle = 'burn' | 'overlay' | 'none'
export type StampPos = 'bl' | 'br' | 'tl' | 'tr'
export type StampFont = 'classic' | 'pixel' | 'typewriter'

export type StampConfig = {
  showDate: boolean; showTime: boolean; showLocation: boolean
  locationText: string; customText: string; style: StampStyle
  position: StampPos; capturedAt: string | null
  /** Bulk date override. Kept separate so the original EXIF date survives it. */
  capturedAtOverride: string | null
  hasExifDate: boolean; hasExifLocation: boolean
  dateFormat: 'modern' | 'classic'
  stampFont: StampFont
}

export const FILTERS: { key: Filter; label: string; css: string }[] = [
  { key: 'original', label: 'Original', css: 'none' },
  { key: 'film', label: 'Film', css: 'sepia(0.2) contrast(1.1) saturate(0.9) brightness(0.95)' },
  { key: 'sepia', label: 'Sepia', css: 'sepia(0.85) contrast(1.05)' },
  { key: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { key: 'faded', label: 'Faded', css: 'contrast(0.85) saturate(0.7) brightness(1.05)' },
  { key: 'vivid', label: 'Vivid', css: 'saturate(1.4) contrast(1.1)' },
  { key: 'cool', label: 'Cool', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.02)' },
]
export const getFCss = (f: Filter) => FILTERS.find(x => x.key === f)?.css ?? 'none'

export const STAMP_FONTS: { key: StampFont; label: string; family: string; weight: number; sizeMult: number }[] = [
  { key: 'classic',    label: 'Classic burn (LCD)',   family: '"Share Tech Mono", "Courier New", monospace', weight: 400, sizeMult: 1.0 },
  { key: 'pixel',      label: 'Pixel print',          family: '"VT323", "Courier New", monospace',           weight: 400, sizeMult: 1.35 },
  { key: 'typewriter', label: 'Typewriter (vintage)', family: '"Special Elite", Georgia, serif',             weight: 400, sizeMult: 1.05 },
]
export const getStampFont = (key: StampFont) => STAMP_FONTS.find(f => f.key === key) ?? STAMP_FONTS[0]

export const fmtDate = (iso: string, fmt: 'modern' | 'classic' = 'classic') => {
  const d = new Date(iso)
  return fmt === 'classic'
    ? `${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')} ${d.getFullYear()}`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** The date actually stamped: a bulk override wins, otherwise the EXIF date. */
export const effectiveCapturedAt = (s: StampConfig): string | null =>
  s.capturedAtOverride ?? s.capturedAt

export function buildStampLines(stamp: StampConfig): string[] {
  const lines: string[] = []
  const cap = effectiveCapturedAt(stamp)
  if (stamp.showDate && cap) {
    lines.push(fmtDate(cap, stamp.dateFormat ?? 'classic'))
    if (stamp.showTime) lines.push(fmtTime(cap))
  } else if (stamp.showTime && cap) {
    lines.push(fmtTime(cap))
  }
  if (stamp.showLocation && stamp.locationText) lines.push(stamp.locationText)
  if (stamp.customText) lines.push(stamp.customText)
  return lines
}

/** True when this stamp would put ink on the photo. */
export function stampIsVisible(stamp: StampConfig): boolean {
  return stamp.style !== 'none' && buildStampLines(stamp).length > 0
}

/**
 * The three stamp faces are Google Fonts. A canvas draws with whatever is
 * loaded AT THE MOMENT of fillText — there is no reflow afterwards — so a font
 * that arrives late gives a print set in Courier. Waiting here is the whole
 * reason the fallback never reaches paper.
 *
 * Resolves either way: a stamp in the fallback face is worse than the chosen
 * one, but far better than an order that fails to check out.
 */
export async function ensureStampFont(key: StampFont, px: number): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  const f = getStampFont(key)
  try {
    await Promise.race([
      document.fonts.load(`${f.weight} ${Math.round(px)}px ${f.family}`),
      new Promise(res => setTimeout(res, 3000)),
    ])
  } catch {
    /* fallback face is acceptable; a blocked order is not */
  }
}

/**
 * Draw the stamp onto an already-drawn image.
 *
 * `cw`/`ch` are the dimensions of the surface being drawn on, which is the
 * preview canvas on screen and the full-resolution print canvas at checkout.
 * Everything below is a fraction of `cw`, so one set of numbers serves both.
 *
 * The caller must reset ctx.filter to 'none' first: the stamp is never
 * filtered, so a B&W photo still gets an orange date burn, exactly as the
 * two-layer preview shows it.
 */
export function drawStamp(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  stamp: StampConfig
): void {
  if (stamp.style === 'none') return
  const lines = buildStampLines(stamp)
  if (!lines.length) return

  const fontDef = getStampFont(stamp.stampFont ?? 'classic')
  const fs = cw * 0.022 * fontDef.sizeMult
  const pad = cw * 0.025
  const lineH = fs * 1.45
  ctx.font = `${stamp.style === 'burn' ? 'bold' : fontDef.weight} ${Math.round(fs)}px ${fontDef.family}`
  ctx.textBaseline = 'alphabetic'

  const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2
  const boxH = lines.length * lineH + pad * 0.8
  let bx = pad
  let by = ch - boxH - pad
  if (stamp.position === 'br') bx = cw - boxW - pad
  if (stamp.position === 'tl') by = pad
  if (stamp.position === 'tr') { bx = cw - boxW - pad; by = pad }

  if (stamp.style === 'burn') {
    ctx.fillStyle = '#E8841A'
    ctx.shadowColor = 'rgba(232,132,26,0.6)'
    // The preview's 3px glow is a fixed pixel value on a ~700px canvas. Scaled
    // here, so a 3000px print gets the same soft edge rather than a hard one.
    ctx.shadowBlur = Math.max(1, cw * 0.0043)
    lines.forEach((l, i) => ctx.fillText(l, bx, by + pad * 0.4 + (i + 1) * lineH - lineH * 0.2))
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  } else {
    ctx.fillStyle = 'rgba(247,243,238,0.65)'
    ctx.fillRect(bx, by, boxW, boxH)
    ctx.fillStyle = 'rgba(43,42,40,0.85)'
    lines.forEach((l, i) => ctx.fillText(l, bx + pad * 0.8, by + pad * 0.4 + (i + 1) * lineH - lineH * 0.2))
  }
}

const MAX_PRINT_PIXELS = 3000  // longest edge: 8x10 at 300dpi
const JPEG_QUALITY = 0.85
const DECODE_TIMEOUT_MS = 30000

/**
 * Produce the JPEG that will actually be printed: the photo at print
 * resolution, with the chosen filter applied to the pixels and the stamp burned
 * in on top.
 *
 * When there is nothing to burn in, this hands back to compressForPrint, which
 * keeps the existing fast path (an already-small JPEG is passed through
 * untouched rather than re-encoded and degraded a second time).
 */
export async function renderForPrint(
  file: File,
  filter: Filter,
  stamp: StampConfig
): Promise<{ blob: Blob; width: number; height: number }> {
  const filterCss = getFCss(filter)
  const needsStamp = stampIsVisible(stamp)
  if (filterCss === 'none' && !needsStamp) {
    const { compressForPrint } = await import('./compress')
    const out = await compressForPrint(file)
    return { blob: out.blob, width: out.width, height: out.height }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await withTimeout(
      createImageBitmap(file, { imageOrientation: 'from-image' }),
      DECODE_TIMEOUT_MS
    )
  } catch {
    try {
      bitmap = await withTimeout(createImageBitmap(file), DECODE_TIMEOUT_MS)
    } catch {
      throw new Error(`Could not decode image: ${file.name}`)
    }
  }

  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > MAX_PRINT_PIXELS ? MAX_PRINT_PIXELS / longest : 1
  const cw = Math.round(bitmap.width * scale)
  const ch = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas 2D context not available')
  }

  // ctx.filter is what puts the filter into the PIXELS. The preview applies the
  // same string as a CSS filter on the canvas element instead, which is a
  // display-only effect — it was never going to survive toBlob. On an engine
  // without ctx.filter support the photo prints unfiltered, which is a
  // disappointment rather than a failed order.
  if (filterCss !== 'none' && 'filter' in ctx) ctx.filter = filterCss
  ctx.drawImage(bitmap, 0, 0, cw, ch)
  ctx.filter = 'none'
  bitmap.close()

  if (needsStamp) {
    await ensureStampFont(stamp.stampFont ?? 'classic', cw * 0.022)
    drawStamp(ctx, cw, ch, stamp)
  }

  const blob = await withTimeout(
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
        'image/jpeg',
        JPEG_QUALITY
      )
    }),
    DECODE_TIMEOUT_MS
  )

  return { blob, width: cw, height: ch }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Image processing timed out')), ms)
    p.then(
      v => { clearTimeout(t); resolve(v) },
      e => { clearTimeout(t); reject(e) }
    )
  })
}
