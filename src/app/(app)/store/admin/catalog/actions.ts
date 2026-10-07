'use server'

import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES, type Category } from '@/lib/store/catalog'
import { isStoreAdmin } from '@/lib/store/server'

// The owner's catalog: add supplier products to the Store, change prices,
// take them off the shelf.

async function admin() {
  const ctx = await coupleContext()
  return ctx && isStoreAdmin(ctx.user.email) ? ctx : null
}

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max)
const cents = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? '').replace(/[^0-9.]/g, '')) * 100)

function refresh() {
  revalidatePath('/store')
  revalidatePath('/store/admin/catalog')
}

export async function addCjProduct(form: FormData): Promise<{ ok?: true; error?: string }> {
  if (!(await admin())) return { error: 'Not allowed' }
  const title = clean(form.get('title'), 120)
  const blurb = clean(form.get('blurb'), 300)
  const category = clean(form.get('category'), 20) as Category
  const price = cents(form.get('price'))
  const cost = cents(form.get('cost'))
  const vid = clean(form.get('vid'), 80)
  const pid = clean(form.get('pid'), 80)
  const from = form.get('from') === 'US' ? 'US' : 'CN'
  const image = clean(form.get('image'), 500)
  const delivery = clean(form.get('delivery'), 80)
  const emoji = clean(form.get('emoji'), 16) || '🎁'

  if (!title || !vid) return { error: 'A name and a variant are needed.' }
  if (!CATEGORIES.some(c => c.key === category)) return { error: 'Pick a section.' }
  if (!(price >= 100 && price <= 100000)) return { error: 'Price looks off.' }
  if (cost && price < cost + 300) return { error: `That’s barely above cost (${(cost / 100).toFixed(2)}) — Stripe’s fee would eat it.` }

  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gift'
  const key = `${base}-${vid.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 60)
  const { error } = await createAdminClient().from('store_products').upsert({
    key, title, blurb, category, emoji,
    image_url: image.startsWith('https://') ? image : null,
    price_cents: price, cost_cents: cost || null,
    vendor: { name: 'cj', items: [{ vid, quantity: 1 }], from },
    delivery: delivery || null,
    source_ref: pid ? `cj:${pid}` : null,
    active: true, updated_at: new Date().toISOString(),
  })
  if (error) return { error: 'Couldn’t save — try again.' }
  refresh()
  return { ok: true }
}

export async function setProductActive(key: string, active: boolean) {
  if (!(await admin())) return { error: 'Not allowed' }
  await createAdminClient().from('store_products').update({ active, updated_at: new Date().toISOString() }).eq('key', key)
  refresh()
  return { ok: true }
}

export async function setProductPrice(key: string, price: string) {
  if (!(await admin())) return { error: 'Not allowed' }
  const c = Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100)
  if (!(c >= 100 && c <= 100000)) return { error: 'Price looks off.' }
  await createAdminClient().from('store_products').update({ price_cents: c, updated_at: new Date().toISOString() }).eq('key', key)
  refresh()
  return { ok: true }
}

export async function deleteProduct(key: string) {
  if (!(await admin())) return { error: 'Not allowed' }
  // Gifts still on their way need to know who makes them — hide it instead.
  const db = createAdminClient()
  const { count } = await db.from('store_orders').select('id', { count: 'exact', head: true })
    .eq('product_key', key).in('status', ['pending', 'paid', 'fulfilling'])
  if (count) return { error: 'Some gifts of this are still on their way — take it off the shelf instead.' }
  await db.from('store_products').delete().eq('key', key)
  refresh()
  return { ok: true }
}
