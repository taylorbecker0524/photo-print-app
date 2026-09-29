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

/**
 * THE CROP.
 *
 * A 4x6 is 2:3. A phone shoots 3:4. Those do not match, so something has to
 * go. Until now nothing in our code made that decision — we shipped the full
 * photo and Prodigi's `fillPrintArea` shaved 11% off both sides, dead centre,
 * with nobody looking. That is what cut a person out of a print.
 *
 * Worse, the stamp sits 2.5% in from the edge of the file we upload, and the
 * crop eats 11%, so the lab was also shaving the date off the bottom corner.
 *
 * So the crop happens HERE, before the stamp is drawn. The canvas is created
 * at the exact print ratio, the photo is drawn into it through the crop rect,
 * and only then does drawStamp run — which means the stamp is positioned
 * against the paper's edge, not the original file's, and cannot be cut off.
 * `fillPrintArea` is then a no-op: there is no overflow left to remove.
 *
 * `cx`/`cy` are the centre of the crop window in normalised source
 * coordinates, `zoom` is a multiplier on the largest rect of the print's shape
 * that fits inside the photo. The defaults (0.5, 0.5, 1) reproduce exactly the
 * centre crop the lab was doing, so photos ordered before the crop editor
 * existed render identically.
 */
export type CropMode = 'fill' | 'fit'
export type Crop = { mode: CropMode; zoom: number; cx: number; cy: number }
export const DEFAULT_CROP: Crop = { mode: 'fill', zoom: 1, cx: 0.5, cy: 0.5 }
export const isDefaultCrop = (c?: Crop | null): boolean =>
  !c || (c.mode === 'fill' && c.zoom === 1 && c.cx === 0.5 && c.cy === 0.5)

/** Long edge over short edge for every size we sell. */
export const PRINT_RATIOS: Record<string, number> = {
  '4x6': 6 / 4, '5x7': 7 / 5, '8x10': 10 / 8,
  'square-4': 1, 'square-5': 1, 'square-8': 1,
}

/**
 * Width/height of the paper, oriented to follow the photo. A portrait photo on
 * a 4x6 gets a portrait 4x6; we never rotate someone's picture to fit.
 */
export function printAspect(size: string, srcW: number, srcH: number): number {
  const r = PRINT_RATIOS[size] ?? 1
  return srcW >= srcH ? r : 1 / r
}

const clamp = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v))

/** The rectangle of the source photo that ends up on the paper. */
export function cropRect(
  srcW: number, srcH: number, targetAspect: number, crop?: Crop | null
): { sx: number; sy: number; sw: number; sh: number } {
  const c = crop ?? DEFAULT_CROP
  let rw: number, rh: number
  if (srcW / srcH > targetAspect) { rh = srcH; rw = srcH * targetAspect }
  else { rw = srcW; rh = srcW / targetAspect }
  const z = Math.max(1, Number.isFinite(c.zoom) ? c.zoom : 1)
  rw /= z; rh /= z
  const hw = rw / 2, hh = rh / 2
  const cx = clamp(Number.isFinite(c.cx) ? c.cx : 0.5, hw / srcW, 1 - hw / srcW)
  const cy = clamp(Number.isFinite(c.cy) ? c.cy : 0.5, hh / srcH, 1 - hh / srcH)
  return { sx: cx * srcW - hw, sy: cy * srcH - hh, sw: rw, sh: rh }
}

/**
 * Where the stamp is allowed to live.
 *
 * In fill mode that is the whole sheet. In fit mode the photo is floating in a
 * white border, and a burn stamp glowing on the blank margin looks like a
 * caption someone typed on, not light leaking onto film — so it stays inside
 * the picture. Callers translate to this box and draw at its dimensions, which
 * also keeps the type scaled to the photo rather than to the paper.
 */
export function stampArea(
  mode: CropMode, cw: number, ch: number, srcW: number, srcH: number
): { x: number; y: number; w: number; h: number } {
  if (mode !== 'fit') return { x: 0, y: 0, w: cw, h: ch }
  const s = Math.min(cw / srcW, ch / srcH)
  const w = srcW * s, h = srcH * s
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
}

/**
 * How many real pixels survive the crop. The resolution warning has to read
 * this, not the photo's own dimensions — zoom in far enough and a sharp photo
 * stops being one.
 */
export function croppedPixels(
  srcW: number, srcH: number, size: string, crop?: Crop | null
): { w: number; h: number } {
  if (crop && crop.mode === 'fit') return { w: srcW, h: srcH }
  const r = cropRect(srcW, srcH, printAspect(size, srcW, srcH), crop)
  return { w: Math.round(r.sw), h: Math.round(r.sh) }
}

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
 * Produce the JPEG that will actually be printed: the photo cropped to the
 * exact shape of the paper, at print resolution, with the chosen filter applied
 * to the pixels and the stamp burned in on top of the cropped frame.
 *
 * The order of those steps is the whole point. Crop first, stamp second. Do it
 * the other way round — or leave the crop to the lab, as we did — and the
 * stamp is placed against an edge that no longer exists by the time the photo
 * reaches paper.
 */
export async function renderForPrint(
  file: File,
  filter: Filter,
  stamp: StampConfig,
  size: string = '4x6',
  crop?: Crop | null
): Promise<{ blob: Blob; width: number; height: number }> {
  const filterCss = getFCss(filter)
  const needsStamp = stampIsVisible(stamp)

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

  const srcW = bitmap.width, srcH = bitmap.height
  const mode: CropMode = crop?.mode ?? 'fill'
  const aspect = printAspect(size, srcW, srcH)

  // The canvas is the PAPER, not the photo. Everything below — the crop, the
  // letterbox, the stamp — is positioned against these dimensions, so what
  // this function returns is already the exact shape Prodigi is going to
  // print and there is nothing left for the lab to trim.
  const rect = cropRect(srcW, srcH, aspect, crop)
  const srcLong = mode === 'fit' ? Math.max(srcW, srcH) : Math.max(rect.sw, rect.sh)
  const outLong = Math.min(MAX_PRINT_PIXELS, Math.max(1, Math.round(srcLong)))
  const cw = aspect >= 1 ? outLong : Math.max(1, Math.round(outLong * aspect))
  const ch = aspect >= 1 ? Math.max(1, Math.round(outLong / aspect)) : outLong

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

  if (mode === 'fit') {
    // Nothing is allowed to be cut, so the paper shows through on two sides.
    // Paint it first: an unpainted canvas encodes to black in a JPEG.
    ctx.filter = 'none'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, cw, ch)
    if (filterCss !== 'none' && 'filter' in ctx) ctx.filter = filterCss
    const s = Math.min(cw / srcW, ch / srcH)
    const dw = srcW * s, dh = srcH * s
    ctx.drawImage(bitmap, 0, 0, srcW, srcH, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
  } else {
    ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, cw, ch)
  }
  ctx.filter = 'none'
  bitmap.close()

  if (needsStamp) {
    const area = stampArea(mode, cw, ch, srcW, srcH)
    await ensureStampFont(stamp.stampFont ?? 'classic', area.w * 0.022)
    ctx.save()
    ctx.translate(area.x, area.y)
    drawStamp(ctx, area.w, area.h, stamp)
    ctx.restore()
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
