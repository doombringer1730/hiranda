import Link from 'next/link'
import { Check, Lock } from 'lucide-react'
import type { Unit } from '@/lib/path'
import { isPlusUnit } from '@/lib/plus-config'

// The winding path, Duolingo-style. Each node is half yours, half theirs: it
// fills in your colour when you finish, theirs when they do, and turns the
// unit colour with a check once you've both done it. Lessons unlock in order
// for each of you, so neither has to wait on the other.
const SWAY = [0, 54, 84, 54, 0, -54, -84, -54]

export default function PathMap({ units, doneBy, myId, partnerId, myColor, partnerColor, plus }: {
  units: Unit[]
  plus: boolean
  doneBy: Record<string, string[]>
  myId: string
  partnerId: string
  myColor: string
  partnerColor: string
}) {
  let i = 0
  let unlocked = true // sequential for you
  let currentShown = false

  return (
    <div className="flex flex-col items-center gap-2">
      {units.map((unit, ui) => (
        <div key={unit.key} className="w-full flex flex-col items-center">
          <div className="w-full rounded-[22px] px-5 py-4 mb-6 mt-2 flex items-center gap-4" style={{ background: `linear-gradient(120deg, ${unit.color}, color-mix(in oklab, ${unit.color} 55%, black))` }}>
            <span className="text-3xl drop-shadow">{unit.emoji}</span>
            <span className="min-w-0">
              <span className="block font-serif text-2xl leading-tight text-white">{unit.title}</span>
              <span className="block text-white/80 text-sm">{unit.blurb}</span>
            </span>
            {!plus && isPlusUnit(ui) && (
              <Link href="/plus" className="ml-auto shrink-0 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white">PLUS</Link>
            )}
          </div>

          {unit.lessons.map(lesson => {
            const who = doneBy[lesson.key] ?? []
            const me = who.includes(myId), them = who.includes(partnerId)
            const both = me && them
            // Plus units open the Plus page instead of the lesson.
            const gated = !plus && isPlusUnit(ui) && !me
            const locked = (!unlocked && !me) || gated
            const current = !me && unlocked && !currentShown && !gated
            if (current) currentShown = true
            if (!me) unlocked = false
            const x = SWAY[i++ % SWAY.length]

            const ring = both
              ? unit.color
              : `conic-gradient(${me ? myColor : 'var(--color-stone-700)'} 0 50%, ${them ? partnerColor : 'var(--color-stone-700)'} 50% 100%)`

            return (
              <div key={lesson.key} className={`relative flex flex-col items-center mb-5 ${current ? 'mt-10' : ''}`} style={{ translate: `${x}px 0` }}>
                {current && (
                  <span className="absolute -top-9 z-10 rounded-xl bg-stone-900 border border-stone-700 px-3 py-1 text-xs font-semibold text-amber-200 whitespace-nowrap animate-bounce-soft">
                    {them ? 'Your turn!' : 'Start here'}
                  </span>
                )}
                <Link
                  href={gated ? '/plus' : locked ? '#' : `/grow/lesson/${lesson.key}`}
                  aria-disabled={locked}
                  aria-label={`${lesson.title}${both ? ' — done together' : me ? ' — you’re done' : locked ? ' — locked' : ''}`}
                  className={`relative grid place-items-center rounded-full transition-transform ${current ? 'h-[84px] w-[84px] active:scale-95' : 'h-[72px] w-[72px]'} ${locked && !gated ? 'pointer-events-none' : 'hover:scale-105 active:scale-95'}`}
                  style={{ background: ring, boxShadow: `0 6px 0 color-mix(in oklab, ${both ? unit.color : 'var(--color-stone-800)'} 60%, black)` }}
                >
                  <span className={`grid place-items-center rounded-full ${current ? 'h-[70px] w-[70px]' : 'h-[58px] w-[58px]'}`} style={{ background: both ? unit.color : 'var(--color-stone-900)' }}>
                    {both ? <Check size={28} strokeWidth={3} className="text-white" />
                      : locked ? <Lock size={20} className="text-stone-600" />
                      : <span className="text-2xl">{unit.emoji}</span>}
                  </span>
                </Link>
                <span className={`mt-2 text-[12px] max-w-[120px] text-center leading-tight ${locked ? 'text-stone-600' : 'text-stone-300'}`}>{lesson.title}</span>
              </div>
            )
          })}
        </div>
      ))}
      <p className="font-hand text-[22px] text-stone-500 mt-4">more paths coming soon.</p>
    </div>
  )
}
