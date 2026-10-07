import 'server-only'
import { fetchJson, storeContactEmail } from './contact'
import { VendorError, type Vendor, type VendorState } from './types'

// Goody — brand gifts (chocolates, treats…) shipped straight to an address
// ("direct send"). Docs: https://developer.ongoody.com/
// Env: GOODY_API_KEY (Account → API Keys). Orders are charged to the card on
// your Goody account. Direct send needs Goody to approve you as a partner.
// GOODY_SANDBOX=1 uses Goody's sandbox (with a sandbox key) — nothing ships.
// Webhooks (order.shipped, order.delivered…) → /api/store/webhooks/goody,
// signing secret in GOODY_WEBHOOK_SECRET.

const base = () => process.env.GOODY_SANDBOX === '1' ? 'https://api.sandbox.ongoody.com' : 'https://api.ongoody.com'
const key = () => process.env.GOODY_API_KEY ?? ''
const headers = () => ({ Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' })

function fail(what: string, r: { status: number; body: Record<string, unknown> | null; text: string }): never {
  const msg = (r.body?.error as string) || (r.body?.message as string) || r.text.slice(0, 200) || `HTTP ${r.status}`
  throw new VendorError(`Goody ${what}: ${msg}`)
}

export const goody: Vendor = {
  name: 'goody',
  label: 'Goody',
  configured: () => !!key(),
  testMode: () => process.env.GOODY_SANDBOX === '1',
  ready: spec => spec.name === 'goody' && !!spec.productId,

  async submit(order, spec, to) {
    if (spec.name !== 'goody') throw new VendorError('Not a Goody product')
    const email = storeContactEmail()
    if (!email) throw new VendorError('Set STORE_CONTACT_EMAIL — Goody needs an email for the recipient')
    const r = await fetchJson(`${base()}/v1/order_batches`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        from_name: order.senderFirst,
        send_method: 'direct_send',
        notifications_enabled: false,
        customer_reference_id: order.id,
        recipients: [{
          first_name: to.firstName,
          last_name: to.lastName,
          email,
          mailing_address: {
            first_name: to.firstName, last_name: to.lastName,
            address_1: to.line1, ...(to.line2 ? { address_2: to.line2 } : {}),
            city: to.city, state: to.region ?? '', postal_code: to.postalCode, country: to.country,
          },
        }],
        cart: { items: [{ product_id: spec.productId, quantity: 1, ...(spec.variants?.length ? { variants: spec.variants } : {}) }] },
      }),
    })
    if (!r.ok || !r.body) fail('order', r)
    const preview = r.body.orders_preview as { id?: string }[] | undefined
    if (preview?.[0]?.id) return preview[0].id
    // Bigger batches are created in the background — read the order back.
    const batchId = r.body.id as string | undefined
    if (!batchId) fail('order', r)
    const o = await fetchJson(`${base()}/v1/order_batches/${encodeURIComponent(batchId)}/orders`, { headers: headers() })
    const first = (o.body?.data as { id?: string }[] | undefined)?.[0]?.id
    if (!first) throw new VendorError(`Goody accepted the gift (batch ${batchId}) but no order yet — check Goody`)
    return first
  },

  async status(id) {
    const r = await fetchJson(`${base()}/v1/orders/${encodeURIComponent(id)}`, { headers: headers() })
    if (!r.ok || !r.body) fail('status', r)
    const s = String(r.body.status ?? '')
    const shipments = (r.body.shipments as { tracking_url?: string | null }[] | undefined) ?? []
    const state: VendorState = { status: 'fulfilling', trackingUrl: shipments.find(x => x.tracking_url)?.tracking_url ?? null }
    if (s === 'shipped') state.status = 'shipped'
    else if (s === 'delivered') state.status = 'delivered'
    else if (s === 'failed' || s === 'canceled') state.problem = `Goody says the order ${s} — check Goody, and refund in Stripe if needed.`
    return state
  },

  async ping() {
    const r = await fetchJson(`${base()}/v1/me`, { headers: headers() })
    if (!r.ok) fail('key check', r)
    return `Connected${this.testMode() ? ' · sandbox' : ''}`
  },
}

// ── For the owner's supplier page ──

export type GoodyProduct = {
  id: string; name: string; brand: string; price: number | null; image: string | null
  variants: string[]; restrictedStates: string[]
}

/** Goody's US catalog, filtered by name/brand (Goody has no text search). */
export async function goodyProducts(q: string): Promise<GoodyProduct[]> {
  const needle = q.trim().toLowerCase()
  const out: GoodyProduct[] = []
  for (let page = 1; page <= 5 && out.length < 30; page++) {
    const r = await fetchJson(`${base()}/v1/products?country_code=US&per_page=100&page=${page}`, { headers: headers() })
    if (!r.ok) fail('products', r)
    const data = (r.body?.data as Record<string, unknown>[] | undefined) ?? []
    for (const p of data) {
      const brand = String((p.brand as { name?: string } | undefined)?.name ?? '')
      const name = String(p.name ?? '')
      if (needle && !`${name} ${brand}`.toLowerCase().includes(needle)) continue
      const images = p.images as { image_large?: { url?: string } }[] | undefined
      out.push({
        id: String(p.id), name, brand,
        price: typeof p.price === 'number' ? p.price : null,
        image: images?.[0]?.image_large?.url ?? null,
        variants: ((p.variants as { name?: string }[] | undefined) ?? []).map(v => String(v.name ?? '')).filter(Boolean),
        restrictedStates: (p.restricted_states as string[] | undefined) ?? [],
      })
    }
    if (data.length < 100) break
  }
  return out.slice(0, 30)
}
