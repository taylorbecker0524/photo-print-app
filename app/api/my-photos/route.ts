import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns the signed-in customer's previously ordered photos (for the /reorder page).
//
// Same security model as /api/my-orders: the browser can't read the orders table
// directly (RLS, no public policies), so it sends its Supabase session token. We
// validate it to learn who the caller is, then read THAT user's orders with the
// service role and flatten their photos. A caller only ever sees their own photos.
//
// Photos are de-duplicated by storage path (a photo ordered multiple times shows
// once, carrying the most-recent size/stamp so re-ordering matches the last print).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(token)
  if (userErr || !user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin
    .from('orders')
    .select('items, created_at')
    .ilike('email', user.email)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('[my-photos]', error)
    return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 })
  }

  // Flatten every ordered item, keeping the most recent occurrence of each photo.
  // Orders are already newest-first, so the first time we see a path is the latest.
  const seen = new Map<string, { size: string; stamp: any; lastOrderedAt: string }>()
  for (const order of data ?? []) {
    const items = Array.isArray((order as any).items) ? (order as any).items : []
    for (const it of items) {
      const path = it?.photo_path
      if (!path || seen.has(path)) continue
      seen.set(path, {
        size: it.size ?? '4x6',
        stamp: it.stamp ?? null,
        lastOrderedAt: (order as any).created_at,
      })
    }
  }

  const photos = await Promise.all(
    Array.from(seen.entries()).map(async ([photoPath, meta]) => {
      let thumbnailUrl: string | null = null
      const { data: signed } = await admin.storage
        .from('print-photos')
        .createSignedUrl(photoPath, 60 * 60)
      thumbnailUrl = signed?.signedUrl ?? null
      // A friendly label from the storage filename (path is like "<uuid>-name.jpg").
      const base = photoPath.split('/').pop() ?? photoPath
      const fileName = base.replace(/^[0-9a-f-]{8,}-/i, '') || base
      return {
        photoPath,
        size: meta.size,
        stamp: meta.stamp,
        thumbnailUrl,
        fileName,
        lastOrderedAt: meta.lastOrderedAt,
      }
    })
  )

  return NextResponse.json({ email: user.email, photos })
}
