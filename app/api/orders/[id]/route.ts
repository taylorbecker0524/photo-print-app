import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, tracking_number, tracking_url, total_cents, items, created_at, shipping_address')
    .eq('id', params.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Sanitize — never return photo_path or internal IDs to the client
  const safeItems = order.items.map((item: any) => ({
    size: item.size,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
  }))

  return NextResponse.json({
    id: order.id,
    status: order.status,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    totalCents: order.total_cents,
    items: safeItems,
    createdAt: order.created_at,
    shippingAddress: {
      name: order.shipping_address.name,
      city: order.shipping_address.city,
      state: order.shipping_address.state,
      country: order.shipping_address.country,
    },
  })
}
