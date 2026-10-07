'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import WhyItWorks from '@/components/why-it-works'
import { haptic, celebrate, toast } from '@/lib/feel'
import { completeLesson } from '../../actions'

export default function LessonClient({ lessonKey, title, learn, source, action, reflect, unit, step, partnerName, mine, theirs, next }: {
  lessonKey: string; title: string; learn: string; source: string
  action: { label: string; href: string }; reflect: string
  unit: { title: string; emoji: string; color: string }; step: { n: number; of: number }
  partnerName: string
  mine: { note: string | null } | null
  theirs: { note: string | null } | null
  next: { key: string; title: string } | null
}) {
  const router = useRouter()
  const [note, setNote] = useState(mine?.note ?? '')
  const [done, setDone] = useState(!!mine)
  const [pending, start] = useTransition()

  function finish() {
    haptic()
    start(async () => {
      const res = await completeLesson(lessonKey, note)
      if ('error' in res && res.error) { toast(res.error); return }
      if (!done) celebrate(null, { count: 40 })
      setDone(true)
      if ('stamped' in res && res.stamped?.length) toast('New stamp! You both earned a coupon 🎟️')
      else if ('together' in res && res.together) toast(`You finished this together with ${partnerName} 💛`)
      else if (!mine) toast('Done — nice. Your partner will see it’s their turn.')
      router.refresh()
    })
  }

  return (
    <div className="px-4 pt-6 pb-12 max-w-xl mx-auto">
      <Link href="/grow" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-5"><ArrowLeft size={16} /> The Path</Link>

      {/* progress through the unit */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{unit.emoji}</span>
        <span className="flex-1 h-2.5 rounded-full bg-stone-800 overflow-hidden">
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${((step.n - (done ? 0 : 1)) / step.of) * 100}%`, background: unit.color }} />
        </span>
        <span className="text-stone-400 text-xs">{step.n}/{step.of}</span>
      </div>

      <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">{unit.title}</p>
      <h1 className="font-serif text-[40px] leading-[1.05] text-amber-50 mt-1">{title}</h1>

      {/* 1 · learn */}
      <section className="paper rounded-[6px] px-5 pt-6 pb-5 mt-6 -rotate-[0.4deg]">
        <span className="tape -top-3 left-6 -rotate-6" />
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">1 · Learn</p>
        <p className="font-serif text-[19px] leading-relaxed text-[var(--paper-ink)] mt-2">{learn}</p>
        <p className="text-[11px] text-[var(--paper-muted)] mt-3">— {source}</p>
      </section>

      {/* 2 · do */}
      <section className="mt-6">
        <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-2">2 · Do it, for real</p>
        <Link href={action.href} className="tile p-4 flex items-center gap-3 group" style={{ background: `linear-gradient(110deg, color-mix(in oklab, ${unit.color} 30%, transparent), transparent 75%), color-mix(in oklab, var(--color-stone-900) 80%, transparent)` }}>
          <span className="flex-1 text-amber-50 font-medium">{action.label}</span>
          <ArrowRight size={18} className="text-stone-400 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </section>

      {/* 3 · reflect */}
      <section className="mt-6">
        <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-2">3 · Reflect <span className="normal-case tracking-normal text-stone-500">(optional — {partnerName} sees it once you’ve both finished)</span></p>
        <div className="paper paper-ruled rounded-[6px] px-4 pt-3 pb-2">
          <p className="font-hand text-[21px] text-[var(--paper-muted)] leading-[30px]">{reflect}</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000}
            className="w-full bg-transparent resize-none font-hand text-[23px] leading-[30px] text-[var(--paper-ink)] focus:outline-none" />
        </div>
      </section>

      <button onClick={finish} disabled={pending}
        className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        style={{ background: unit.color, boxShadow: `0 5px 0 color-mix(in oklab, ${unit.color} 55%, black)` }}>
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
        {done ? 'Save my note' : 'I did it'}
      </button>

      {/* partner */}
      <div className="mt-6 tile p-4">
        {theirs ? (
          <>
            <p className="text-amber-200 text-sm">{partnerName} finished this {done ? '— you did it together 💛' : '— your turn!'}</p>
            {done && theirs.note && <p className="font-hand text-[22px] text-amber-100 mt-2 leading-tight">“{theirs.note}”</p>}
          </>
        ) : (
          <p className="text-stone-400 text-sm">{partnerName} hasn’t done this one yet{done ? ' — no rush, it’ll count once they do.' : '.'}</p>
        )}
      </div>

      {done && next && (
        <Link href={`/grow/lesson/${next.key}`} className="mt-4 flex items-center justify-between text-amber-300 hover:text-amber-200 text-sm px-1">
          <span>Next: {next.title}</span><ArrowRight size={16} />
        </Link>
      )}

      <WhyItWorks className="mt-10" source="Doss et al., 2016">
        Structured couples programs — short lessons plus real practice — raised relationship satisfaction in randomized trials.
      </WhyItWorks>
    </div>
  )
}
