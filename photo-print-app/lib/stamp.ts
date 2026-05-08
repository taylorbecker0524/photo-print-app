import sharp from 'sharp'

export type StampConfig = {
  showDate: boolean
  showTime: boolean
  showLocation: boolean
  locationText: string
  customText: string
  position: 'bl' | 'br' | 'tl' | 'tr' | 'back'
  style: string
  fontSize: 'sm' | 'md' | 'lg'
  capturedAt?: string  // ISO date string from client
}

const STYLE_COLORS: Record<string, { bg: string; text: string }> = {
  classic: { bg: 'rgba(0,0,0,0.6)',   text: '#ffffff' },
  amber:   { bg: 'rgba(20,14,0,0.85)', text: '#FABC40' },
  white:   { bg: 'rgba(255,255,255,0.85)', text: '#111111' },
  neon:    { bg: 'rgba(0,0,0,0.9)',   text: '#39ff14' },
  retro:   { bg: 'rgba(40,22,10,0.9)', text: '#e8c99a' },
}

/**
 * Applies the date/time/location stamp to a photo buffer.
 * Returns a new JPEG buffer ready for storage + printing.
 */
export async function stampImage(
  inputBuffer: Buffer,
  stamp: StampConfig,
  size: string
): Promise<Buffer> {
  const image = sharp(inputBuffer)
  const meta = await image.metadata()
  const w = meta.width ?? 1200
  const h = meta.height ?? 800

  // Build stamp lines
  const lines: string[] = []
  const capturedAt = stamp.capturedAt ? new Date(stamp.capturedAt) : new Date()
  if (stamp.showDate) lines.push(capturedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
  if (stamp.showTime) lines.push(capturedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  if (stamp.showLocation && stamp.locationText) lines.push(stamp.locationText)
  if (stamp.customText) lines.push(stamp.customText)

  if (lines.length === 0 || stamp.position === 'back' || stamp.style === 'none') {
    // No front stamp needed — just resize and return
    return resizeForPrint(image, size)
  }

  const fontSize = stamp.fontSize === 'sm' ? Math.round(w * 0.028)
                 : stamp.fontSize === 'lg' ? Math.round(w * 0.052)
                 : Math.round(w * 0.038)

  const pad = Math.round(w * 0.025)
  const lineH = Math.round(fontSize * 1.5)
  const boxH = lines.length * lineH + pad
  const approxCharW = fontSize * 0.6
  const boxW = Math.round(Math.max(...lines.map(l => l.length)) * approxCharW) + pad * 2

  const colors = STYLE_COLORS[stamp.style] ?? STYLE_COLORS.classic

  let x = pad, y = pad
  if (stamp.position === 'bl') { x = pad; y = h - boxH - pad }
  if (stamp.position === 'br') { x = w - boxW - pad; y = h - boxH - pad }
  if (stamp.position === 'tr') { x = w - boxW - pad; y = pad }
  if (stamp.position === 'tl') { x = pad; y = pad }

  const textRows = lines.map((line, i) =>
    `<text x="${pad}" y="${pad + (i + 1) * lineH - Math.round(lineH * 0.15)}"
      font-family="monospace" font-size="${fontSize}" font-weight="bold"
      fill="${colors.text}">${escapeXml(line)}</text>`
  ).join('\n')

  const svgOverlay = Buffer.from(`
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${x}, ${y})">
        <rect width="${boxW}" height="${boxH}" rx="${Math.round(fontSize * 0.35)}"
          fill="${colors.bg}"/>
        ${textRows}
      </g>
    </svg>
  `)

  const stamped = await sharp(inputBuffer)
    .composite([{ input: svgOverlay, blend: 'over' }])
    .toBuffer()

  return resizeForPrint(sharp(stamped), size)
}

async function resizeForPrint(image: sharp.Sharp, size: string): Promise<Buffer> {
  // Output at 300 DPI for print quality
  const DPI = 300
  const sizes: Record<string, [number, number]> = {
    '4x6':      [4 * DPI, 6 * DPI],
    '5x7':      [5 * DPI, 7 * DPI],
    '8x10':     [8 * DPI, 10 * DPI],
    'square-4': [4 * DPI, 4 * DPI],
    'square-5': [5 * DPI, 5 * DPI],
    'square-8': [8 * DPI, 8 * DPI],
  }
  const [pw, ph] = sizes[size] ?? [1200, 1800]
  return image
    .resize(pw, ph, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 95 })
    .toBuffer()
}

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
