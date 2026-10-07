'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Check, Loader2 } from 'lucide-react'
import { haptic, celebrate, toast } from '@/lib/feel'
import { setDepthOptin } from '../actions'
import { PLUS_DEPTH } from '@/lib/plus-config'

const DECKS = [
  { n: 1, name: 'Light', blurb: 'Easy, fun, everyday.' },
  { n: 2, name: 'Deeper', blurb: 'Hopes, worries, what makes you you.' },
  { n: 3, name: 'Deepest', blurb: 'The things that are hard to say.' },
]

// Light is always open. Deeper and Deepest open only when you've BOTH opted
// in — and either of you can step back any time, no explanation needed.
export default function DeckPicker({ deck, mine, theirs, both, partnerName, plus }: {
  deck: number; mine: number; theirs: number; both: number; partnerName: string; plus: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const current = DECKS[deck - 1]

  function choose(level: number) {
    haptic()
    start(async () => {
      const res = await setDepthOptin(level)
      if ('error' in res && res.error) { toast(res.error); return }
      if ('both' in res && (res.both ?? 1) >= deck && deck > both) { celebrate(null, { count: 30 }); toast(`${current.name} is open 🔓`) }
      router.refresh()
    })
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Question deck">
        {DECKS.map(d => {
          const open = d.n <= both
          return (
            <Link key={d.n} href={`/games/questions?t=question&deck=${d.n}`} role="tab" aria-selected={deck === d.n} onClick={() => haptic()}
              className={`rounded-2xl px-3 py-2.5 text-center transition-colors ${deck === d.n ? 'bg-amber-700 text-amber-50' : 'bg-stone-800/70 text-stone-300 hover:bg-stone-800'}`}>
              <span className="flex items-center justify-center gap-1 text-sm font-semibold">{!open && <Lock size={12} />}{d.name}</span>
              <span className="block text-[10px] opacity-75 mt-0.5">{'●'.repeat(d.n)}{'○'.repeat(3 - d.n)}</span>
            </Link>
          )
        })}
      </div>

      {deck > both && deck >= PLUS_DEPTH && !plus ? (
        <div className="paper rounded-[6px] px-5 py-5 mt-4 -rotate-[0.3deg]">
          <p className="font-hand text-[26px] leading-tight text-[var(--paper-ink)]">{current.name} comes with Plus.</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">{current.blurb} One plan unlocks it for both of you.</p>
          <Link href="/plus" className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium">
            See Hiranda Plus
          </Link>
        </div>
      ) : deck > both ? (
        <div className="paper rounded-[6px] px-5 py-5 mt-4 -rotate-[0.3deg]">
          <p className="font-hand text-[26px] leading-tight text-[var(--paper-ink)]">{current.name} is opt-in.</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">{current.blurb} It opens when you’ve both said yes.</p>
          <div className="flex flex-col gap-1.5 mt-3 text-sm text-[var(--paper-ink)]">
            <span className="flex items-center gap-2">{mine >= deck ? <Check size={15} className="text-emerald-700" /> : <span className="h-[15px] w-[15px] rounded-full border border-current opacity-40" />} You {mine >= deck ? 'are in' : 'haven’t opted in'}</span>
            <span className="flex items-center gap-2">{theirs >= deck ? <Check size={15} className="text-emerald-700" /> : <span className="h-[15px] w-[15px] rounded-full border border-current opacity-40" />} {partnerName} {theirs >= deck ? 'is in' : 'hasn’t opted in yet'}</span>
          </div>
          {mine < deck ? (
            <button onClick={() => choose(deck)} disabled={pending} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium">
              {pending && <Loader2 size={14} className="animate-spin" />} I’m ready for {current.name}
            </button>
          ) : (
            <p className="text-xs text-[var(--paper-muted)] mt-3">We’ll let {partnerName} know once — no pressure.</p>
          )}
        </div>
      ) : mine > 1 && deck === mine ? (
        <button onClick={() => choose(deck - 1)} disabled={pending} className="mt-2 text-xs text-stone-500 hover:text-stone-300">
          Not feeling {current.name} right now? Step back to {DECKS[deck - 2].name}
        </button>
      ) : null}
    </div>
  )
}
