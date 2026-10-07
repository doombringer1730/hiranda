import { timingSafeEqual } from 'node:crypto'
import { revenueCatConfigured, syncApplePlus } from '@/lib/billing'

// RevenueCat → Hiranda Plus (Apple in-app purchases). In RevenueCat →
// Integrations → Webhooks, set this URL and an Authorization header value;
// put the same value in REVENUECAT_WEBHOOK_AUTH. We don't trust the event
// body — it only says *whose* subscription changed; we re-read the truth
// from RevenueCat's API.
function authorized(header: string | null) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH
  if (!expected || !header) return false
  const a = Buffer.from(header), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!revenueCatConfigured()) return new Response('Not configured', { status: 503 })
  if (!authorized(request.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 })
  const body = (await request.json().catch(() => null)) as { event?: { app_user_id?: string; original_app_user_id?: string } } | null
  const ids = new Set([body?.event?.app_user_id, body?.event?.original_app_user_id].filter((x): x is string => !!x))
  try {
    for (const id of ids) await syncApplePlus(id)
  } catch {
    return new Response('Failed', { status: 500 })
  }
  return Response.json({ ok: true })
}
