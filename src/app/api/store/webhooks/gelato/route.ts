import { after } from 'next/server'
import { refreshOrder } from '@/lib/store/fulfil'
import { webhookKeyOk } from '@/lib/store/webhook-key'

// Gelato → order status / tracking updates. In Gelato → Developer → Webhooks,
// add  https://hiranda.com/api/store/webhooks/gelato?key=<STORE_WEBHOOK_KEY>
// for "Order status updated" and "Order item tracking code updated".
// Gelato doesn't sign webhooks: we check the key, then ask Gelato itself.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  if (!webhookKeyOk(request)) return new Response('Forbidden', { status: 403 })
  const body = await request.json().catch(() => null) as { orderReferenceId?: unknown } | null
  const id = typeof body?.orderReferenceId === 'string' ? body.orderReferenceId : ''
  if (UUID.test(id)) after(() => refreshOrder(id).catch(() => {}))
  return Response.json({ ok: true })
}
