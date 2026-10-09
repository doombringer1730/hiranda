import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { hasPlus } from '@/lib/plus'
import { weatherFor } from '@/lib/closeness'
import PageHeader from '@/components/page-header'
import WhyItWorks from '@/components/why-it-works'
import CheckinButtons from './checkin-buttons'

export const metadata = { title: 'Closeness · Hiranda' }

// Your closeness over time, as weather. Only you can see this page's contents:
// the check-ins are yours alone (enforced in the database, not just here).
export default async function ClosenessPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const [{ data: rows }, people, plus] = await Promise.all([
    ctx.supabase.from('closeness_checkins').select('id, score, created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(48),
    getPeople(),
    hasPlus(),
  ])
  const checkins = rows ?? []
  const latest = checkins[0] ?? null
  const partnerName = people.get(ctx.partnerId)?.first ?? 'your partner'
  // Oldest first, as a line of weather across the seasons.
  const history = [...checkins].reverse()

  return (
    <div className="px-4 pt-6 pb-12 max-w-xl mx-auto">
      <PageHeader eyebrow="Just for you" title="Closeness" />
      <p className="text-stone-400 text-sm mt-2">About once a month, Hiranda asks how close you’ve felt. Only you ever see your answers; {partnerName} doesn’t, and neither does anyone else.</p>

      {latest && (
        <div className="mt-8 flex items-center gap-4">
          <span className="text-5xl" aria-hidden>{weatherFor(latest.score).emoji}</span>
          <div>
            <p className="font-hand text-[26px] leading-tight text-amber-100">last time: {weatherFor(latest.score).word}</p>
            <p className="text-stone-500 text-xs">{new Date(latest.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      )}

      {plus && history.length > 1 && (
        <section className="mt-10">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-4">Across the seasons</h2>
          <ol className="flex items-end gap-2 overflow-x-auto pb-2">
            {history.map(c => {
              const w = weatherFor(c.score)
              return (
                <li key={c.id} className="flex flex-col items-center gap-1 shrink-0" title={`${w.word}, ${new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}>
                  <span className="text-2xl" style={{ marginBottom: `${(c.score - 1) * 6}px` }} aria-label={w.word}>{w.emoji}</span>
                  <span className="text-[10px] text-stone-500">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                </li>
              )
            })}
          </ol>
          <p className="text-stone-500 text-xs mt-2">Every relationship has weather. A cloudy month is information, not a grade.</p>
        </section>
      )}

      {!plus && checkins.length > 0 && (
        <Link href="/plus" className="mt-10 block tile p-5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-stone-400"><Sparkles size={12} /> Hiranda Plus</p>
          <p className="font-serif text-xl text-amber-50 mt-1">See your seasons</p>
          <p className="text-sm text-stone-400 mt-1">Plus keeps every check-in as a line of weather across the months, so you can see what helped. Still just for you.</p>
        </Link>
      )}

      <section className="paper rounded-[8px] px-5 py-4 mt-10 -rotate-[0.3deg]">
        <CheckinButtons partnerName={partnerName} />
      </section>

      <WhyItWorks className="mt-10" source="Córdova et al., 2014">
        Couples who did a regular relationship check-up felt closer and more satisfied over the next two years. Noticing drift early is when it’s easiest to turn back toward each other.
      </WhyItWorks>
    </div>
  )
}
