import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Film, MessagesSquare, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { hasPlus } from '@/lib/plus'
import { togetherStubs, totalHours, duration, HOUR_MILESTONES, type Stub } from '@/lib/together'
import PageHeader from '@/components/page-header'
import WhyItWorks from '@/components/why-it-works'
import { Scribble } from '@/components/handmade'

export const metadata = { title: 'Hours together · Hiranda' }

// Hours together: every watch night is a ticket stub, every talk a pressed
// flower. The total is free; the collection comes with Plus.
export default async function TogetherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [stubs, plus] = await Promise.all([togetherStubs(supabase), hasPlus()])
  const hours = totalHours(stubs)
  const next = HOUR_MILESTONES.find(m => m > hours)
  const reached = HOUR_MILESTONES.filter(m => m <= hours)
  const watches = stubs.filter(s => s.kind === 'watch')
  const talks = stubs.filter(s => s.kind === 'talk')

  // Talks gathered by month: one pressed flower each.
  const talkMonths = new Map<string, Stub[]>()
  for (const t of talks) talkMonths.set(t.when.slice(0, 7), [...(talkMonths.get(t.when.slice(0, 7)) ?? []), t])

  const shown = plus ? watches : watches.slice(0, 1)

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <PageHeader eyebrow="Time well spent" title="Hours together" />

      <div className="mt-6 flex items-end gap-3">
        <p className="font-serif text-[72px] leading-none text-amber-50">{hours < 10 ? hours.toFixed(1) : Math.round(hours)}</p>
        <div className="pb-2">
          <p className="text-stone-300">hours, just the two of you</p>
          <p className="text-stone-500 text-xs">{watches.length} watch night{watches.length === 1 ? '' : 's'} · {talks.length} talk{talks.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      {next && (
        <p className="font-hand text-[22px] text-amber-400/90 mt-2 relative inline-block">
          {reached.length ? `past ${reached.at(-1)} hours. ` : ''}next up: {next}
          <Scribble kind="underline" className="absolute left-0 -bottom-1 w-full h-2 text-amber-500/60" />
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-4 flex items-center gap-2"><Film size={13} /> Ticket stubs</h2>
        {!watches.length ? (
          <p className="text-stone-500 text-sm">Your first movie night together will print a stub here.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((s, i) => (
              <li key={s.id} style={{ rotate: `${(i % 3) - 1}deg` }}>
                <div className="ticket coupon-common rounded-[14px] flex items-stretch min-h-[64px] [--stub:84px] shadow-[0_10px_24px_-14px_rgb(0_0_0/0.6)]">
                  <div className="w-[84px] shrink-0 grid place-items-center border-r border-dashed border-[#2b2620]/25 px-2 text-center">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#6e655a]">{new Date(s.when).toLocaleDateString('en-US', { month: 'short' })}</p>
                    <p className="font-serif text-2xl leading-none">{new Date(s.when).getDate()}</p>
                  </div>
                  <div className="min-w-0 flex-1 px-4 py-3">
                    <p className="font-serif text-lg leading-tight truncate">{s.title}</p>
                    <p className="text-xs text-[#6e655a] mt-0.5">Admit two · {duration(s.seconds)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {plus && talkMonths.size > 0 && (
        <section className="mt-10">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-4 flex items-center gap-2"><MessagesSquare size={13} /> Pressed from your talks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...talkMonths].map(([month, ts], i) => (
              <div key={month} className="paper rounded-md p-4 text-center" style={{ rotate: `${(i % 2 ? 1.5 : -1.5)}deg` }}>
                <p className="text-3xl" aria-hidden>{['🌸', '🌼', '🌿', '🍂', '🌷', '🍁'][i % 6]}</p>
                <p className="font-hand text-xl mt-1">{new Date(month + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                <p className="text-xs text-[var(--paper-muted)]">{ts.length} talk{ts.length === 1 ? '' : 's'} · {duration(ts.reduce((n, t) => n + t.seconds, 0))}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!plus && stubs.length > 0 && (
        <Link href="/plus" className="mt-8 block paper rounded-xl p-5 hover:-rotate-[0.5deg] transition-transform">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--paper-muted)]"><Sparkles size={12} /> Hiranda Plus</p>
          <p className="font-serif text-xl mt-1">Keep every stub</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">Plus keeps all {stubs.length} of your nights and talks as a collection, ticket stubs and pressed flowers.</p>
        </Link>
      )}

      <WhyItWorks source="Hall, 2018" className="mt-10">
        Closeness is built from time. People who spent about 200 hours together became close friends.
      </WhyItWorks>
    </div>
  )
}
