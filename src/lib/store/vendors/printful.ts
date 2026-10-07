import 'server-only'
import { stripeTestMode } from '@/lib/billing'
import { printFileUrl } from '../print'
import { fetchJson, siteUrl, storeContactEmail } from './contact'
import { VendorError, type Vendor, type VendorState } from './types'

// Printful — print on demand (blankets, mugs, posters…) with the couple's
// names design. Docs: https://developers.printful.com/docs/
// Env: PRINTFUL_API_TOKEN (developers.printful.com → Your tokens; scopes
// "orders" and "webhooks"), from a "Manual order platform / API" store.
// Account-level tokens also need PRINTFUL_STORE_ID. Orders are charged to
// your Printful billing method when confirmed. PRINTFUL_TEST=1 leaves orders
// as unconfirmed drafts (free) — also automatic while Stripe is on test keys.

const BASE = 'https://api.printful.com'
const token = () => process.env.PRINTFUL_API_TOKEN ?? ''
const headers = () => ({
  Authorization: `Bearer ${token()}`,
  'Content-Type': 'application/json',
  ...(process.env.PRINTFUL_STORE_ID ? { 'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID } : {}),
})

function fail(what: string, r: { status: number; body: Record<string, unknown> | null; text: string }): never {
  const err = r.body?.error as { message?: string } | undefined
  const msg = err?.message || (typeof r.body?.result === 'string' ? r.body.result : '') || r.text.slice(0, 200) || `HTTP ${r.status}`
  throw new VendorError(`Printful ${what}: ${msg}`)
}

export const printful: Vendor = {
  name: 'printful',
  label: 'Printful',
  configured: () => !!token(),
  testMode: () => process.env.PRINTFUL_TEST === '1' || stripeTestMode(),
  ready: spec => spec.name === 'printful' && spec.variantId > 0 && !!spec.placement && spec.art.w > 0 && spec.art.h > 0,

  async submit(order, spec, to) {
    if (spec.name !== 'printful') throw new VendorError('Not a Printful product')
    const r = await fetchJson(`${BASE}/orders?confirm=${this.testMode() ? 'false' : 'true'}`, {
      method: 'POST',
      headers: headers(),
      timeoutMs: 30000,
      body: JSON.stringify({
        external_id: order.id.replace(/-/g, ''), // 32 chars, Printful's limit
        recipient: {
          name: `${to.firstName} ${to.lastName}`.trim(),
          address1: to.line1, ...(to.line2 ? { address2: to.line2 } : {}),
          city: to.city, ...(to.region ? { state_code: to.region } : {}),
          country_code: to.country, zip: to.postalCode,
          ...(to.phone ? { phone: to.phone } : {}),
          ...(storeContactEmail() ? { email: storeContactEmail() } : {}),
        },
        items: [{
          variant_id: spec.variantId,
          quantity: 1,
          files: [{ type: spec.placement, url: printFileUrl(order.id, 'design', spec.art) }],
        }],
      }),
    })
    const result = r.body?.result as { id?: number } | undefined
    if (!r.ok || !result?.id) fail('order', r)
    return String(result.id)
  },

  async status(id) {
    const r = await fetchJson(`${BASE}/orders/${encodeURIComponent(id)}`, { headers: headers() })
    const o = r.body?.result as { status?: string; shipments?: { tracking_url?: string }[] } | undefined
    if (!r.ok || !o) fail('status', r)
    const s = o.status ?? ''
    const state: VendorState = { status: 'fulfilling', trackingUrl: o.shipments?.find(x => x.tracking_url)?.tracking_url ?? null }
    if (s === 'fulfilled') state.status = 'shipped'
    else if (s === 'failed' || s === 'canceled') state.problem = `Printful says the order ${s} — check Printful (often a billing problem), and refund in Stripe if needed.`
    else if (s === 'onhold' || s === 'inreview') state.problem = `Printful has the order ${s === 'onhold' ? 'on hold' : 'in review'} — check Printful.`
    else if (s === 'draft') state.problem = 'Draft (test) order — Printful won’t make it unless you confirm it there.'
    return state
  },

  async ping() {
    const r = await fetchJson(`${BASE}/orders?limit=1`, { headers: headers() })
    if (!r.ok) fail('key check', r)
    return `Connected${this.testMode() ? ' · draft (test) orders' : ''}`
  },

  // One webhook per store; replaces whatever was there.
  async connectWebhook() {
    const key = process.env.STORE_WEBHOOK_KEY
    if (!key) throw new VendorError('Set STORE_WEBHOOK_KEY in Vercel first')
    const r = await fetchJson(`${BASE}/webhooks`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        url: `${siteUrl()}/api/store/webhooks/printful?key=${encodeURIComponent(key)}`,
        types: ['package_shipped', 'order_updated', 'order_failed', 'order_canceled', 'order_put_hold'],
      }),
    })
    if (!r.ok) fail('webhook', r)
    return 'Printful will tell Hiranda when gifts ship.'
  },
}
