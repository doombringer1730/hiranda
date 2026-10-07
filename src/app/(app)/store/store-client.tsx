'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { formatPrice, madeBy, type Product } from '@/lib/store/catalog'
import { hasPlugin, isNativeApp } from '@/lib/native'
import { haptic, toast } from '@/lib/feel'
import { askForAddress, startGift } from './actions'

export function AskForAddress({ partner }: { partner: string }) {
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()
  return (
    <button
      disabled={sent || pending}
      onClick={() => start(async () => { haptic(); await askForAddress(); setSent(true) })}
      className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium disabled:opacity-60"
    >
      {sent ? `We let ${partner} know ✓` : `Ask ${partner} to add one`}
    </button>
  )
}

export function GiftCard({ product, origin, partner, canSend }: { product: Product; origin: 'US' | 'International'; partner: string; canSend: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => { haptic(); setOpen(true) }}
        className="tile group text-left p-2 flex flex-col active:scale-[0.98] transition-transform">
        <span className="relative block overflow-hidden rounded-[20px]">
          {product.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={product.image} alt="" loading="lazy" className="w-full aspect-[4/5] object-cover bg-stone-800 transition-transform duration-500 group-hover:scale-[1.03]" />
            : <span className="paper grid w-full aspect-[4/5] place-items-center rounded-[20px] text-6xl" aria-hidden="true">{product.emoji}</span>}
          <OriginBadge origin={origin} className="absolute left-2 top-2" />
        </span>
        <span className="px-1.5 pt-2.5 pb-1.5 flex flex-col gap-1 flex-1">
          <span className="text-[15px] leading-snug text-amber-50 font-medium line-clamp-2">{product.title}</span>
          {madeBy(product) && <span className="text-[11px] text-stone-400 truncate">by {madeBy(product)}</span>}
          <span className="mt-auto text-amber-200 text-sm">{formatPrice(product.priceCents)}</span>
        </span>
      </button>
      {open && <SendSheet product={product} origin={origin} partner={partner} canSend={canSend} onClose={() => setOpen(false)} />}
    </>
  )
}

// Only gifts we print or pack ourselves carry the note on paper; the rest
// show it to the recipient in Hiranda.
const printsNote = (p: Product) => !p.vendor || p.vendor.name === 'gelato'

function OriginBadge({ origin, className = '' }: { origin: 'US' | 'International'; className?: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-full bg-black/55 backdrop-blur-sm text-[10px] uppercase tracking-[0.14em] text-white/90 ${className}`}>
      {origin}
    </span>
  )
}

function SendSheet({ product, origin, partner, canSend, onClose }: { product: Product; origin: 'US' | 'International'; partner: string; canSend: boolean; onClose: () => void }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [option, setOption] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function send() {
    start(async () => {
      const res = await startGift(product.key, note, option ?? undefined)
      if (!res.url) { toast(res.error ?? 'Something went wrong'); return }
      // In the iPhone app, pay in a Safari sheet and come back to your orders.
      if (isNativeApp() && hasPlugin('Browser')) {
        const { Browser } = await import('@capacitor/browser')
        const handle = await Browser.addListener('browserFinished', () => { handle.remove(); router.push('/store/orders') })
        await Browser.open({ url: res.url, presentationStyle: 'popover' })
        return
      }
      location.href = res.url
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={`Send ${product.title}`}>
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div className="tile relative w-full md:max-w-md !rounded-b-none md:!rounded-[28px] !bg-stone-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto animate-page-in">
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid place-items-center size-11 rounded-full bg-black/40 text-stone-200 hover:bg-black/60"><X size={18} /></button>
        {product.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={product.image} alt="" className="w-full aspect-[4/3] rounded-[20px] object-cover bg-stone-800" />
          : <div className="paper grid w-full aspect-[16/9] place-items-center rounded-[20px] text-7xl" aria-hidden="true">{product.emoji}</div>}
        <h3 className="font-serif text-[28px] leading-tight text-amber-50 mt-4">{product.title}</h3>
        {madeBy(product) && <p className="text-stone-400 text-sm">Made by {madeBy(product)}</p>}
        {product.blurb && <p className="text-stone-400 text-sm mt-1">{product.blurb}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-400">
          <span className="text-amber-200 text-sm font-medium">{formatPrice(product.priceCents)}</span>
          <span aria-hidden="true">·</span>
          <span>Ships from {origin === 'US' ? 'the US' : 'abroad'}</span>
          {product.delivery && <><span aria-hidden="true">·</span><span>{product.delivery}</span></>}
        </p>

        {product.options && (
          <fieldset className="mt-5">
            <legend className="text-stone-400 text-xs uppercase tracking-[0.18em]">{partner}’s {product.options.name.toLowerCase()}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.options.values.map(v => (
                <button key={v.label} type="button" onClick={() => { haptic(); setOption(v.label) }} aria-pressed={option === v.label}
                  className={`min-w-11 h-11 px-3 rounded-full text-sm transition-colors ${option === v.label ? 'bg-amber-600 text-stone-950 font-medium' : 'bg-stone-800 text-stone-200 hover:bg-stone-700'}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="block mt-5 text-stone-400 text-xs uppercase tracking-[0.18em]" htmlFor="gift-note">Your note to {partner}</label>
        <textarea id="gift-note" value={note} onChange={e => setNote(e.target.value.slice(0, 300))} rows={product.key === 'letter' ? 6 : 3}
          placeholder={product.key === 'letter' ? `Dear ${partner},…` : printsNote(product) ? 'A few words for the card' : `A few words — ${partner} sees them in Hiranda`}
          className="paper paper-ruled mt-2 w-full rounded-[4px] px-4 py-3 font-hand text-[21px] leading-[30px] text-[var(--paper-ink)] placeholder:text-[var(--paper-muted)] focus:outline-none" />
        <p className="text-right text-[11px] text-stone-500 mt-1">{note.length}/300</p>
        {product.fineprint && <p className="text-stone-500 text-xs mt-1">{product.fineprint}</p>}

        <button onClick={send} disabled={!canSend || pending || (product.key === 'letter' && !note.trim()) || (!!product.options && !option)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium transition-colors">
          {pending && <Loader2 size={16} className="animate-spin" />}
          {!canSend ? 'Not available yet' : product.options && !option ? `Pick a ${product.options.name.toLowerCase()}` : `Send for ${formatPrice(product.priceCents)}`}
        </button>
        <p className="text-stone-500 text-[11px] text-center mt-2">Paid securely with Stripe. Ships to {partner}’s private address.</p>
      </div>
    </div>
  )
}
