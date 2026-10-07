import 'server-only'
import { printFileUrl } from '../print'
import { fetchJson, siteUrl, storeContactEmail } from './contact'
import { VendorError, type Vendor, type VendorState } from './types'

// Printify — print on demand from many print providers, with the couple's
// names design. Docs: https://developers.printify.com/
// Env: PRINTIFY_API_TOKEN (My Profile → Connections → token with shops,
// orders and webhooks scopes) and PRINTIFY_SHOP_ID (an "API" store — see
// /store/admin/suppliers). Printify charges your balance/card when an order
// goes to production and has no test mode, so it's never used while Stripe
// is on test keys.

const BASE = 'https://api.printify.com/v1'
const token = () => process.env.PRINTIFY_API_TOKEN ?? ''
const shop = () => process.env.PRINTIFY_SHOP_ID ?? ''
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', 'User-Agent': 'Hiranda' })

function fail(what: string, r: { status: number; body: Record<string, unknown> | null; text: string }): never {
  const msg = (r.body?.message as string) || (r.body?.error as string) || r.text.slice(0, 200) || `HTTP ${r.status}`
  throw new VendorError(`Printify ${what}: ${msg}`)
}

export const printify: Vendor = {
  name: 'printify',
  label: 'Printify',
  configured: () => !!token(),
  testMode: () => false,
  ready: spec => spec.name === 'printify' && spec.blueprintId > 0 && spec.printProviderId > 0 && spec.variantId > 0 && !!spec.position,

  async submit(order, spec, to) {
    if (spec.name !== 'printify') throw new VendorError('Not a Printify product')
    if (!shop()) throw new VendorError('Set PRINTIFY_SHOP_ID in Vercel (shown on the Suppliers page)')
    const r = await fetchJson(`${BASE}/shops/${encodeURIComponent(shop())}/orders.json`, {
      method: 'POST',
      headers: headers(),
      timeoutMs: 45000, // on-the-fly products are slow to create
      body: JSON.stringify({
        external_id: order.id,
        label: 'Hiranda gift',
        shipping_method: 1,
        send_shipping_notification: false,
        line_items: [{
          blueprint_id: spec.blueprintId,
          print_provider_id: spec.printProviderId,
          variant_id: spec.variantId,
          print_areas: { [spec.position]: printFileUrl(order.id, 'design', spec.art) },
          quantity: 1,
        }],
        address_to: {
          first_name: to.firstName, last_name: to.lastName,
          ...(storeContactEmail() ? { email: storeContactEmail() } : {}),
          ...(to.phone ? { phone: to.phone } : {}),
          country: to.country, region: to.region ?? '',
          address1: to.line1, address2: to.line2 ?? '',
          city: to.city, zip: to.postalCode,
        },
      }),
    })
    if (!r.ok || typeof r.body?.id !== 'string') fail('order', r)
    return r.body.id as string
  },

  async status(id) {
    const r = await fetchJson(`${BASE}/shops/${encodeURIComponent(shop())}/orders/${encodeURIComponent(id)}.json`, { headers: headers() })
    if (!r.ok || !r.body) fail('status', r)
    const s = String(r.body.status ?? '')
    const shipments = (r.body.shipments as { url?: string; delivered_at?: string | null }[] | undefined) ?? []
    const state: VendorState = { status: 'fulfilling', trackingUrl: shipments.find(x => x.url)?.url ?? null }
    if (shipments.length && shipments.every(x => x.delivered_at)) state.status = 'delivered'
    else if (s === 'fulfilled' || shipments.length) state.status = 'shipped'
    if (s === 'canceled') state.problem = 'Printify cancelled the order — check Printify, and refund in Stripe if needed.'
    else if (s === 'on-hold') state.problem = 'Printify has the order on hold — approve it in Printify.'
    else if (['has-issues', 'unfulfillable', 'payment-not-received', 'source-check-failed'].includes(s)) {
      state.problem = `Printify: ${s.replace(/-/g, ' ')} — check Printify.`
    }
    return state
  },

  async ping() {
    const r = await fetchJson(`${BASE}/shops.json`, { headers: headers() })
    if (!r.ok || !Array.isArray(r.body)) fail('key check', r)
    const shops = r.body as unknown as { id: number; title: string; sales_channel: string }[]
    const mine = shops.find(x => String(x.id) === shop())
    if (mine) return `Connected — shop “${mine.title}”`
    const list = shops.map(x => `${x.title} (${x.sales_channel}): ${x.id}`).join(' · ')
    return `Connected — set PRINTIFY_SHOP_ID to one of: ${list || 'no shops yet — add an “API” store in Printify'}`
  },

  async connectWebhook() {
    const secret = process.env.STORE_WEBHOOK_KEY
    if (!secret) throw new VendorError('Set STORE_WEBHOOK_KEY in Vercel first')
    if (!shop()) throw new VendorError('Set PRINTIFY_SHOP_ID first')
    const url = `${siteUrl()}/api/store/webhooks/printify`
    for (const topic of ['order:updated', 'order:shipment:created', 'order:shipment:delivered']) {
      const r = await fetchJson(`${BASE}/shops/${encodeURIComponent(shop())}/webhooks.json`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ topic, url, secret }),
      })
      if (!r.ok && r.status !== 409) fail(`webhook ${topic}`, r)
    }
    return 'Printify will tell Hiranda when gifts ship.'
  },
}
