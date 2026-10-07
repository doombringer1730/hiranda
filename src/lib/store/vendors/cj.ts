import 'server-only'
import { stripeTestMode } from '@/lib/billing'
import { fetchJson } from './contact'
import { VendorError, type Vendor, type VendorState } from './types'

// CJ Dropshipping — gift items shipped from CJ's US warehouse (a few days)
// or internationally from its main warehouses (about 1–2 weeks; far more
// to choose from).
// Docs: https://developers.cjdropshipping.com/en/api/introduction.html
// Env: CJ_API_KEY (My CJ → Authorization → API → API Key). Orders are paid
// from your CJ wallet, so keep it topped up. CJ_TEST=1 places sandbox orders
// (no charge) — also automatic while Stripe is on test keys.
// CJ has no tracking webhook we can use (it insists on product/stock feeds
// too), so orders are checked by the daily sync and the admin "Check" button.

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1'
const key = () => process.env.CJ_API_KEY ?? ''

let token: { value: string; expires: number } | null = null

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value
  const r = await fetchJson(`${BASE}/authentication/getAccessToken`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key() }),
  })
  const data = r.body?.data as { accessToken?: string; accessTokenExpiryDate?: string } | undefined
  if (!r.ok || r.body?.code !== 200 || !data?.accessToken) throw new VendorError(`CJ sign-in: ${(r.body?.message as string) || `HTTP ${r.status}`}`)
  const exp = Date.parse(data.accessTokenExpiryDate ?? '')
  token = { value: data.accessToken, expires: Number.isFinite(exp) ? exp : Date.now() + 86_400_000 }
  return token.value
}

