import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshOrder } from '@/lib/store/fulfil'
import { webhookKeyOk } from '@/lib/store/webhook-key'

// Printful → package_shipped, order_updated… Registered from
// /store/admin/suppliers ("Turn on tracking"). Printful's v1 webhooks aren't
// signed: we check the key, then ask Printful itself for the order.

export async function POST(request: Request) {
  if (!webhookKeyOk(request)) return new Response('Forbidden', { status: 403 })
  const body = await request.json().catch(() => null) as { data?: { order?: { id?: unknown } } } | null
  const pfId = body?.data?.order?.id
  if (typeof pfId === 'number' || typeof pfId === 'string') {
    after(async () => {
      const { data } = await createAdminClient().from('store_orders').select('id')
        .eq('vendor', 'printful').eq('vendor_order_id', String(pfId)).maybeSingle()
      if (data) await refreshOrder(data.id).catch(() => {})
    })
  }
  return Response.json({ ok: true })
}
