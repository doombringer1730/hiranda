'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

// Home's quiet way into Grow: your next stop while you're partway along a
// route, or one line inviting you to start. "Not this week" hides it until
// next week (kept on this device only). Never mentions what your partner
// hasn't done.

const week = () => {
  const d = new Date()
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}
const KEY = 'hiranda:map-card-snoozed'
const snoozedThisWeek = () => { try { return localStorage.getItem(KEY) === week() } catch { return false } }
const noSubscribe = () => () => {}

export default function MapCard({ next }: {
  next: { routeTitle: string; emoji: string; color: string; stopKey: string; stopTitle: string; n: number; of: number } | null
}) {
  // Hidden on the server (it can't see this device's snooze), shown once we know.
  const snoozed = useSyncExternalStore(noSubscribe, snoozedThisWeek, () => true)
  const [dismissed, setDismissed] = useState(false)
  if (snoozed || dismissed) return null

  const snooze = () => { try { localStorage.setItem(KEY, week()) } catch {} ; setDismissed(true) }

  return (
    <div className="tile p-4 flex items-center gap-3 animate-rise">
      <Link href={next ? `/grow/lesson/${next.stopKey}` : '/grow'} className="flex items-center gap-3 min-w-0 flex-1 group">
        <span className="grid place-items-center h-11 w-11 shrink-0 rounded-full text-xl" style={{ background: next ? `color-mix(in oklab, ${next.color} 30%, transparent)` : 'var(--color-stone-800)' }} aria-hidden>
          {next?.emoji ?? '🗺️'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-stone-400 text-[11px] uppercase tracking-[0.2em]">{next ? `Next on your map · ${next.routeTitle}` : 'Your map'}</span>
          <span className="block text-amber-50 text-[15px] truncate">{next ? next.stopTitle : 'Little routes to walk together, at your own pace'}</span>
          {next && <span className="block text-stone-500 text-xs">Stop {next.n} of {next.of} · a few minutes</span>}
        </span>
        <ChevronRight size={16} className="text-stone-600 group-hover:text-amber-400 shrink-0" />
      </Link>
      <button onClick={snooze} className="shrink-0 text-stone-500 hover:text-stone-300 text-[11px] leading-tight text-right w-12">Not this week</button>
    </div>
  )
}
