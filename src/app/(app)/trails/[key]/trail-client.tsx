'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, Lock } from 'lucide-react'
import { haptic, celebrate, toast } from '@/lib/feel'
import { completeTrailDay } from '../actions'

type Day = {
  n: number; title: string; learn: string; source: string; doIt: string; ask: string
  state: 'together' | 'open' | 'later'; plusOnly: boolean
  mine: { note: string | null } | null
  theirs: { note: string | null } | null
}

export default function TrailClient({ trail, days, open, stamped, partnerName }: {
  trail: { key: string; title: string; emoji: string; color: string; blurb: string }
  days: Day[]; open: number; stamped: boolean; partnerName: string
}) {
  const finished = open > days.length

  return (
    <div className="px-4 pt-6 pb-12 max-w-xl mx-auto">
      <Link href="/trails" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-5"><ArrowLeft size={16} /> Trails</Link>

      <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">A five-day trail</p>
      <h1 className="font-serif text-[44px] leading-none text-amber-50 mt-1">{trail.title} <span aria-hidden>{trail.emoji}</span></h1>
      <p className="text-stone-400 mt-2">{trail.blurb}</p>

      {/* the trail itself: one dot per day, a line between */}
      <ol className="flex items-center mt-6" aria-label="Your days">
        {days.map((d, i) => (
          <li key={d.n} className="flex items-center flex-1 last:flex-none">
            <span className={`grid place-items-center h-9 w-9 rounded-full text-sm font-semibold ${d.state === 'together' ? 'text-white' : d.state === 'open' ? 'text-amber-50 ring-2 ring-offset-2 ring-offset-stone-950' : 'text-stone-500 border border-dashed border-stone-700'}`}
              style={d.state === 'later' ? undefined : { background: d.state === 'together' ? trail.color : `color-mix(in oklab, ${trail.color} 35%, transparent)`, ['--tw-ring-color' as string]: trail.color }}>
              {d.state === 'together' ? <Check size={15} strokeWidth={3} /> : d.n}
            </span>
            {i < days.length - 1 && <span className="flex-1 h-0.5 mx-1" style={{ background: d.state === 'together' ? trail.color : 'var(--color-stone-800)' }} />}
          </li>
        ))}
      </ol>

      {finished && (
        <div className="paper rounded-[8px] px-5 py-5 mt-8 -rotate-[0.6deg] relative">
          <span className="tape -top-3 left-8 -rotate-6" />
          <p className="font-hand text-[28px] leading-tight text-[var(--paper-ink)]">You walked the whole trail together.</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">{stamped ? 'There’s a rare coupon waiting for each of you in your coupon book.' : 'Nice work, you two.'}</p>
          {stamped && <Link href="/grow/coupons" className="mt-3 inline-flex text-sm font-medium text-[var(--paper-ink)] underline underline-offset-4">Open the coupon book</Link>}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {days.map(d => d.state === 'open'
          ? <OpenDay key={d.n} day={d} trail={trail} partnerName={partnerName} last={d.n === days.length} />
          : <ClosedDay key={d.n} day={d} trail={trail} partnerName={partnerName} />)}
      </div>
    </div>
  )
}

function ClosedDay({ day, trail, partnerName }: { day: Day; trail: { color: string }; partnerName: string }) {
  if (day.state === 'later') {
    return (
      <div className="flex items-center gap-3 text-stone-500 px-1">
        <Lock size={14} />
        <span className="text-sm">Day {day.n} · {day.title}</span>
        <span className="text-xs ml-auto">{day.plusOnly ? 'with Plus' : 'opens after the day before'}</span>
      </div>
    )
  }
  return (
    <details className="tile p-4 group">
      <summary className="flex items-center gap-3 cursor-pointer list-none">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: trail.color }} />
        <span className="text-amber-50">Day {day.n} · {day.title}</span>
        <span className="text-xs text-stone-500 ml-auto group-open:hidden">done together</span>
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <p className="text-stone-400">{day.ask}</p>
        {day.mine?.note && <p className="font-hand text-[21px] text-amber-100 leading-tight">you: “{day.mine.note}”</p>}
        {day.theirs?.note && <p className="font-hand text-[21px] text-amber-200 leading-tight">{partnerName}: “{day.theirs.note}”</p>}
      </div>
    </details>
  )
}