async function cj<T>(what: string, path: string, body?: unknown): Promise<T> {
  const r = await fetchJson(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'CJ-Access-Token': await accessToken(), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (r.status === 401) token = null
  if (!r.ok || r.body?.code !== 200) throw new VendorError(`CJ ${what}: ${(r.body?.message as string) || `HTTP ${r.status}`}`)
  return r.body.data as T
}

type ShippingOption = { logisticName: string; logisticPrice: number; logisticAging?: string }

/** Slowest delivery an option promises, in days ("5-11" → 11). */
const maxDays = (o: ShippingOption) => Math.max(...String(o.logisticAging ?? '').split(/[^0-9]+/).map(Number).filter(Boolean), 0) || 99

/** The cheapest way that still arrives within about two weeks — gifts
 *  shouldn't take a month — or else the fastest. */
export function pickShipping(options: ShippingOption[]) {
  const quick = options.filter(o => maxDays(o) <= 15).sort((a, b) => a.logisticPrice - b.logisticPrice)
  return quick[0] ?? [...options].sort((a, b) => maxDays(a) - maxDays(b))[0] ?? null
}

export const cjDropshipping: Vendor = {
  name: 'cj',
  label: 'CJ Dropshipping',
  configured: () => !!key(),
  testMode: () => process.env.CJ_TEST === '1' || stripeTestMode(),
  ready: spec => spec.name === 'cj' && spec.items.length > 0 && spec.items.every(i => i.vid && i.quantity > 0),

  async submit(order, spec, to) {
    if (spec.name !== 'cj') throw new VendorError('Not a CJ product')
    const products = spec.items.map(i => ({ vid: i.vid, quantity: i.quantity }))
    const from = spec.from ?? 'US'
    const options = await cj<ShippingOption[]>('shipping quote', '/logistic/freightCalculate', {
      startCountryCode: from, endCountryCode: to.country, zip: to.postalCode, products,
    })
    const cheapest = pickShipping(options ?? [])
    if (!cheapest) throw new VendorError(`CJ can’t ship these items ${from === 'US' ? 'from its US warehouse' : 'internationally'} right now`)

    const data = await cj<{ orderId?: string }>('order', '/shopping/order/createOrderV2', {
      orderNumber: order.id,
      shippingCountryCode: to.country,
      shippingCountry: to.country === 'US' ? 'United States' : to.country,
      shippingProvince: to.region ?? '',
      shippingCity: to.city,
      shippingZip: to.postalCode,
      shippingAddress: to.line1,
      ...(to.line2 ? { shippingAddress2: to.line2 } : {}),
      shippingCustomerName: `${to.firstName} ${to.lastName}`.trim(),
      ...(to.phone ? { shippingPhone: to.phone } : {}),
      fromCountryCode: from,
      logisticName: cheapest.logisticName,
      payType: 2, // pay from the CJ wallet straight away
      isSandbox: this.testMode() ? 1 : 0,
      remark: 'Gift — please leave out invoices and prices.',
      products,
    })
    if (!data?.orderId) throw new VendorError('CJ didn’t return an order id')
    return data.orderId
  },

  async status(id) {
    const d = await cj<{ orderStatus?: string; trackNumber?: string; trackingUrl?: string }>('status', `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(id)}`)
    const s = String(d?.orderStatus ?? '').toUpperCase()
    const trackingUrl = d?.trackingUrl || (d?.trackNumber ? `https://t.17track.net/en#nums=${encodeURIComponent(d.trackNumber)}` : null)
    const state: VendorState = { status: 'fulfilling', trackingUrl }
    if (s === 'SHIPPED') state.status = 'shipped'
    else if (s === 'DELIVERED') state.status = 'delivered'
    else if (s === 'CANCELLED') state.problem = 'CJ cancelled the order — check CJ, and refund in Stripe if needed.'
    else if (s === 'UNPAID' || s === 'IN_CART' || s === 'CREATED') state.problem = 'Waiting for payment — top up your CJ wallet (or pay the order in CJ).'
    return state
  },

  async ping() {
    const d = await cj<{ amount?: number }>('key check', '/shopping/pay/getBalance')
    return `Connected — wallet $${Number(d?.amount ?? 0).toFixed(2)}${this.testMode() ? ' · sandbox orders' : ''}`
  },
}

// ── For the owner's supplier and catalog pages ──

export type CjProduct = { pid: string; name: string; image: string | null; price: string | null; listed: number; usStock: number | null }
export type CjVariant = { vid: string; name: string; key: string; sku: string | null; price: number | null; image: string | null }

/** CJ's catalog ranked by how many shops sell each product — the popular
 *  ones first. `newOnly`: listed in the last 45 days. `usOnly`: in stock in
 *  the US warehouse. */
export async function cjPopular(q: string, { newOnly = false, usOnly = false, page = 1 } = {}): Promise<CjProduct[]> {
  const params = new URLSearchParams({ keyWord: q, page: String(page), size: '24', orderBy: '1', sort: 'desc' })
  if (usOnly) params.set('countryCode', 'US')
  if (newOnly) params.set('timeStart', String(Date.now() - 45 * 86_400_000))
  const d = await cj<{ content?: { productList?: Record<string, unknown>[] }[] }>('search', `/product/listV2?${params}`)
  return (d?.content ?? []).flatMap(c => c.productList ?? []).map(p => ({
    pid: String(p.id ?? ''), name: String(p.nameEn ?? ''),
    image: typeof p.bigImage === 'string' && p.bigImage.startsWith('https://') ? p.bigImage : null,
    price: p.sellPrice != null ? String(p.sellPrice) : null,
    listed: Number(p.listedNum ?? 0),
    usStock: usOnly ? Number(p.warehouseInventoryNum ?? 0) : null,
  })).filter(p => p.pid)
}

/** A product's variants (the vids for an order). `country`: only those in
 *  stock there. */
export async function cjVariants(pid: string, country?: 'US'): Promise<CjVariant[]> {
  const d = await cj<Record<string, unknown>[]>('variants', `/product/variant/query?pid=${encodeURIComponent(pid)}${country ? `&countryCode=${country}` : ''}`)
  return (Array.isArray(d) ? d : []).map(v => ({
    vid: String(v.vid ?? ''), name: String(v.variantNameEn ?? v.variantKey ?? ''), key: String(v.variantKey ?? ''),
    sku: typeof v.variantSku === 'string' ? v.variantSku : null,
    price: v.variantSellPrice != null ? Number(v.variantSellPrice) : null,
    image: typeof v.variantImage === 'string' && v.variantImage.startsWith('https://') ? v.variantImage : null,
  })).filter(v => v.vid)
}

/** What shipping one of this variant would cost and take. */
export async function cjQuote(vid: string, from: 'US' | 'CN', to = 'US', zip = '10001') {
  const options = await cj<ShippingOption[]>('shipping quote', '/logistic/freightCalculate', {
    startCountryCode: from, endCountryCode: to, zip, products: [{ vid, quantity: 1 }],
  })
  const pick = pickShipping(options ?? [])
  return pick ? { name: pick.logisticName, price: Number(pick.logisticPrice), days: String(pick.logisticAging ?? '') } : null
}
