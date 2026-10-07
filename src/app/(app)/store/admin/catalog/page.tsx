import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Search, Sparkles } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES } from '@/lib/store/catalog'
import { GIFT_SEARCHES as PRESETS } from '@/lib/store/gift-searches'
import { deliveryText, suggestPrice, tidyTitle } from '@/lib/store/pricing'
import { isStoreAdmin } from '@/lib/store/server'
import { VENDORS } from '@/lib/store/vendors'
import { cjPopular, cjQuote, cjVariants } from '@/lib/store/vendors/cj'
import { AddForm, ProductRow } from './catalog-client'

export const metadata = { title: 'Catalog' }

// The owner's catalog: what's in the Store, and popular couple gifts from CJ
// to add — ranked by how many shops sell them, with real cost, shipping and
// delivery time, and a suggested price.


type Params = { q?: string; view?: string; pid?: string; vid?: string; from?: string }

const money = (c: number) => `$${(c / 100).toFixed(2)}`

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await coupleContext()
  if (!ctx || !isStoreAdmin(ctx.user.email)) notFound()
  const { q = '', view = 'popular', pid, vid, from = 'CN' } = await searchParams
  const cjReady = VENDORS.cj.configured()

  const { data: mine } = await createAdminClient().from('store_products')
    .select('key, title, image_url, emoji, category, price_cents, cost_cents, active, delivery, source_ref').order('created_at', { ascending: false })
  const inStore = new Set((mine ?? []).map(p => p.source_ref?.replace(/^cj:/, '')).filter(Boolean))

  const link = (p: Partial<Params>) => `/store/admin/catalog?${new URLSearchParams(Object.entries({ q, view, ...p }).filter(([, v]) => v) as [string, string][])}`
  const preset = PRESETS.find(p => p.q === q)

  return (
    <div className="px-4 pt-6 pb-12 max-w-3xl mx-auto">
      <Link href="/store/admin" className="inline-flex items-center gap-1.5 text-stone-400 text-sm mb-3 hover:text-stone-200"><ArrowLeft size={15} /> Orders</Link>
      <PageHeader eyebrow="Hiranda Store" title="Catalog" />
      <p className="text-stone-500 text-sm mt-2">Add gifts in a tap. Suppliers ship them straight to the recipient — you never touch them.</p>

      <section className="mt-6">
        <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">In your store</h2>
        {!mine?.length && <p className="text-stone-500 text-sm">Nothing added yet — pick something popular below.</p>}
        <div className="flex flex-col gap-2">
          {mine?.map(p => (
            <ProductRow key={p.key} product={{
              key: p.key, title: p.title, image: p.image_url, emoji: p.emoji, active: p.active, delivery: p.delivery,
              section: CATEGORIES.find(c => c.key === p.category)?.title ?? p.category,
              price: (p.price_cents / 100).toFixed(2), cost: p.cost_cents != null ? money(p.cost_cents) : null,
            }} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Find popular gifts</h2>
        {!cjReady ? <p className="text-stone-500 text-sm">Connect CJ Dropshipping first (Suppliers).</p> : (<>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Link key={p.q} href={link({ q: p.q, pid: '', vid: '' })}
                className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-full text-xs ${q === p.q ? 'bg-amber-700 text-amber-50' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                <span aria-hidden="true">{p.emoji}</span>{p.label}
              </Link>
            ))}
          </div>
          <form action="/store/admin/catalog" className="mt-3 flex gap-2">
            <input type="hidden" name="view" value={view} />
            <input name="q" defaultValue={preset ? '' : q} placeholder="Or search anything (heart pillow, keychain…)"
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-amber-50 placeholder:text-stone-600" />
            <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-stone-800 text-stone-200 text-sm"><Search size={14} /> Find</button>
          </form>
          {q && !pid && (
            <div className="mt-3 flex gap-2 text-xs">
              {[['popular', 'Popular'], ['new', 'New this month'], ['us', 'US warehouse']].map(([v, l]) => (
                <Link key={v} href={link({ view: v })} className={`h-8 px-3 inline-flex items-center whitespace-nowrap rounded-full ${view === v ? 'bg-stone-200 text-stone-900' : 'bg-stone-900 text-stone-400'}`}>
                  {v === 'new' && <Sparkles size={12} className="mr-1" />}{l}
                </Link>
              ))}
            </div>
          )}
          {q && !pid && <Results q={q} view={view} link={link} inStore={inStore} />}
          {pid && <Product pid={pid} vid={vid} from={from === 'US' ? 'US' : 'CN'} link={link} category={preset?.category ?? 'gift'} emoji={preset?.emoji ?? '🎁'} />}
        </>)}
      </section>
    </div>
  )
}

