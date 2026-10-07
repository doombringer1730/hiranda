import 'server-only'
import { stripeTestMode } from '@/lib/billing'
import { printFileUrl } from '../print'
import { fetchJson, storeContactEmail } from './contact'
import { VendorError, type Vendor, type VendorState } from './types'

// Gelato — print on demand (cards, prints, photo books), printed near the
// recipient. Docs: https://dashboard.gelato.com/docs/
// Env: GELATO_API_KEY (Developer → API Keys). GELATO_TEST=1 places draft
// orders, which Gelato doesn't print — also automatic while Stripe is on test keys.

const ORDERS = 'https://order.gelatoapis.com/v4/orders'
const key = () => process.env.GELATO_API_KEY ?? ''
const headers = () => ({ 'X-API-KEY': key(), 'Content-Type': 'application/json' })

function fail(what: string, r: { status: number; body: Record<string, unknown> | null; text: string }): never {
  const msg = (r.body?.message as string) || r.text.slice(0, 200) || `HTTP ${r.status}`
  throw new VendorError(`Gelato ${what}: ${msg}`)
}

export const gelato: Vendor = {
  name: 'gelato',
  label: 'Gelato',
  configured: () => !!key(),
  testMode: () => process.env.GELATO_TEST === '1' || stripeTestMode(),
  ready: spec => spec.name === 'gelato' && !!spec.productUid,

  async submit(order, spec, to) {
    if (spec.name !== 'gelato') throw new VendorError('Not a Gelato product')
    const email = storeContactEmail()
    if (!email) throw new VendorError('Set STORE_CONTACT_EMAIL — Gelato needs an email on every order')
    const r = await fetchJson(ORDERS, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        orderType: this.testMode() ? 'draft' : 'order',
        orderReferenceId: order.id,
        customerReferenceId: 'hiranda',
        currency: 'USD',
        items: [{
          itemReferenceId: order.id,
          productUid: spec.productUid,
          quantity: 1,
          files: [
            { type: 'default', url: printFileUrl(order.id, 'front') },
            { type: 'back', url: printFileUrl(order.id, 'back') },
          ],
        }],
        shippingAddress: {
          firstName: to.firstName.slice(0, 25),
          lastName: to.lastName.slice(0, 25),
          addressLine1: to.line1.slice(0, 35),
          ...(to.line2 ? { addressLine2: to.line2.slice(0, 35) } : {}),
          city: to.city.slice(0, 30),
          ...(to.region ? { state: to.region } : {}),
          postCode: to.postalCode.slice(0, 15),
          country: to.country,
          email,
          ...(to.phone ? { phone: to.phone.slice(0, 25) } : {}),
        },
      }),
    })
    if (!r.ok || typeof r.body?.id !== 'string') fail('order', r)
    return r.body.id as string
  },

  async status(id) {
    const r = await fetchJson(`${ORDERS}/${encodeURIComponent(id)}`, { headers: headers() })
    if (!r.ok || !r.body) fail('status', r)
    const s = String(r.body.fulfillmentStatus ?? '')
    const shipment = r.body.shipment as { packages?: { trackingUrl?: string }[] } | undefined
    const trackingUrl = shipment?.packages?.find(p => p.trackingUrl)?.trackingUrl ?? null
    const state: VendorState = { status: 'fulfilling', trackingUrl }
    if (s === 'shipped') state.status = 'shipped'
    else if (s === 'delivered') state.status = 'delivered'
    else if (s === 'canceled' || s === 'failed') state.problem = `Gelato says the order ${s} — check the Gelato dashboard, and refund in Stripe if needed.`
    else if (s === 'on_hold' || s === 'pending_approval') state.problem = `Gelato has the order ${s.replace('_', ' ')} — check the Gelato dashboard.`
    else if (s === 'draft') state.problem = 'Draft (test) order — Gelato won’t print it.'
    return state
  },

  async ping() {
    const r = await fetchJson('https://product.gelatoapis.com/v3/catalogs', { headers: headers() })
    if (!r.ok) fail('key check', r)
    const n = Array.isArray(r.body?.data) ? (r.body.data as unknown[]).length : 0
    return `Connected — ${n} product catalogs${this.testMode() ? ' · test (draft) orders' : ''}`
  },
}
