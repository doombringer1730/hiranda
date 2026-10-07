import 'server-only'
import { timingSafeEqual } from 'node:crypto'

/** For suppliers that can't sign webhooks: the ?key= we gave them must match
 *  STORE_WEBHOOK_KEY. Handlers then ask the supplier itself for the order, so
 *  nothing in the body is trusted. */
export function webhookKeyOk(request: Request) {
  const want = process.env.STORE_WEBHOOK_KEY
  const given = new URL(request.url).searchParams.get('key')
  if (!want || !given) return false
  const a = Buffer.from(want), b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}