function OpenDay({ day, trail, partnerName, last }: { day: Day; trail: { key: string; color: string }; partnerName: string; last: boolean }) {
  const router = useRouter()
  const [note, setNote] = useState(day.mine?.note ?? '')
  const [pending, start] = useTransition()
  const done = !!day.mine

  if (day.plusOnly) {
    return (
      <div className="paper rounded-[8px] px-5 py-5 -rotate-[0.3deg]">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">Day {day.n}</p>
        <p className="font-hand text-[26px] leading-tight text-[var(--paper-ink)] mt-1">{day.title}</p>
        <p className="text-sm text-[var(--paper-muted)] mt-1">The rest of this trail comes with Plus. One plan opens it for both of you.</p>
        <Link href="/plus" className="mt-4 inline-flex items-center h-10 px-4 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium">See Hiranda Plus</Link>
      </div>
    )
  }

  function finish() {
    haptic()
    start(async () => {
      const res = await completeTrailDay(trail.key, day.n, note)
      if ('error' in res && res.error) { toast(res.error); return }
      if (!done) celebrate(null, { count: last ? 70 : 35 })
      if ('stamped' in res && res.stamped) toast('Trail walked! A rare coupon for each of you 🎟️')
      else if ('together' in res && res.together) toast(`Day ${day.n} done together 💛`)
      else if (!done) toast(`Done. ${partnerName} will see it’s their turn.`)
      router.refresh()
    })
  }

  return (
    <section>
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Day {day.n}</p>
      <h2 className="font-serif text-[32px] leading-[1.05] text-amber-50 mt-1">{day.title}</h2>

      <div className="paper rounded-[6px] px-5 pt-6 pb-5 mt-4 -rotate-[0.4deg] relative">
        <span className="tape -top-3 left-6 -rotate-6" />
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">Learn</p>
        <p className="font-serif text-[19px] leading-relaxed text-[var(--paper-ink)] mt-2">{day.learn}</p>
        <p className="text-[11px] text-[var(--paper-muted)] mt-3">— {day.source}</p>
      </div>

      <div className="mt-5 tile p-4" style={{ background: `linear-gradient(110deg, color-mix(in oklab, ${trail.color} 26%, transparent), transparent 75%), color-mix(in oklab, var(--color-stone-900) 80%, transparent)` }}>
        <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Do it together</p>
        <p className="text-amber-50 mt-1 text-[16px]">{day.doIt}</p>
      </div>

      <div className="mt-5">
        <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-2">Your answer <span className="normal-case tracking-normal text-stone-500">(optional; {partnerName} sees it once you’ve both finished)</span></p>
        <div className="paper paper-ruled rounded-[6px] px-4 pt-3 pb-2">
          <p className="font-hand text-[21px] text-[var(--paper-muted)] leading-[30px]">{day.ask}</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} aria-label={day.ask}
            className="w-full bg-transparent resize-none font-hand text-[23px] leading-[30px] text-[var(--paper-ink)] focus:outline-none" />
        </div>
      </div>

      <button onClick={finish} disabled={pending}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        style={{ background: trail.color, boxShadow: `0 5px 0 color-mix(in oklab, ${trail.color} 55%, black)` }}>
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
        {done ? 'Save my answer' : 'We did it'}
      </button>

      <p className="mt-4 text-sm text-stone-400 text-center">
        {day.theirs
          ? done ? `${partnerName} finished too.` : `${partnerName} finished this one. Your turn!`
          : done ? `${partnerName} hasn’t done this one yet. The next day opens once they do; no rush.` : `${partnerName} hasn’t done this one yet.`}
      </p>
    </section>
  )
}