async function Results({ q, view, link, inStore }: { q: string; view: string; link: (p: Partial<Params>) => string; inStore: Set<string | undefined> }) {
  let items: Awaited<ReturnType<typeof cjPopular>> = []
  let error: string | null = null
  try {
    items = await cjPopular(q, { newOnly: view === 'new', usOnly: view === 'us' })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Search failed.'
  }
  if (error) return <p className="mt-4 text-sm text-red-300">{error}</p>
  if (!items.length) return <p className="mt-4 text-sm text-stone-500">Nothing found{view === 'new' ? ' this month' : ''} — try another word.</p>
  return (
    <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(x => (
        <li key={x.pid}>
          <Link href={link({ pid: x.pid, vid: '', from: view === 'us' ? 'US' : 'CN' })} className="block rounded-2xl bg-stone-900/60 border border-stone-800 p-2 hover:border-amber-800/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {x.image && <img src={x.image} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover bg-stone-800" />}
            <p className="text-stone-200 text-xs mt-1.5 line-clamp-2">{x.name}</p>
            <p className="text-stone-500 text-[11px] mt-0.5">from ${x.price?.split(' ')[0] ?? '?'} · sold by {x.listed.toLocaleString()} shops</p>
            {inStore.has(x.pid) && <p className="text-emerald-300 text-[11px]">✓ In your store</p>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

async function Product({ pid, vid, from, link, category, emoji }: {
  pid: string; vid?: string; from: 'US' | 'CN'; link: (p: Partial<Params>) => string; category: string; emoji: string
}) {
  let variants: Awaited<ReturnType<typeof cjVariants>> = []
  let error: string | null = null
  try {
    variants = await cjVariants(pid, from === 'US' ? 'US' : undefined)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Couldn’t load it.'
  }
  const chosen = variants.find(v => v.vid === vid)
  let quote: Awaited<ReturnType<typeof cjQuote>> = null
  if (chosen && !error) {
    try { quote = await cjQuote(chosen.vid, from) } catch (e) { error = e instanceof Error ? e.message : 'No shipping quote.' }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Link href={link({ pid: '', vid: '' })} className="text-stone-400 text-sm hover:text-stone-200">← Back to results</Link>
      <div className="flex gap-2 text-xs">
        {(['CN', 'US'] as const).map(f => (
          <Link key={f} href={link({ pid, vid: '', from: f })} className={`h-8 px-3 inline-flex items-center whitespace-nowrap rounded-full ${from === f ? 'bg-stone-200 text-stone-900' : 'bg-stone-900 text-stone-400'}`}>
            {f === 'CN' ? 'Ships from China (1–2 wks)' : 'US warehouse (days)'}
          </Link>
        ))}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!error && !variants.length && <p className="text-sm text-stone-500">None in stock {from === 'US' ? 'in the US — try China' : 'right now'}.</p>}
      {!chosen && variants.length > 0 && (
        <>
          <p className="text-stone-400 text-sm">Pick the version to sell:</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {variants.slice(0, 30).map(v => (
              <li key={v.vid}>
                <Link href={link({ pid, vid: v.vid, from })} className="block rounded-2xl bg-stone-900/60 border border-stone-800 p-2 hover:border-amber-800/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.image && <img src={v.image} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover bg-stone-800" />}
                  <p className="text-stone-200 text-xs mt-1.5 line-clamp-2">{v.name}</p>
                  <p className="text-stone-500 text-[11px]">${v.price?.toFixed(2) ?? '?'}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {chosen && quote && (() => {
        const cost = Math.round(((chosen.price ?? 0) + quote.price) * 100)
        return (
          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex flex-col gap-3">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {chosen.image && <img src={chosen.image} alt="" className="size-20 rounded-xl object-cover bg-stone-800" />}
              <div className="text-sm">
                <p className="text-stone-200">{chosen.name}</p>
                <p className="text-stone-400 text-xs mt-1">
                  Item {money(Math.round((chosen.price ?? 0) * 100))} + shipping {money(Math.round(quote.price * 100))} ({quote.name}, {quote.days} days) = <b className="text-amber-200">{money(cost)} cost</b>
                </p>
              </div>
            </div>
            <AddForm defaults={{
              title: tidyTitle(chosen.name), category, emoji, image: chosen.image ?? '',
              price: (suggestPrice(cost) / 100).toFixed(2), cost: (cost / 100).toFixed(2),
              delivery: deliveryText(quote.days), vid: chosen.vid, pid, from,
            }} categories={CATEGORIES.map(c => ({ key: c.key, title: c.title }))} />
          </div>
        )
      })()}
      {chosen && !quote && !error && <p className="text-sm text-stone-500">CJ can’t ship this {from === 'US' ? 'from the US' : 'from China'} right now.</p>}
    </div>
  )
}
