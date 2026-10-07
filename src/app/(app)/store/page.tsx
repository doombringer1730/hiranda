import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, MapPin, Package, Settings2 } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { CATEGORIES, PARTNER_GIFTS, shipsFrom } from '@/lib/store/catalog'
import { iconButton } from '@/components/ui'
import { storeProducts } from '@/lib/store/products'
import { isStoreAdmin, storeEnabled } from '@/lib/store/server'
import { stripeOpenTo, stripeTestMode } from '@/lib/billing'
import TestCardHint from '@/components/test-card-hint'
import { AskForAddress, GiftCard } from './store-client'

export const metadata = { title: 'Hiranda Store' }

export default async function StorePage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const [people, { data: partnerReady }, { data: mine }, { data: partnerSizes }] = await Promise.all([
    getPeople(),
    ctx.supabase.rpc('partner_has_gift_address'),
    ctx.supabase.from('store_addresses').select('user_id').eq('user_id', ctx.user.id).maybeSingle(),
    ctx.supabase.rpc('partner_size_kinds'),
  ])
  const partner = people.get(ctx.partnerId)?.first ?? 'your partner'
  const products = await storeProducts()
  const open = storeEnabled() && stripeOpenTo(ctx.user.email)

  const sections = CATEGORIES
    .map(c => ({ ...c, items: products.filter(p => (p.category ?? 'gift') === c.key) }))
    .filter(g => g.items.length)

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl md:max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="Send a little something" title="Hiranda Store" />
        {isStoreAdmin(ctx.user.email) && (
          <Link href="/store/admin" aria-label="Orders to ship" title="Orders to ship" className={`${iconButton} mb-1`}><Settings2 size={18} /></Link>
        )}
      </div>

      {/* The gift tag: who it's for, and whether we know where to send it. */}
      <div className="paper relative mt-5 rounded-[6px] px-6 pt-6 pb-5 -rotate-[0.6deg]">
        <span className="tape -top-3 left-8 rotate-[-6deg]" />
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">A gift for</p>
        <p className="font-hand text-[40px] leading-none text-[var(--paper-ink)] mt-1">{partner}</p>
        {partnerReady ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--paper-muted)]">
            <Check size={15} className="text-emerald-700" /> Their address is ready — private, you’ll never see it.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-[var(--paper-muted)]">{partner} hasn’t added a delivery address yet. It stays private — you’ll never see it.</p>
            <AskForAddress partner={partner} />
          </>
        )}
        {!open && <p className="mt-3 text-sm text-[var(--paper-muted)]">The store opens soon — have a look around.</p>}
      </div>

      {open && stripeTestMode() && <div className="mt-5"><TestCardHint /></div>}

      {sections.length > 1 && (
        <nav aria-label="Store sections" className="-mx-4 mt-7 px-4 flex gap-2 overflow-x-auto no-scrollbar">
          {sections.map(g => (
            <a key={g.key} href={`#${g.key}`} className="shrink-0 inline-flex items-center h-11 px-4 rounded-full bg-stone-800/80 text-sm text-stone-200 hover:bg-stone-700 transition-colors">
              {g.title}
            </a>
          ))}
        </nav>
      )}

      {sections.map(g => (
        <section key={g.key} id={g.key} className="mt-9 scroll-mt-24">
          <h2 className="font-serif text-[26px] leading-tight text-amber-50 mb-3">{g.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {g.items.map(p => (
              <GiftCard key={p.key} product={p} origin={shipsFrom(p)} partner={partner} canSend={open && !!partnerReady} partnerSizes={(partnerSizes as string[] | null) ?? []} />
            ))}
          </div>
        </section>
      ))}

      {PARTNER_GIFTS.length > 0 && (
        <section className="mt-9">
          <h2 className="font-serif text-[26px] leading-tight text-amber-50 mb-3">From our partners</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PARTNER_GIFTS.map(g => (
              <a key={g.key} href={g.url} target="_blank" rel="sponsored noopener noreferrer" className="tile active:scale-[0.98] transition-transform flex items-center gap-3 p-4 min-h-16">
                <span className="text-3xl" aria-hidden="true">{g.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-stone-100 text-sm font-medium">{g.title}</span>
                  <span className="block text-stone-400 text-xs">{g.blurb}</span>
                </span>
                <span className="text-amber-400 text-xs">{g.cta} ↗</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 grid grid-cols-2 gap-3">
        <Link href="/store/address" className="tile active:scale-[0.98] transition-transform flex items-center gap-3 p-4 min-h-16">
          <MapPin size={20} className="text-amber-400 shrink-0" />
          <span className="text-sm text-stone-200">{mine ? 'Your address & sizes' : 'Add your address'}</span>
        </Link>
        <Link href="/store/orders" className="tile active:scale-[0.98] transition-transform flex items-center gap-3 p-4 min-h-16">
          <Package size={20} className="text-amber-400 shrink-0" />
          <span className="text-sm text-stone-200">Gifts you’ve sent</span>
        </Link>
      </div>

      <p className="mt-8 text-center text-sm text-stone-500">
        Make something couples would love? <Link href="/sell" className="text-amber-400 hover:text-amber-300 underline underline-offset-4">Sell on Hiranda</Link>
      </p>
    </div>
  )
}
