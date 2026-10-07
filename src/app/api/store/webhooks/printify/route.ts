import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshOrder } from '@/lib/store/fulfil'

// Printify → order:updated, order:shipment:created/delivered. Registered from
// /store/admin/suppliers with STORE_WEBHOOK_KEY as the secret; Printify signs
// each body: X-Pfy-Signature: sha256=<hex HMAC-SHA256(secret, raw body)>.

export async function POST(request: Request) {
  const secret = process.env.STORE_WEBHOOK_KEY
  if (!secret) return new Response('Not configured', { status: 503 })
  const raw = await request.text()
  const want = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`)
  const got = Buffer.from(request.headers.get('x-pfy-signature') ?? '')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return new Response('Bad signature', { status: 400 })

  let printifyId = ''
  try {
    const event = JSON.parse(raw) as { resource?: { id?: unknown; type?: unknown } }
    if (event.resource?.type === 'order' && typeof event.resource.id === 'string') printifyId = event.resource.id
  } catch { /* ignore */ }
  if (printifyId) {
    after(async () => {
      const { data } = await createAdminClient().from('store_orders').select('id')
        .eq('vendor', 'printify').eq('vendor_order_id', printifyId).maybeSingle()
      if (data) await refreshOrder(data.id).catch(() => {})
    })
  }
  return Response.json({ ok: true })
}
