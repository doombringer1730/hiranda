import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PRODUCTS, type Category, type Product } from './catalog'
import type { VendorSpec } from './vendors/types'

// Every product the Store knows: the built-in ones (catalog.ts) plus those
// added from /store/admin/catalog (store_products, read with the service role
// so cost never reaches the browser).

type Row = {
  key: string; title: string; blurb: string; image_url: string | null; emoji: string; category: Category
  price_cents: number; vendor: VendorSpec; delivery: string | null; active: boolean
}

const toProduct = (r: Row): Product => ({
  key: r.key, title: r.title, blurb: r.blurb, emoji: r.emoji, priceCents: r.price_cents, ships: true,
  category: r.category, vendor: r.vendor, image: r.image_url ?? undefined, delivery: r.delivery ?? undefined,
})

const added = cache(async (): Promise<(Product & { active: boolean })[]> => {
  const { data } = await createAdminClient().from('store_products')
    .select('key, title, blurb, image_url, emoji, category, price_cents, vendor, delivery, active')
    .order('sort').order('created_at')
  return (data as Row[] | null ?? []).map(r => ({ ...toProduct(r), active: r.active }))
})

/** What shoppers can buy right now. */
export async function storeProducts(): Promise<Product[]> {
  const builtIn = new Set(PRODUCTS.map(p => p.key))
  return [...PRODUCTS, ...(await added()).filter(p => p.active && !builtIn.has(p.key))]
}

/** A product by key — for sending a gift, only what's on sale; for orders
 *  already paid, also products since taken off the shelf. */
export async function findProduct(key: string, { includeInactive = false } = {}): Promise<Product | null> {
  return PRODUCTS.find(p => p.key === key)
    ?? (await added()).find(p => p.key === key && (includeInactive || p.active))
    ?? null
}

/** Emoji/photo/title for any product ever sold, for order lists. */
export async function productLookup() {
  const all = [...PRODUCTS, ...(await added())]
  return (key: string) => all.find(p => p.key === key) ?? null
}
