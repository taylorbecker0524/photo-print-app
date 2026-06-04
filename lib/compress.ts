// Client-side image compression for print uploads.
// Goal: shrink iPhone-sized 4-6MB images to ~400KB while preserving print quality.
//
// Math: highest size we sell is 8x10" at 300 DPI = 2400 × 3000 pixels.
// JPEG quality 85 gives near-lossless visual fidelity on photos at ~1/10 file size.
//
// This runs in the browser so the network only sees the small version. Big win:
// Prodigi processing time, Supabase storage cost, mobile data usage, upload speed.

const MAX_PRINT_PIXELS = 3000  // longest edge for 8x10 @ 300dpi
const JPEG_QUALITY = 0.85
const COMPRESS_TIMEOUT_MS = 30000  // safety cap; large HEIC can take a while

export type CompressResult = {
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

/**
 * Compress an image file to a JPEG suitable for printing up to 8x10 @ 300dpi.
 * Preserves aspect ratio. Downscales if larger than MAX_PRINT_PIXELS on either edge.
 * Returns the original blob unchanged if it's already smaller than the target.
 */
export async function compressForPrint(file: File): Promise<CompressResult> {
  const originalSize = file.size

  // Load the image. Using createImageBitmap is faster and handles HEIC/EXIF
  // orientation correctly on modern browsers.
  let bitmap: ImageBitmap
  try {
    bitmap = await withTimeout(createImageBitmap(file, { imageOrientation: 'from-image' }), COMPRESS_TIMEOUT_MS)
  } catch (err) {
    // Fallback for browsers that don't support createImageBitmap options
    try {
      bitmap = await withTimeout(createImageBitmap(file), COMPRESS_TIMEOUT_MS)
    } catch {
      throw new Error(`Could not decode image: ${file.name}`)
    }
  }

  const { width: srcW, height: srcH } = bitmap
  const longestEdge = Math.max(srcW, srcH)
  const scale = longestEdge > MAX_PRINT_PIXELS ? MAX_PRINT_PIXELS / longestEdge : 1
  const targetW = Math.round(srcW * scale)
  const targetH = Math.round(srcH * scale)

  // If image is already small AND already JPEG, skip compression to preserve quality
  if (scale === 1 && file.type === 'image/jpeg' && file.size < 800_000) {
    bitmap.close()
    return {
      blob: file,
      width: srcW,
      height: srcH,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    }
  }

  // Draw to canvas at target size
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas 2D context not available')
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()

  // Encode to JPEG. toBlob is async but unmonitored — race against timeout.
  const blob = await withTimeout(
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
        'image/jpeg',
        JPEG_QUALITY
      )
    }),
    COMPRESS_TIMEOUT_MS
  )

  return {
    blob,
    width: targetW,
    height: targetH,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: originalSize / blob.size,
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Image processing timed out')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

/**
 * Upload a compressed photo to /api/upload. Returns the Supabase path.
 * The caller should use this path in the cart instead of the local fileName.
 */
export async function uploadCompressed(blob: Blob, originalFileName: string): Promise<string> {
  const formData = new FormData()
  // Send as .jpg since we always compress to JPEG
  const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '.jpg')
  formData.append('photo', new File([blob], safeName, { type: 'image/jpeg' }))

  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upload failed (${res.status}): ${text || 'unknown error'}`)
  }
  const data = await res.json()
  if (!data.path) throw new Error('Upload response missing path')
  return data.path as string
}
