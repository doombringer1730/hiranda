import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { GIFT_SEARCHES } from '@/lib/store/gift-searches'
import { notifyAdmins } from '@/lib/store/server'
import { VENDORS } from '@/lib/store/vendors'
import { cjPopular } from '@/lib/store/vendors/cj'

// Monthly (vercel.json cron): look for couple gifts that took off on CJ in
// the last few weeks and aren't in the Store yet, and nudge the owner to
// review them at /store/admin/catalog.

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = request.headers.get('authorization') ?? ''
  const want = `Bearer ${secret}`
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
    return new Response('Forbidden', { status: 403 })
  }
  if (!VENDORS.cj.configured()) return Response.json({ skipped: 'CJ not connected' })

  const { data } = await createAdminClient().from('store_products').select('source_ref')
  const have = new Set((data ?? []).map(r => r.source_ref))
  const fresh = new Map<string, string>()
  for (const s of GIFT_SEARCHES) {
    try {
      const items = await cjPopular(s.q, { newOnly: true })
      for (const p of items.slice(0, 4)) if (p.listed >= 20 && !have.has(`cj:${p.pid}`)) fresh.set(p.pid, s.label)
    } catch { /* skip this search */ }
    await new Promise(r => setTimeout(r, 1200)) // CJ allows about one request a second
  }
  if (fresh.size) {
    const kinds = [...new Set(fresh.values())].slice(0, 3).join(', ')
    await notifyAdmins('Fresh gift ideas this month ✨', `${fresh.size} popular new couple gifts to look at — ${kinds}…`, '/store/admin/catalog?q=teddy+bear&view=new')
  }
  return Response.json({ fresh: fresh.size })
}
