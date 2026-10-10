'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { getStripe, stripeOpenTo } from '@/lib/billing'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPartner, myFirstName } from '@/lib/push'
import { SHIP_TO, SIZE_KINDS, sameSize } from '@/lib/store/catalog'
import { findProduct } from '@/lib/store/products'
import { PRINT_KINDS, isPrintKind, parsePhotoIds, type PrintKind } from '@/lib/store/prints'
import { isStoreAdmin, storeEnabled } from '@/lib/store/server'
import { usStateCode } from '@/lib/store/vendors/us-states'

export type Address = {
  full_name: string; line1: string; line2: string | null; city: string
  region: string | null; postal_code: string; country: string; phone: string | null
}

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max)

// Your private gift address (only you, and the store when shipping, see it).
export async function saveAddress(form: FormData): Promise<{ ok?: true; error?: string }> {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const a = {
    full_name: clean(form.get('full_name'), 120), line1: clean(form.get('line1'), 200),
    line2: clean(form.get('line2'), 200) || null, city: clean(form.get('city'), 120),
    region: clean(form.get('region'), 120) || null, postal_code: clean(form.get('postal_code'), 20),
    country: clean(form.get('country'), 2).toUpperCase() || 'US', phone: clean(form.get('phone'), 40) || null,
  }
  if (!a.full_name || !a.line1 || !a.city || !a.postal_code) return { error: 'Name, street, city and postal code are needed.' }
  if (!(SHIP_TO as readonly string[]).includes(a.country)) return { error: `For now gifts ship within: ${SHIP_TO.join(', ')}.` }
  if (a.country === 'US') {
    const state = usStateCode(a.region)
    if (!state) return { error: 'Add your state (like NY or New York).' }
    a.region = state
  }
  const { error } = await ctx.supabase.from('store_addresses').upsert({ user_id: ctx.user.id, ...a, updated_at: new Date().toISOString() })
  if (error) return { error: 'Couldn’t save — try again.' }
  revalidatePath('/store')
  return { ok: true }
}

export async function removeAddress() {
  const ctx = await coupleContext()
  if (!ctx) return
  await ctx.supabase.from('store_addresses').delete().eq('user_id', ctx.user.id)
  revalidatePath('/store')
}

// A gentle nudge so your partner adds an address (they never see yours).
export async function askForAddress() {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  notifyPartner(async () => ({
    title: `${await myFirstName()} wants to send you something 👀`,
    body: 'Add a delivery address in Hiranda — only you can see it.',
    url: '/store/address',
    tag: 'store-address',
  }))
  return { ok: true }
}

async function origin() {
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
}

