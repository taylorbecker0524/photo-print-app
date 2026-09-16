import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { createServerSupabase } = await import('@/lib/supabase')
    const formData = await req.formData()
    const file = formData.get('photo') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabase = createServerSupabase()

    // Supabase storage keeps its object metadata in Postgres, and on a small
    // instance a burst of uploads can exhaust that connection pool — the call
    // comes back with code 'DatabaseTimeout' after ~14 seconds. Nothing is
    // wrong with the photo, so retry here as well as on the client: catching it
    // server-side saves the customer a whole round trip.
    const MAX_ATTEMPTS = 3
    let lastError: unknown = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // A fresh path each attempt, so a write that half-succeeded upstream can
      // never collide with the retry.
      const path = `uploads/${randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('print-photos')
        .upload(path, buffer, { contentType: file.type, upsert: false })
      if (!uploadError) return NextResponse.json({ path })

      lastError = uploadError
      console.error(`[upload] attempt ${attempt}/${MAX_ATTEMPTS} failed`, uploadError)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
    throw lastError
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json(
      { error: 'We could not save that photo just now. Please try again.' },
      { status: 500 }
    )
  }
}
