import { timingSafeEqual } from 'node:crypto'
import { syncOrders } from '@/lib/store/fulfil'

// Daily (vercel.json cron): send paid gifts that didn't go out and check
// every gift in flight with its supplier. Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = request.headers.get('authorization') ?? ''
  const want = `Bearer ${secret}`
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
    return new Response('Forbidden', { status: 403 })
  }
  return Response.json(await syncOrders())
}