// Start a gift: record it as pending, then hand off to Stripe Checkout.
export async function startGift(productKey: string, note: string, option?: string): Promise<{ url?: string; error?: string }> {
  if (!storeEnabled()) return { error: 'The store opens soon.' }
  const product = await findProduct(productKey)
  if (!product) return { error: 'Unknown gift' }
  if (product.prints) return { error: 'Pick the photos for this one from your memories.' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Gifts are for your partner — invite them first.' }
  if (!stripeOpenTo(ctx.user.email)) return { error: 'The store opens soon.' }
  const { data: hasAddress } = await ctx.supabase.rpc('partner_has_gift_address')
  if (!hasAddress) return { error: 'Your partner hasn’t added a delivery address yet.' }

  // Keepsakes print both first names — don't let one come out as "me" / "you".
  if (product.vendor?.name === 'printful' || product.vendor?.name === 'printify') {
    const { data: people } = await createAdminClient().from('profiles').select('id, display_name').in('id', [ctx.user.id, ctx.partnerId])
    const named = (id: string) => !!people?.find(p => p.id === id)?.display_name?.trim()
    if (!named(ctx.user.id)) return { error: 'Add your name in Settings first — it’s printed on this one.' }
    if (!named(ctx.partnerId)) return { error: 'Your partner hasn’t set their name yet — it’s printed on this one.' }
  }

  // A size: your partner's saved one if they have it (private — you never
  // see it), otherwise the one you picked.
  let picked: string | undefined
  let privateSize = false
  if (product.options) {
    const kind = product.options.kind ?? 'top'
    const { data: sizes } = await createAdminClient().from('gift_sizes').select('top, bottom, shoe').eq('user_id', ctx.partnerId).maybeSingle()
    const saved = sizes?.[kind] as string | null | undefined
    if (saved) {
      picked = product.options.values.find(v => sameSize(v.label, saved))?.label
      if (!picked) return { error: 'Their saved size isn’t available for this one — try another gift.' }
      privateSize = true
    } else {
      picked = product.options.values.find(v => v.label === option)?.label
      if (!picked) return { error: `Pick a ${product.options.name.toLowerCase()} first.` }
    }
  }

  const text = note.trim().slice(0, 300) || null
  const { data: order, error } = await ctx.supabase.from('store_orders').insert({
    couple_id: ctx.couple.id, sender_id: ctx.user.id, recipient_id: ctx.partnerId,
    product_key: product.key, title: product.title, note: text, amount_cents: product.priceCents,
    option: picked ?? null,
  }).select('id').single()
  if (error || !order) return { error: 'Couldn’t start the order — try again.' }

  return checkout(order.id, picked && !privateSize ? `${product.title} (${product.options!.name}: ${picked})` : product.title,
    product.priceCents, ctx.user.email, '/store')
}

// Hand a pending order to Stripe Checkout.
async function checkout(orderId: string, name: string, cents: number, email: string | null | undefined, back: string) {
  const base = await origin()
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name } } }],
    customer_email: email ?? undefined,
    metadata: { order_id: orderId, kind: 'gift' },
    payment_intent_data: { metadata: { order_id: orderId } },
    success_url: `${base}/store/thanks?o=${orderId}`,
    cancel_url: `${base}${back}`,
  })
  // Only the server can write the session id onto the order.
  await createAdminClient().from('store_orders').update({ stripe_session_id: session.id }).eq('id', orderId).eq('status', 'pending')
  return session.url ? { url: session.url } : { error: 'Couldn’t open checkout — try again.' }
}

