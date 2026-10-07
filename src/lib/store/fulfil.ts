import 'server-only'
import { stripeTestMode } from '@/lib/billing'
import { notifyUser } from '@/lib/push'
import { createAdminClient } from '@/lib/supabase/admin'
import { findProduct } from './products'
import { notifyAdmins } from './server'
import { VENDORS, VendorError, type ShipTo } from './vendors'
import type { Vendor, VendorSpec } from './vendors/types'
import { usStateCode } from './vendors/us-states'

// Hands paid gifts to their supplier and follows them until they arrive.
//
//   paid ──fulfilOrder──▶ fulfilling ──refreshOrder──▶ shipped ──▶ delivered
//
// fulfilOrder runs right after Stripe confirms payment, again from the daily
// sync for anything that slipped through, and from the admin "Send" button.
// A product with no supplier (or no ids picked yet) stays 'paid' for the
// owner to ship by hand. Problems land in vendor_error for /store/admin.

const RANK: Record<string, number> = { paid: 0, fulfilling: 1, shipped: 2, delivered: 3 }
const now = () => new Date().toISOString()
const firstName = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || ''

/** The supplier that makes this product, if one is set up for it. */
export async function supplierFor(productKey: string): Promise<{ vendor: Vendor; spec: VendorSpec } | null> {
  const spec = (await findProduct(productKey, { includeInactive: true }))?.vendor
  if (!spec || spec.name === 'partner') return null // shipped by hand / by a partner
  const vendor = VENDORS[spec.name]
  return vendor.ready(spec) ? { vendor, spec } : null
}

export async function fulfilOrder(orderId: string): Promise<{ ok?: true; manual?: true; error?: string }> {
  const db = createAdminClient()
  const { data: order } = await db.from('store_orders')
    .select('id, product_key, note, sender_id, recipient_id, status, vendor, vendor_order_id')
    .eq('id', orderId).maybeSingle()
  if (!order || order.status !== 'paid' || order.vendor_order_id) return { error: 'This gift isn’t waiting to be sent.' }
  const pick = await supplierFor(order.product_key)
  if (!pick) return { manual: true }
  const { vendor, spec } = pick

  // Claim it, so two runs can't both send it.
  const { data: claimed } = await db.from('store_orders')
    .update({ vendor: vendor.name, vendor_error: null, updated_at: now() })
    .eq('id', orderId).eq('status', 'paid').is('vendor', null).is('vendor_order_id', null)
    .select('id').maybeSingle()
  if (!claimed) return { error: 'It’s already being sent.' }

  // Release the claim and tell the owner.
  const problem = async (message: string) => {
    await db.from('store_orders').update({ vendor: null, vendor_error: message.slice(0, 500), updated_at: now() })
      .eq('id', orderId).eq('vendor', vendor.name).is('vendor_order_id', null)
    await notifyAdmins('A gift needs you', message)
    return { error: message }
  }

  if (!vendor.configured()) return problem(`${vendor.label} isn’t connected yet — add its API key in Vercel, then press Send.`)
  if (stripeTestMode() && !vendor.testMode()) {
    return problem(`Stripe is on test keys, so this wasn’t sent to ${vendor.label} for real. Use ${vendor.label}’s sandbox to test.`)
  }

  const { data: a } = await db.from('store_addresses')
    .select('full_name, line1, line2, city, region, postal_code, country, phone').eq('user_id', order.recipient_id).maybeSingle()
  if (!a) return problem('The recipient removed their delivery address.')
  const [first, ...rest] = a.full_name.trim().split(/\s+/)
  const to: ShipTo = {
    firstName: first, lastName: rest.join(' ') || first,
    line1: a.line1, line2: a.line2, city: a.city,
    region: a.country === 'US' ? usStateCode(a.region) : a.region,
    postalCode: a.postal_code, country: a.country, phone: a.phone,
  }
  if (a.country === 'US' && !to.region) return problem(`“${a.region ?? ''}” isn’t a US state — ask them to fix their address.`)

  const { data: people } = await db.from('profiles').select('id, display_name').in('id', [order.sender_id, order.recipient_id])
  const nameOf = (id: string) => firstName(people?.find(p => p.id === id)?.display_name)

  let ref: string
  try {
    ref = await vendor.submit({
      id: order.id, note: order.note,
      senderFirst: nameOf(order.sender_id) || 'Your partner',
      recipientFirst: nameOf(order.recipient_id) || first,
    }, spec, to)
  } catch (e) {
    return problem(e instanceof VendorError
      ? e.message
      : `${vendor.label} didn’t answer. Check ${vendor.label} for this order before pressing Send again.`)
  }

  await db.from('store_orders').update({
    vendor_order_id: ref.slice(0, 120),
    status: 'fulfilling',
    vendor_error: vendor.testMode() ? `Test order — ${vendor.label} won’t make or ship it.` : null,
    updated_at: now(),
  }).eq('id', orderId).eq('vendor', vendor.name)
  return { ok: true }
}

