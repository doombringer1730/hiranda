import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshOrder } from '@/lib/store/fulfil'

// Goody → order.shipped / order.delivered / order.canceled… Add this URL in
// Goody (Organization → Automation API → Webhooks) and put its signing
// secret in GOODY_WEBHOOK_SECRET. Goody signs with Svix:
//   base64(HMAC-SHA256(key, `${svix-id}.${svix-timestamp}.${body}`))
// where key is the secret after "whsec_", base64-decoded.

const TOLERANCE_S = 5 * 60

function verify(secret: string, id: string, ts: string, body: string, header: string) {
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > TOLERANCE_S) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const want = Buffer.from(createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64'))
  return header.split(' ').some(part => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const got = Buffer.from(sig)
    return got.length === want.length && timingSafeEqual(got, want)
  })
}

export async function POST(request: Request) {
  const secret = process.env.GOODY_WEBHOOK_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })
  const raw = await request.text()
  const h = request.headers
  if (!verify(secret, h.get('svix-id') ?? '', h.get('svix-timestamp') ?? '', raw, h.get('svix-signature') ?? '')) {
    return new Response('Bad signature', { status: 400 })
  }
  let goodyOrderId = ''
  try {
    const event = JSON.parse(raw) as { data?: { id?: unknown } }
    if (typeof event.data?.id === 'string') goodyOrderId = event.data.id
  } catch { /* ignore */ }
  if (goodyOrderId) {
    after(async () => {
      const { data } = await createAdminClient().from('store_orders').select('id')
        .eq('vendor', 'goody').eq('vendor_order_id', goodyOrderId).maybeSingle()
      if (data) await refreshOrder(data.id).catch(() => {})
    })
  }
  return Response.json({ ok: true })
}
