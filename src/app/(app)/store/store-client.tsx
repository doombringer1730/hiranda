'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Loader2, X } from 'lucide-react'
import { formatPrice, type Product } from '@/lib/store/catalog'
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

export function GiftCard({ product, partner, canSend }: { product: Product; partner: string; canSend: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => { haptic(); setOpen(true) }}
        className="text-left rounded-3xl border border-stone-800 bg-stone-900/60 p-5 hover:border-amber-800/50 transition-colors flex flex-col gap-3">
        <span className="text-5xl" aria-hidden="true">{product.emoji}</span>
        <span>
          <span className="block font-serif text-2xl text-amber-50 leading-tight">{product.title}</span>
          <span className="block text-stone-400 text-sm mt-1">{product.blurb}</span>
        </span>
        <span className="mt-auto flex items-center justify-between">
          <span className="text-amber-200 text-sm font-medium">{formatPrice(product.priceCents)}</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-300"><Gift size={14} /> Send to {partner}</span>
        </span>
      </button>
      {open && <SendSheet product={product} partner={partner} canSend={canSend} onClose={() => setOpen(false)} />}
    </>
  )
}

function SendSheet({ product, partner, canSend, onClose }: { product: Product; partner: string; canSend: boolean; onClose: () => void }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  function send() {
    start(async () => {
      const res = await startGift(product.key, note)
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
      <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-stone-800 bg-stone-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-page-in">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-stone-500 hover:text-stone-300"><X size={18} /></button>
        <p className="text-4xl" aria-hidden="true">{product.emoji}</p>
        <h3 className="font-serif text-2xl text-amber-50 mt-2">{product.title}</h3>
        <p className="text-stone-400 text-sm mt-1">{product.blurb}</p>

        <label className="block mt-5 text-stone-400 text-xs uppercase tracking-[0.18em]" htmlFor="gift-note">Your note to {partner}</label>
        <textarea id="gift-note" value={note} onChange={e => setNote(e.target.value.slice(0, 300))} rows={product.key === 'letter' ? 6 : 3}
          placeholder={product.key === 'letter' ? `Dear ${partner},…` : product.section === 'keepsake' ? `A few words — ${partner} sees them in Hiranda` : 'A few words for the card'}
          className="paper paper-ruled mt-2 w-full rounded-[4px] px-4 py-3 font-hand text-[21px] leading-[30px] text-[var(--paper-ink)] placeholder:text-[var(--paper-muted)] focus:outline-none" />
        <p className="text-right text-[11px] text-stone-500 mt-1">{note.length}/300</p>
        {product.fineprint && <p className="text-stone-500 text-xs mt-1">{product.fineprint}</p>}

        <button onClick={send} disabled={!canSend || pending || (product.key === 'letter' && !note.trim())}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium transition-colors">
          {pending && <Loader2 size={16} className="animate-spin" />}
          {canSend ? `Send for ${formatPrice(product.priceCents)}` : 'Not available yet'}
        </button>
        <p className="text-stone-500 text-[11px] text-center mt-2">Paid securely with Stripe. Ships to {partner}’s private address.</p>
      </div>
    </div>
  )
}
