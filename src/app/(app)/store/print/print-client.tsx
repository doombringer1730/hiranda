'use client'

import { useState, useTransition } from 'react'
import { Loader2, X } from 'lucide-react'
import { formatPrice } from '@/lib/store/catalog'
import { PRINT_KINDS, bookPages, type PrintKind } from '@/lib/store/prints'
import { haptic, toast } from '@/lib/feel'
import { startPrintOrder } from '../actions'

type Photo = { id: string; url: string; caption: string }

// The picked photos as they'll print, with the price for that many, a note
// and the button to pay. A photo can be dropped here; adding more happens in
// Memories.
export default function PrintClient({ kind, photos: initial, partner, canSend, partnerReady, max, fineprint }: {
  kind: PrintKind; photos: Photo[]; partner: string; canSend: boolean; partnerReady: boolean; max: number; fineprint: string | null
}) {
  const [photos, setPhotos] = useState(initial)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const cfg = PRINT_KINDS[kind]
  const price = cfg.priceCents(photos.length)

  function send() {
    start(async () => {
      const res = await startPrintOrder(kind, photos.map(p => p.id), note)
      if (res.url) location.href = res.url
      else toast(res.error ?? 'Something went wrong')
    })
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <p className="text-sm text-stone-300">
        {cfg.title(photos.length)}
        {kind === 'book' && <span className="text-stone-500"> · {bookPages(photos.length)} pages, one photo each</span>}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={p.id} className={`relative flex flex-col ${kind === 'polaroids' ? 'bg-[#fbfaf7] p-2 pb-1 shadow-md' : 'paper p-3 rounded-[4px]'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption} className={`w-full ${kind === 'polaroids' ? 'aspect-square object-cover' : 'aspect-[6/5] object-contain'}`} />
            <span className="font-hand text-[18px] leading-tight text-[#3b2f2a] text-center min-h-8 pt-1 line-clamp-2">{p.caption}</span>
            {kind === 'book' && <span className="text-[10px] text-[var(--paper-muted)] text-center">page {i + 1}</span>}
            {photos.length > 1 && (
              <button onClick={() => { haptic(); setPhotos(ps => ps.filter(x => x.id !== p.id)) }} aria-label="Leave this one out"
                className="absolute right-1 top-1 grid place-items-center size-9 rounded-full bg-black/55 text-white"><X size={16} /></button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500">Up to {max} photos. Captions come from your memories.</p>

      <label className="block text-stone-400 text-xs uppercase tracking-[0.18em]" htmlFor="print-note">Your note to {partner}</label>
      <textarea id="print-note" value={note} onChange={e => setNote(e.target.value.slice(0, 300))} rows={3}
        placeholder={`A few words — ${partner} sees them in Hiranda`}
        className="paper paper-ruled -mt-3 w-full rounded-[4px] px-4 py-3 font-hand text-[21px] leading-[30px] text-[var(--paper-ink)] placeholder:text-[var(--paper-muted)] focus:outline-none" />
      {fineprint && <p className="text-stone-500 text-xs -mt-3">{fineprint}</p>}

      <button onClick={send} disabled={!canSend || pending}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium transition-colors">
        {pending && <Loader2 size={16} className="animate-spin" />}
        {canSend ? `Send to ${partner} for ${formatPrice(price)}` : !partnerReady ? `${partner} hasn’t added an address yet` : 'Not available yet'}
      </button>
      <p className="text-stone-500 text-[11px] text-center -mt-3">Paid securely with Stripe. Ships to {partner}’s private address.</p>
    </div>
  )
}
