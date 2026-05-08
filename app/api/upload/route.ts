import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { stampImage, StampConfig } from '@/lib/stamp'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('photo') as File | null
    const stampJson = formData.get('stamp') as string | null
    const size = (formData.get('size') as string) ?? '4x6'

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
    }

    // Validate file type and size (max 20MB)
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    const stamp: StampConfig = stampJson ? JSON.parse(stampJson) : { position: 'none' }

    // Convert to buffer and apply stamp
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)
    const processedBuffer = await stampImage(inputBuffer, stamp, size)

    // Upload to Supabase private bucket (not publicly accessible)
    const supabase = createServerSupabase()
    const path = `uploads/${randomUUID()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('print-photos')  // private bucket — create this in Supabase dashboard
      .upload(path, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Return only the internal path — never a public URL
    return NextResponse.json({ path, size })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
