'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { celebrate, haptic, toast } from '@/lib/feel'
import { PLUS_TRIAL_DAYS } from '@/lib/plus-config'
import { startFreeWeek, dismissPlusIntro } from './intro-actions'

const HIGHLIGHTS = [
  { emoji: '📔', text: 'Every month turned into a keepsake' },
  { emoji: '🥾', text: 'Trails: five-day courses on money, love, distance and more' },
  { emoji: '🕯️', text: 'After Dark, a deck just for the two of you' },
  { emoji: '⏳', text: 'Every movie night kept as a ticket stub' },
]

// Shown once, the first time a paired couple opens Hiranda: a warm hello to
// Plus with a free week (no card) and an equally easy "maybe later". Never
// blocks anything: tapping outside closes it too.
export default function PlusIntro({ partnerName }: { partnerName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [pending, start] = useTransition()
  if (!open) return null

  function later() {
    haptic()
    setOpen(false)
    start(async () => { await dismissPlusIntro() })
  }

  function begin() {
    haptic()
    start(async () => {
      const res = await startFreeWeek()
      if (res.error) { toast(res.error); setOpen(false); return }
      celebrate(null, { count: 60 })
      toast(`Plus is on for you and ${partnerName} ✨`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="plus-intro-title">
      <button aria-label="Close" onClick={later} className="absolute inset-0 bg-black/60 animate-page-in" />
      <div className="relative w-full sm:max-w-md mx-auto paper rounded-t-[22px] sm:rounded-[22px] px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-rise">
        <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-2" />
        <p className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--paper-muted)]"><Sparkles size={12} /> Hiranda Plus</p>
        <h2 id="plus-intro-title" className="font-serif text-[32px] leading-tight text-center text-[var(--paper-ink)] mt-2">A free week of Plus, on us.</h2>
        <p className="font-hand text-[23px] text-center text-[var(--paper-muted)] mt-1">for you and {partnerName}, together.</p>

        <ul className="mt-5 flex flex-col gap-2.5">
          {HIGHLIGHTS.map(h => (
            <li key={h.text} className="flex items-center gap-3 text-[15px] text-[var(--paper-ink)]">
              <span className="text-xl w-7 text-center" aria-hidden>{h.emoji}</span>{h.text}
            </li>
          ))}
        </ul>

        <p className="text-xs text-[var(--paper-muted)] text-center mt-5 leading-relaxed">
          No card needed. After {PLUS_TRIAL_DAYS} days it simply ends: nothing renews, nothing is charged, and everything you made stays yours.
        </p>

        <div className="mt-5 grid gap-2.5">
          <button onClick={begin} disabled={pending}
            className="h-12 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {pending && <Loader2 size={16} className="animate-spin" />} Start our free week
          </button>
          <button onClick={later} disabled={pending}
            className="h-12 rounded-full border border-[color-mix(in_oklab,var(--paper-ink)_25%,transparent)] text-[var(--paper-ink)] font-medium disabled:opacity-60">
            Maybe later
          </button>
        </div>
        <p className="text-[11px] text-[var(--paper-muted)] text-center mt-3">You can start it any time from the Plus page.</p>
      </div>
    </div>
  )
}