/** Ask the supplier where a gift is, and move it on (tracking, "shipped"). */
export async function refreshOrder(orderId: string): Promise<{ ok?: true; error?: string }> {
  const db = createAdminClient()
  const { data: order } = await db.from('store_orders')
    .select('id, status, vendor, vendor_order_id, tracking_url, vendor_error, recipient_id')
    .eq('id', orderId).maybeSingle()
  if (!order?.vendor || !order.vendor_order_id || !['fulfilling', 'shipped'].includes(order.status)) return { error: 'Nothing to check.' }
  const vendor = VENDORS[order.vendor as keyof typeof VENDORS]
  if (!vendor?.configured()) return { error: 'That supplier isn’t connected.' }

  let state
  try {
    state = await vendor.status(order.vendor_order_id)
  } catch (e) {
    return { error: e instanceof VendorError ? e.message : `${vendor.label} didn’t answer — try again later.` }
  }

  const patch: Record<string, string | null> = {}
  const moved = RANK[state.status] > RANK[order.status]
  if (moved) patch.status = state.status
  const tracking = state.trackingUrl?.startsWith('https://') ? state.trackingUrl.slice(0, 500) : null
  if (tracking && tracking !== order.tracking_url) patch.tracking_url = tracking
  const note = state.problem ?? (vendor.testMode() ? order.vendor_error : null)
  if (note !== order.vendor_error) patch.vendor_error = note?.slice(0, 500) ?? null
  if (!Object.keys(patch).length) return { ok: true }

  // Only move forward: the recipient may already have said it arrived.
  const { data: updated } = await db.from('store_orders').update({ ...patch, updated_at: now() })
    .eq('id', orderId).eq('status', order.status).select('id').maybeSingle()
  if (updated && moved && state.status === 'shipped') {
    await notifyUser(order.recipient_id, { title: '📦 Your gift has shipped', body: 'It’s on the way to you.', url: '/', tag: `gift-${orderId}` })
  }
  if (updated && state.problem && state.problem !== order.vendor_error) await notifyAdmins('A gift needs you', state.problem)
  return { ok: true }
}

/** The daily sweep: send anything paid that didn't go out, and check on
 *  everything in flight. Spaced out for CJ's one-request-a-second limit, and
 *  stops before `budgetMs` so the function isn't cut off mid-order. */
export async function syncOrders(budgetMs = 50_000) {
  const deadline = Date.now() + budgetMs
  const db = createAdminClient()
  const stale = new Date(Date.now() - 10 * 60_000).toISOString()
  const [{ data: unsent }, { data: open }] = await Promise.all([
    db.from('store_orders').select('id, product_key').eq('status', 'paid').is('vendor', null).is('vendor_error', null)
      .lt('updated_at', stale).limit(25),
    db.from('store_orders').select('id').in('status', ['fulfilling', 'shipped']).not('vendor_order_id', 'is', null)
      .order('updated_at', { ascending: true }).limit(50),
  ])
  const pause = () => new Promise(r => setTimeout(r, 1200))
  let sent = 0, checked = 0
  for (const o of unsent ?? []) {
    if (Date.now() > deadline) break
    if (!(await supplierFor(o.product_key))) continue
    if ((await fulfilOrder(o.id)).ok) sent++
    await pause()
  }
  for (const o of open ?? []) {
    if (Date.now() > deadline) break
    if ((await refreshOrder(o.id)).ok) checked++
    await pause()
  }
  return { sent, checked }
}
