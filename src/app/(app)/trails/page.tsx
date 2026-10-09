import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Sparkles } from 'lucide-react'
import { coupleContext } from '@/lib/couple'
import { hasPlus } from '@/lib/plus'
import { TRAILS, openDay } from '@/lib/trails'
import PageHeader from '@/components/page-header'
import WhyItWorks from '@/components/why-it-works'
import { Scribble } from '@/components/handmade'

export const metadata = { title: 'Trails · Hiranda' }

// Trails: pick a topic, walk it together over five days. No timers, no
// "you're behind": a day opens when you've both finished the last one.
export default async function TrailsPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const [{ data: rows }, { data: stamps }, plus] = await Promise.all([
    ctx.supabase.from('trail_progress').select('trail_key, user_id, day').eq('couple_id', ctx.couple.id),
    ctx.supabase.from('trail_stamps').select('trail_key').eq('couple_id', ctx.couple.id),
    hasPlus(),
  ])
  const stamped = new Set((stamps ?? []).map(s => s.trail_key))

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <PageHeader eyebrow="Grow together" title="Trails" />
      <p className="relative inline-block font-hand text-[23px] text-amber-200 mt-2 mb-8">
        five small days on one thing that matters
        <Scribble kind="underline" className="absolute left-0 -bottom-1.5 h-2 w-full text-amber-500/60" />
      </p>

      <ul className="flex flex-col gap-4">
        {TRAILS.map((t, i) => {
          const doneBy = new Map<number, Set<string>>()
          for (const r of rows ?? []) if (r.trail_key === t.key) doneBy.set(r.day, (doneBy.get(r.day) ?? new Set()).add(r.user_id))
          const open = openDay(t, doneBy, ctx.user.id, ctx.partnerId)
          const finished = open > t.days.length
          const started = open > 1 || !!doneBy.get(1)?.size
          return (
            <li key={t.key} style={{ rotate: `${[-0.6, 0.5, -0.3][i % 3]}deg` }}>
              <Link href={`/trails/${t.key}`} className="paper rounded-[8px] px-5 py-4 flex items-center gap-4 group relative">
                {i % 2 === 0 && <span className="tape -top-3 right-8 rotate-6" />}
                <span className="grid place-items-center h-14 w-14 shrink-0 rounded-full text-3xl" style={{ background: `color-mix(in oklab, ${t.color} 22%, transparent)` }}>{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[22px] leading-tight text-[var(--paper-ink)]">{t.title}</span>
                  <span className="block text-sm text-[var(--paper-muted)] mt-0.5">{t.blurb}</span>
                  <span className="mt-2 flex items-center gap-1.5" aria-label={`${Math.min(open - 1, t.days.length)} of ${t.days.length} days together`}>
                    {t.days.map((_, d) => (
                      <span key={d} className="h-2 w-6 rounded-full" style={{ background: d + 1 < open ? t.color : 'color-mix(in oklab, var(--paper-ink) 14%, transparent)' }} />
                    ))}
                    <span className="text-[11px] text-[var(--paper-muted)] ml-1">{finished ? 'walked together' : started ? `day ${open}` : !plus ? 'day 1 free' : `${t.days.length} days`}</span>
                  </span>
                </span>
                {stamped.has(t.key)
                  ? <span className="shrink-0 grid place-items-center h-14 w-14 rounded-full border-[3px] border-double text-[10px] font-semibold uppercase tracking-[0.18em] -rotate-12" style={{ borderColor: t.color, color: t.color }}>walked</span>
                  : <ChevronRight size={18} className="text-[var(--paper-muted)] shrink-0 group-hover:translate-x-0.5 transition-transform" />}
              </Link>
            </li>
          )
        })}
      </ul>

      {!plus && (
        <Link href="/plus" className="mt-8 block tile p-5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-stone-400"><Sparkles size={12} /> Hiranda Plus</p>
          <p className="font-serif text-xl text-amber-50 mt-1">Walk the whole trail</p>
          <p className="text-sm text-stone-400 mt-1">Day one of every trail is free. Plus opens the rest for both of you, and each finished trail gives you both a rare coupon.</p>
        </Link>
      )}

      <WhyItWorks className="mt-10" source="Doss et al., 2016">
        Short, structured couples programs, with real practice at home, raised relationship satisfaction in randomized trials.
      </WhyItWorks>
    </div>
  )
}
