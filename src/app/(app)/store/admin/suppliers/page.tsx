import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, CircleAlert, Search } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { isStoreAdmin } from '@/lib/store/server'
import { supplierFor } from '@/lib/store/fulfil'
import { storeProducts } from '@/lib/store/products'
import { VENDORS } from '@/lib/store/vendors'
import { siteUrl } from '@/lib/store/vendors/contact'
import { goodyProducts } from '@/lib/store/vendors/goody'
import { ConnectWebhook } from './connect-webhook'

export const metadata = { title: 'Suppliers' }

// The owner's supplier dashboard: is each one connected, what to set up,
// and a product finder for the ids that go in lib/store/catalog.ts.

const SETUP: Record<string, { env: string[]; steps: string[] }> = {
  gelato: {
    env: ['GELATO_API_KEY', 'STORE_WEBHOOK_KEY (any long random text)', 'STORE_CONTACT_EMAIL'],
    steps: [
      'Sign up at gelato.com (free) and add a card under Billing.',
      'Developer → API Keys → add a key → copy it into GELATO_API_KEY.',
      'Developer → Webhooks → add the URL below for “Order status updated” and “Order item tracking code updated”.',
    ],
  },
  printful: {
    env: ['PRINTFUL_API_TOKEN', 'PRINTFUL_STORE_ID (only for account-level tokens)', 'STORE_WEBHOOK_KEY'],
    steps: [
      'Sign up at printful.com (free) and add a billing method.',
      'Stores → Add store → “Manual order platform / API”.',
      'developers.printful.com → Your tokens → create a private token with “orders” and “webhooks” → PRINTFUL_API_TOKEN.',
      'Come back here and press “Turn on tracking”.',
    ],
  },
  printify: {
    env: ['PRINTIFY_API_TOKEN', 'PRINTIFY_SHOP_ID', 'STORE_WEBHOOK_KEY'],
    steps: [
      'Sign up at printify.com (free) and add a card.',
      'My stores → Add a new store → “API”.',
      'My Profile → Connections → generate a token (shops, orders, webhooks) → PRINTIFY_API_TOKEN.',
      'This page then lists your shop ids — put the API store’s in PRINTIFY_SHOP_ID, and press “Turn on tracking”.',
    ],
  },
  cj: {
    env: ['CJ_API_KEY'],
    steps: [
      'Sign up at cjdropshipping.com (free).',
      'Apps → install “API”, then API → Add API → API Key → copy it into CJ_API_KEY.',
      'Top up your CJ wallet — orders are paid from it. CJ suspends API access after 30 days with no orders.',
      'Then open Catalog to add popular gifts — shipped from the US or internationally.',
    ],
  },
  goody: {
    env: ['GOODY_API_KEY', 'GOODY_WEBHOOK_SECRET', 'STORE_CONTACT_EMAIL'],
    steps: [
      'Sign up at ongoody.com and add a card (Account → API Keys page).',
      'Email support@ongoody.com to be approved for “direct send” — shipping straight to an address.',
      'Account → API Keys → create a key → GOODY_API_KEY.',
      'Organization → Automation API → Webhooks → add the URL below (all order events) → copy its signing secret into GOODY_WEBHOOK_SECRET.',
    ],
  },
}

const WEBHOOK: Record<string, string | null> = {
  // The real key (this page is admin-only) so it can be pasted into Gelato.
  gelato: `${siteUrl()}/api/store/webhooks/gelato?key=${encodeURIComponent(process.env.STORE_WEBHOOK_KEY ?? '<set STORE_WEBHOOK_KEY>')}`,
  printful: null,
  printify: null,
  cj: null,
  goody: `${siteUrl()}/api/store/webhooks/goody`,
}

