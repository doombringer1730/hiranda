import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Package, Settings2 } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { PARTNER_GIFTS, PRODUCTS } from '@/lib/store/catalog'
import { isStoreAdmin, storeEnabled } from '@/lib/store/server'
import { stripeOpenTo, stripeTestMode } from '@/lib/billing'
import TestCardHint from '@/components/test-card-hint'
import { AskForAddress, GiftCard } from './store-client'

export const metadata = { title: 'Hiranda Store' }

export default async function StorePage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const [people, { data: partnerReady }, { data: mine }] = await Promise.all([
    getPeople(),
    ctx.supabase.rpc('partner_has_gift_address'),
    ctx.supabase.from('store_addresses').select('user_id').eq('user_id', ctx.user.id).maybeSingle(),
  ])
  const partner = people.get(ctx.partnerId)?.first ?? 'your partner'
  const open = storeEnabled() && stripeOpenTo(ctx.user.email)

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl md:max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="Send a little something" title="Hiranda Store" />
        {isStoreAdmin(ctx.user.email) && (
          <Link href="/store/admin" className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-stone-800 px-3 h-9 text-xs text-stone-300 hover:bg-stone-700"><Settings2 size={14} /> Orders to ship</Link>
        )}
      </div>
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-6">for the days you can’t be there.</p>

      {!partnerReady && (
        <div className="paper rounded-[6px] px-5 py-4 mb-6 -rotate-[0.3deg]">
          <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">{partner} hasn’t added a delivery address yet.</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">It stays private — you’ll never see it. We’ll just know where to send your gift.</p>
          <AskForAddress partner={partner} />
        </div>
      )}

      {!open && (
        <p className="mb-6 rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-3 text-sm text-stone-400">The store opens soon — have a look around.</p>
      )}

      {open && stripeTestMode() && <div className="mb-6"><TestCardHint /></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PRODUCTS.map(p => (
          <GiftCard key={p.key} product={p} partner={partner} canSend={open && !!partnerReady} />
        ))}
      </div>

      {PARTNER_GIFTS.length > 0 && (
        <section className="mt-10">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">From our partners</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PARTNER_GIFTS.map(g => (
              <a key={g.key} href={g.url} target="_blank" rel="sponsored noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 hover:border-stone-700 transition-colors">
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
        <Link href="/store/address" className="flex items-center gap-2.5 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 hover:border-stone-700 transition-colors">
          <MapPin size={18} className="text-amber-400" />
          <span className="text-sm text-stone-200">{mine ? 'Your delivery address' : 'Add your address'}</span>
        </Link>
        <Link href="/store/orders" className="flex items-center gap-2.5 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 hover:border-stone-700 transition-colors">
          <Package size={18} className="text-amber-400" />
          <span className="text-sm text-stone-200">Gifts you’ve sent</span>
        </Link>
      </div>
    </div>
  )
}
