'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/store/server'

// "Sell on Hiranda" applications from the public /sell page. Written with the
// service role (the table has no policies). A hidden field catches bots, and
// each network can send a few a day.

export type ApplyState = { ok?: true; error?: string }

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PRICES = new Set(['under-25', '25-50', '50-100', '100-plus'])

export async function applyToSell(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  if (clean(form.get('company_url'), 200)) return { ok: true } // bots fill the hidden field

  const a = {
    business_name: clean(form.get('business_name'), 120),
    contact_name: clean(form.get('contact_name'), 120),
    email: clean(form.get('email'), 200).toLowerCase(),
    website: clean(form.get('website'), 300) || null,
    what_you_sell: clean(form.get('what_you_sell'), 1000),
    price_range: clean(form.get('price_range'), 40) || null,
    ships_from: clean(form.get('ships_from'), 120) || null,
  }
  if (!a.business_name || !a.contact_name || !a.what_you_sell) return { error: 'Please fill in your shop, your name and what you’d sell.' }
  if (!EMAIL.test(a.email)) return { error: 'That email doesn’t look right.' }
  if (a.price_range && !PRICES.has(a.price_range)) a.price_range = null
  if (a.website) {
    const url = /^https?:\/\//i.test(a.website) ? a.website : `https://${a.website}`
    try { a.website = new URL(url).toString().slice(0, 300) } catch { return { error: 'That website link doesn’t look right.' } }
  }
  if (form.get('ships_us') !== 'on') return { error: 'For now, sellers need to ship within the US with tracking.' }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const ipHash = createHash('sha256').update(`seller:${ip}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex')

  const db = createAdminClient()
  const day = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await db.from('seller_applications').select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', day)
  if ((count ?? 0) >= 3) return { error: 'We’ve had a few applications from here today — try again tomorrow.' }

  // Already applied recently? Don't make a duplicate; just say thanks.
  const month = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: dupe } = await db.from('seller_applications').select('id').eq('email', a.email).gte('created_at', month).limit(1).maybeSingle()
  if (dupe) return { ok: true }

  const { data: { user } } = await (await createClient()).auth.getUser()
  const { error } = await db.from('seller_applications').insert({ ...a, ip_hash: ipHash, user_id: user?.id ?? null })
  if (error) return { error: 'Couldn’t send it — please try again.' }

  await notifyAdmins('New seller application', `${a.business_name} — ${a.what_you_sell.slice(0, 80)}`, '/store/admin/sellers').catch(() => {})
  return { ok: true }
}