async function check(name: keyof typeof VENDORS) {
  const v = VENDORS[name]
  if (!v.configured()) return { ok: false, text: 'Not connected — add the key below in Vercel.' }
  try { return { ok: true, text: await v.ping() } } catch (e) { return { ok: false, text: e instanceof Error ? e.message : 'Couldn’t reach it.' } }
}

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ v?: string; q?: string }> }) {
  const ctx = await coupleContext()
  if (!ctx || !isStoreAdmin(ctx.user.email)) notFound()
  const { v, q = '' } = await searchParams
  const names = Object.keys(VENDORS) as (keyof typeof VENDORS)[]
  const status = Object.fromEntries(await Promise.all(names.map(async n => [n, await check(n)] as const)))
  const products = await storeProducts()
  const makers = new Map(await Promise.all(products.map(async p => [p.key, await supplierFor(p.key)] as const)))

  return (
    <div className="px-4 pt-6 pb-12 max-w-3xl mx-auto">
      <Link href="/store/admin" className="inline-flex items-center gap-1.5 text-stone-400 text-sm mb-3 hover:text-stone-200"><ArrowLeft size={15} /> Orders</Link>
      <PageHeader eyebrow="Hiranda Store" title="Suppliers" />

      <section className="mt-6 rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
        <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Who makes each gift</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {products.map(p => {
            const s = makers.get(p.key)
            return (
              <li key={p.key} className="flex items-center gap-2">
                <span aria-hidden="true">{p.emoji}</span>
                <span className="text-stone-200 flex-1">{p.title}</span>
                <span className={s ? 'text-amber-300' : 'text-stone-500'}>
                  {s ? s.vendor.label : p.vendor ? `${VENDORS[p.vendor.name].label} — product not picked yet` : 'You ship it'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {names.map(n => (
        <section key={n} className="mt-6 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl text-amber-50 flex-1">{VENDORS[n].label}</h2>
            {status[n].ok ? <Check size={16} className="text-emerald-400" /> : <CircleAlert size={16} className="text-stone-500" />}
          </div>
          <p className={`text-sm ${status[n].ok ? 'text-emerald-300' : 'text-stone-400'}`}>{status[n].text}</p>
          <ol className="list-decimal pl-5 text-sm text-stone-300 flex flex-col gap-1">
            {SETUP[n].steps.map(s => <li key={s}>{s}</li>)}
          </ol>
          <p className="text-xs text-stone-500">Vercel settings: {SETUP[n].env.join(' · ')}</p>
          {VENDORS[n].connectWebhook && status[n].ok && <ConnectWebhook vendor={n} label={VENDORS[n].label} />}
          {WEBHOOK[n] && <p className="text-xs text-stone-500 break-all">Webhook URL (keep it private): <span className="font-mono text-stone-300 select-all">{WEBHOOK[n]}</span></p>}
          {n === 'cj' && status[n].ok && (
            <Link href="/store/admin/catalog" className="self-start inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-amber-700 text-amber-50 text-sm">Find popular gifts →</Link>
          )}
          {n === 'goody' && status[n].ok && (
            <form className="flex gap-2" action="/store/admin/suppliers">
              <input type="hidden" name="v" value={n} />
              <input name="q" defaultValue={v === n ? q : ''} placeholder="Filter Goody (chocolate, cookies…)"
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-amber-50 placeholder:text-stone-600" />
              <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-stone-800 text-stone-200 text-sm"><Search size={14} /> Find</button>
            </form>
          )}
          {v === n && status[n].ok && <Results vendor={n} q={q} />}
        </section>
      ))}
    </div>
  )
}

type Found =
  | { kind: 'goody'; items: Awaited<ReturnType<typeof goodyProducts>> }
  | { kind: 'error'; message: string }
  | null

async function find(vendor: string, q: string): Promise<Found> {
  try {
    if (vendor === 'goody') return { kind: 'goody', items: await goodyProducts(q) }
    return null
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'Search failed.' }
  }
}

async function Results({ vendor, q }: { vendor: string; q: string }) {
  const found = await find(vendor, q)
  if (!found) return null
  if (found.kind === 'error') return <p className="text-sm text-red-300">{found.message}</p>
  if (!found.items.length) return <p className="text-sm text-stone-500">No matches.</p>

  return (
    <ul className="flex flex-col gap-2">
      {found.items.map(x => (
        <li key={x.id} className="flex gap-3 items-center rounded-xl bg-stone-950/60 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {x.image && <img src={x.image} alt="" className="size-12 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-stone-200 truncate">{x.brand} — {x.name}</p>
            <p className="text-stone-500 text-xs">
              {x.price != null ? `$${(x.price / 100).toFixed(2)}` : '?'} · id <span className="font-mono text-stone-300 select-all">{x.id}</span>
              {x.variants.length > 0 && <> · options: {x.variants.join(', ')}</>}
              {x.restrictedStates.length > 0 && <> · can’t ship to {x.restrictedStates.join(', ')}</>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
