'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { haptic, toast } from '@/lib/feel'
import { WEATHER } from '@/lib/closeness'
import { checkIn } from './actions'

// Five weathers, no numbers. Tapping one saves it; only you will see it.
export default function CheckinButtons({ partnerName }: { partnerName: string }) {
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState<number | null>(null)

  function pick(score: number) {
    haptic()
    start(async () => {
      const res = await checkIn(score)
      if ('error' in res && res.error) { toast(res.error); return }
      setSaved(score)
    })
  }

  if (saved) {
    return (
      <div>
        <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">thanks. that’s just for you.</p>
        <Link href="/closeness" className="text-xs text-[var(--paper-muted)] underline underline-offset-2">See how it’s been</Link>
      </div>
    )
  }

  return (
    <div>
      <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">How close have you felt to {partnerName} lately?</p>
      <div className="mt-3 flex justify-between gap-1" role="group" aria-label="How close you've felt">
        {WEATHER.map(w => (
          <button key={w.score} onClick={() => pick(w.score)} disabled={pending} aria-label={w.word}
            className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2 hover:bg-black/5 active:scale-95 transition-transform disabled:opacity-50">
            <span className="text-2xl" aria-hidden>{w.emoji}</span>
            <span className="text-[10px] leading-tight text-[var(--paper-muted)] text-center">{w.word}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[var(--paper-muted)] mt-2">Private. {partnerName} never sees it.</p>
    </div>
  )
}