// Prints from your memories (/store/print): Polaroids or a photo book, sent
// to your partner like any gift. The photos must be ones you two uploaded.
export async function startPrintOrder(kind: PrintKind, photoIds: string[], note: string): Promise<{ url?: string; error?: string }> {
  if (!storeEnabled()) return { error: 'The store opens soon.' }
  if (!isPrintKind(kind)) return { error: 'Unknown print' }
  const cfg = PRINT_KINDS[kind]
  const product = await findProduct(cfg.productKey)
  if (!product?.prints) return { error: 'Prints aren’t available right now.' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Prints are for your partner — invite them first.' }
  if (!stripeOpenTo(ctx.user.email)) return { error: 'The store opens soon.' }
  const { data: hasAddress } = await ctx.supabase.rpc('partner_has_gift_address')
  if (!hasAddress) return { error: 'Your partner hasn’t added a delivery address yet.' }

  const wanted = parsePhotoIds(photoIds.join(','), cfg.max)
  if (!wanted.length) return { error: 'Pick some photos first.' }
  // Your couple's photos only (row-level security), kept in the order picked.
  const { data: rows } = await ctx.supabase.from('photos').select('id').in('id', wanted)
  const ok = new Set((rows ?? []).map(r => r.id))
  const ids = wanted.filter(id => ok.has(id))
  if (ids.length !== wanted.length) return { error: 'Some of those photos aren’t available anymore. Pick them again.' }

  const title = cfg.title(ids.length)
  const cents = cfg.priceCents(ids.length)
  const { data: order, error } = await ctx.supabase.from('store_orders').insert({
    couple_id: ctx.couple.id, sender_id: ctx.user.id, recipient_id: ctx.partnerId,
    product_key: product.key, title, note: note.trim().slice(0, 300) || null, amount_cents: cents, photos: ids,
  }).select('id').single()
  if (error || !order) return { error: 'Couldn’t start the order — try again.' }
  // Cancelling comes back to the same picks, when the link stays short enough for Stripe.
  const back = `/store/print?kind=${kind}&photos=${ids.join(',')}`
  return checkout(order.id, title, cents, ctx.user.email, back.length < 1500 ? back : '/store')
}

export async function confirmArrived(orderId: string) {
  const ctx = await coupleContext()
  if (!ctx) return
  await ctx.supabase.rpc('confirm_gift_arrived', { p_order: orderId })
  revalidatePath('/')
}

// ── Owner: fulfilment ──

async function requireAdmin() {
  const ctx = await coupleContext()
  return ctx && isStoreAdmin(ctx.user.email) ? ctx : null
}

export async function setOrderStatus(orderId: string, status: 'fulfilling' | 'shipped' | 'delivered' | 'canceled', tracking?: string) {
  if (!(await requireAdmin())) return { error: 'Not allowed' }
  const db = createAdminClient()
  const patch: Record<string, string> = { status, updated_at: new Date().toISOString() }
  const url = tracking?.trim()
  if (url) {
    try { if (new URL(url).protocol !== 'https:') throw 0 } catch { return { error: 'Tracking must be an https link' } }
    patch.tracking_url = url.slice(0, 500)
  }
  const { data: order } = await db.from('store_orders').update(patch).eq('id', orderId).neq('status', 'pending')
    .select('recipient_id, sender_id').maybeSingle()
  if (order && status === 'shipped') {
    const { notifyUser } = await import('@/lib/push')
    await notifyUser(order.recipient_id, { title: '📦 Your gift has shipped', body: 'It’s on the way to you.', url: '/', tag: `gift-${orderId}` })
  }
  revalidatePath('/store/admin')
  return { ok: true }
}

// Hand a paid gift to its supplier now (first time, or after fixing a problem).
export async function sendToSupplier(orderId: string) {
  if (!(await requireAdmin())) return { error: 'Not allowed' }
  const { fulfilOrder } = await import('@/lib/store/fulfil')
  const res = await fulfilOrder(orderId)
  revalidatePath('/store/admin')
  return res.manual ? { error: 'This gift has no supplier set up — ship it by hand.' } : res
}

// Ask the supplier for news (status, tracking) right now.
export async function checkSupplier(orderId: string) {
  if (!(await requireAdmin())) return { error: 'Not allowed' }
  const { refreshOrder } = await import('@/lib/store/fulfil')
  const res = await refreshOrder(orderId)
  revalidatePath('/store/admin')
  return res
}

// Register our tracking webhook with a supplier that allows it over its API.
export async function connectSupplierWebhook(vendor: string): Promise<{ ok?: string; error?: string }> {
  if (!(await requireAdmin())) return { error: 'Not allowed' }
  const { VENDORS } = await import('@/lib/store/vendors')
  const v = VENDORS[vendor as keyof typeof VENDORS]
  if (!v?.connectWebhook) return { error: 'This supplier is set up in its own dashboard.' }
  try {
    return { ok: await v.connectWebhook() }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Couldn’t connect.' }
  }
}

// Owner: move a seller application along (/store/admin/sellers).
export async function setApplicationStatus(id: string, status: 'new' | 'contacted' | 'approved' | 'declined') {
  if (!(await requireAdmin())) return { error: 'Not allowed' }
  if (!['new', 'contacted', 'approved', 'declined'].includes(status)) return { error: 'Unknown status' }
  await createAdminClient().from('seller_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/store/admin/sellers')
  return { ok: true }
}

// ── Sizes (private, like your address) ──

export async function saveSizes(form: FormData): Promise<{ ok?: true; error?: string }> {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const row: Record<string, string | null> = {}
  for (const k of SIZE_KINDS) {
    const v = String(form.get(k.key) ?? '').trim()
    row[k.key] = k.choices.includes(v) ? v : null
  }
  const { error } = await ctx.supabase.from('gift_sizes').upsert({ user_id: ctx.user.id, ...row, updated_at: new Date().toISOString() })
  if (error) return { error: 'Couldn’t save — try again.' }
  revalidatePath('/store')
  return { ok: true }
}

// "Add your sizes" — a nudge to your partner (they never share them with you).
export async function askForSizes() {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  notifyPartner(async () => ({
    title: `${await myFirstName()} wants to get you something that fits 👀`,
    body: 'Add your sizes in Hiranda — they stay private, even from them.',
    url: '/store/address',
    tag: 'store-sizes',
  }))
  return { ok: true }
}
