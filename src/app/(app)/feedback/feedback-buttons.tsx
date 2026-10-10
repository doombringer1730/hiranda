'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { haptic, toast } from '@/lib/feel'
import { rateHiranda, addFeedbackNote } from './actions'

const CHOICES = [
  { rating: 3, emoji: '😍', word: 'Love it' },
  { rating: 2, emoji: '🙂', word: 'It’s okay' },
  { rating: 1, emoji: '😕', word: 'Not really' },
] as const

// One tap, then an optional note. Nothing is shown to your partner.
export default function FeedbackButtons() {
  const [pending, start] = useTransition()
  const [id, setId] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [gone, setGone] = useState(false)

  function rate(r: number | null) {
    haptic()
    start(async () => {
      const res = await rateHiranda(r)
      if ('error' in res && res.error) { toast(res.error); return }
      if (r === null) { setGone(true); return }
      setRating(r)
      setId(res.id ?? null)
    })
  }

  function send() {
    if (!id) return
    start(async () => {
      const res = await addFeedbackNote(id, note)
      if ('error' in res && res.error) { toast(res.error); return }
      setDone(true)
    })
  }

  if (gone) return null

  if (done) {
    return (
      <section className="tile p-4">
        <p className="text-amber-50 text-sm">Thank you — that really helps. 💛</p>
      </section>
    )
  }

  if (rating !== null) {
    return (
      <section className="tile p-4">
        <p className="text-amber-50 text-sm font-medium">{rating === 3 ? 'That makes my day. Anything you’d love to see next?' : 'Thanks for being honest. What would make it better?'}</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3}
          placeholder="Optional"
          className="mt-3 w-full rounded-xl bg-stone-900 border border-stone-800 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
        <div className="mt-2 flex justify-end gap-3">
          <button onClick={() => setDone(true)} disabled={pending} className="text-stone-500 hover:text-stone-300 text-sm">Skip</button>
          <button onClick={send} disabled={pending || !note.trim()}
            className="rounded-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-stone-950">Send</button>
        </div>
      </section>
    )
  }

  return (
    <section className="tile p-4 animate-rise">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-amber-50 text-sm font-medium">Enjoying Hiranda?</p>
        <button onClick={() => rate(null)} disabled={pending} aria-label="Not now" className="text-stone-500 hover:text-stone-300 -m-1 p-1" style={{ minHeight: 0 }}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex gap-2" role="group" aria-label="How you feel about Hiranda">
        {CHOICES.map(c => (
          <button key={c.rating} onClick={() => rate(c.rating)} disabled={pending}
            className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-stone-900/60 border border-stone-800 py-2.5 hover:border-stone-700 active:scale-95 transition-transform disabled:opacity-50">
            <span className="text-2xl" aria-hidden>{c.emoji}</span>
            <span className="text-xs text-stone-300">{c.word}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-stone-500 mt-2">Just between you and the person who makes Hiranda.</p>
    </section>
  )
}
