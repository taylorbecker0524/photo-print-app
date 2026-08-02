import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns the signed-in customer's own orders (for the /archive page).
//
// The orders table has RLS on with no public policies, so the browser can't read
// it directly. Instead the client sends its Supabase session token; we validate
// it here to learn who the user is, then read THAT user's orders with the service
// role. A caller can only ever see orders matching their own verified email.
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

  // Validate the caller's session token and get their verified email.
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(token)
  if (userErr || !user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Read this user's orders with the service role (bypasses RLS).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin
    .from('orders')
    .select('id, status, total_cents, items, created_at, tracking_number, tracking_url')
    .ilike('email', user.email)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('[my-orders]', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }

  const orders = await Promise.all(
    (data ?? []).map(async (o: any) => {
      const items = Array.isArray(o.items) ? o.items : []
      // Signed thumbnail for the first photo (private bucket, 1h expiry).
      let thumbnailUrl: string | null = null
      const firstPath = items[0]?.photo_path
      if (firstPath) {
        const { data: signed } = await admin.storage
          .from('print-photos')
          .createSignedUrl(firstPath, 60 * 60)
        thumbnailUrl = signed?.signedUrl ?? null
      }
      return {
        id: o.id,
        status: o.status,
        totalCents: o.total_cents,
        createdAt: o.created_at,
        trackingUrl: o.tracking_url,
        itemCount: items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
        itemSummary: items.map((i: any) => `${i.quantity}× ${i.size}"`).join(', '),
        thumbnailUrl,
      }
    })
  )

  return NextResponse.json({ email: user.email, orders })
}
