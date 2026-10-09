'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ImagePlus } from 'lucide-react'
import { haptic } from '@/lib/feel'

export type PrintPhoto = { id: string; url: string; caption: string; memory: string; date: string }
type Kind = 'polaroids' | 'book'

// Limits the shop's print products accept.
const KINDS: Record<Kind, { name: string; blurb: string; min: number; max: number }> = {
  polaroids: { name: 'Polaroid prints', blurb: 'Real prints with the white border, your caption written underneath. Mailed to you.', min: 1, max: 50 },
  book: { name: 'Photo book', blurb: 'A bound hardcover of your story, oldest memory first. Mailed to you.', min: 10, max: 200 },
}

export default function PrintPicker({ photos, initialKind }: { photos: PrintPhoto[]; initialKind: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind)
  const [picked, setPicked] = useState<string[]>([]) // in the order you tapped them
  const k = KINDS[kind]
  const years = useMemo(() => [...new Set(photos.map(p => p.date.slice(0, 4)))].sort(), [photos])

  const toggle = (id: string) => {
    haptic()
    setPicked(cur => cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= k.max ? cur : [...cur, id])
  }
  const pickYear = (y: string) => {
    haptic()
    const ids = photos.filter(p => p.date.startsWith(y)).map(p => p.id)
    const all = ids.every(id => picked.includes(id))
    setPicked(cur => all ? cur.filter(id => !ids.includes(id)) : [...cur, ...ids.filter(id => !cur.includes(id))].slice(0, k.max))
  }
  // A book keeps your story in date order; prints keep the order you picked.
  const ordered = kind === 'book' ? photos.filter(p => picked.includes(p.id)).map(p => p.id) : picked
  const ready = picked.length >= k.min
  const href = `/store/print?kind=${kind}&photos=${ordered.join(',')}`

  if (!photos.length) {
    return (
      <div className="tile p-8 flex flex-col items-center text-center gap-3">
        <ImagePlus size={28} className="text-stone-500" />
        <p className="text-amber-50">Add photos to your memories first.</p>
        <Link href="/memories/new" className="text-sm text-amber-400 underline underline-offset-4">Add a memory</Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1 rounded-full bg-stone-900/80 p-1 w-fit mb-3">
        {(Object.keys(KINDS) as Kind[]).map(x => (
          <button key={x} onClick={() => { haptic(); setKind(x); setPicked(p => p.slice(0, KINDS[x].max)) }} aria-pressed={x === kind}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${x === kind ? 'bg-stone-700 text-amber-50' : 'text-stone-400'}`}>
            {KINDS[x].name}
          </button>
        ))}
      </div>
      <p className="text-stone-400 text-sm mb-5">{k.blurb}</p>

      {years.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 [scrollbar-width:none]">
          {years.map(y => (
            <button key={y} onClick={() => pickYear(y)} className="shrink-0 rounded-full bg-stone-900/70 px-3.5 py-1.5 text-sm text-stone-300 hover:text-amber-50">
              All of {y}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {photos.map(p => {
          const n = picked.indexOf(p.id)
          const on = n >= 0
          return (
            <li key={p.id}>
              <button onClick={() => toggle(p.id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} ${p.caption}`}
                className={`relative w-full bg-[#efe8da] p-1.5 pb-6 rounded-[4px] shadow-md transition-transform ${on ? 'scale-[0.94] ring-2 ring-amber-500' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <span className="absolute bottom-1 inset-x-1.5 font-hand text-[13px] leading-none text-[#3b3122] truncate text-left">{p.caption}</span>
                {on && (
                  <span className="absolute -top-2 -right-2 grid place-items-center h-6 min-w-6 px-1 rounded-full bg-amber-500 text-stone-950 text-[11px] font-bold">
                    {kind === 'book' ? <Check size={13} strokeWidth={3} /> : n + 1}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+86px)] md:bottom-6 md:pl-64 z-30 px-4">
        <div className="mx-auto max-w-md material rounded-full p-2 pl-5 flex items-center justify-between gap-3">
          <p className="text-sm text-stone-300">
            {picked.length ? `${picked.length} picked` : 'Tap photos to pick'}
            {!ready && picked.length > 0 && <span className="text-stone-500"> · at least {k.min}</span>}
            {picked.length >= k.max && <span className="text-stone-500"> · that’s the most</span>}
          </p>
          {ready
            ? <Link href={href} className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-stone-950">Continue</Link>
            : <span className="rounded-full bg-stone-800 px-5 py-2.5 text-sm text-stone-500">Continue</span>}
        </div>
      </div>
    </>
  )
}
