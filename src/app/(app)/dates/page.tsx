import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { deleteDate } from './actions'
import PageHeader from '@/components/page-header'
import { Scribble } from '@/components/handmade'
import { EmptyState, primaryButton } from '@/components/ui'
import SponsorCard from '@/components/sponsor-card'

type DateRow = {
  id: string
  label: string
  date: string
  recurring: boolean
  note: string | null
}

function daysUntil(dateStr: string, recurring: boolean): number {
  const now = new Date()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const d = new Date(dateStr + 'T00:00:00Z')

  if (recurring) {
    let next = Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    if (next < todayUTC) {
      next = Date.UTC(now.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate())
    }
    return Math.round((next - todayUTC) / 86400000)
  } else {
    const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    return Math.round((target - todayUTC) / 86400000)
  }
}

function formatDate(dateStr: string, recurring: boolean): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  if (recurring) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function inWords(days: number) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 0) return `${Math.abs(days)} days ago`
  return `in ${days} days`
}

export default async function DatesPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('important_dates')
    .select('id, label, date, recurring, note')
    .order('date', { ascending: true })

  const dates = (rows ?? [])
    .map(row => ({ ...row, days: daysUntil(row.date, row.recurring) }))
    .sort((a, b) => (a.days < 0 ? 1e6 - a.days : a.days) - (b.days < 0 ? 1e6 - b.days : b.days))
  const [next, ...rest] = dates
  const nextOn = next ? new Date(Date.now() + next.days * 86_400_000) : null

  return (
    <div className="px-4 pt-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="The ones that matter" title="Dates" />
        <Link href="/dates/new" className={primaryButton}><Plus size={16} /> Add</Link>
      </div>
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-8">the days worth counting down to.</p>

      {dates.length === 0 && (
        <EmptyState title="No dates saved yet." sub="Birthdays, anniversaries, the next time you see each other — add one and we’ll count down with you." href="/dates/new" action="Add a date" />
      )}

      {/* The next one, as a tear-off calendar page */}
      {next && nextOn && (
        <div className="flex items-center gap-5 mb-10 animate-rise">
          <div className="w-[118px] shrink-0 rounded-[14px] overflow-hidden rotate-[-3deg] shadow-[0_14px_30px_-12px_rgb(0_0_0/0.6)]">
            <div className="bg-amber-700 text-amber-50 text-center text-[11px] font-bold uppercase tracking-[0.2em] py-1.5">
              {nextOn.toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div className="paper text-center py-3 !shadow-none">
              <p className="font-serif text-[56px] leading-none text-[var(--paper-ink)]">{nextOn.getDate()}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--paper-muted)] mt-1">{nextOn.toLocaleDateString('en-US', { weekday: 'short' })}</p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-serif text-[44px] leading-none text-amber-50">
              {next.days === 0 ? 'Today!' : next.days > 0 ? <>{next.days}<span className="text-stone-400 text-lg font-sans ml-1.5">{next.days === 1 ? 'day' : 'days'}</span></> : 'Passed'}
            </p>
            <p className="relative inline-block font-hand text-[24px] text-amber-200 mt-1.5">
              {next.label}
              <Scribble kind="underline" className="absolute left-0 -bottom-1 h-2 w-full text-amber-500/60" />
            </p>
            {next.note && <p className="text-stone-400 text-sm mt-2">{next.note}</p>}
            <form action={deleteDate.bind(null, next.id)} className="mt-2">
              <button type="submit" className="text-stone-500 hover:text-red-400 text-xs">remove</button>
            </form>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="flex flex-col gap-3">
          {rest.map(({ id, label, date, recurring, note, days }, i) => {
            const d = new Date(date + 'T00:00:00Z')
            return (
              <div key={id} className="group relative animate-rise" style={{ '--i': i + 1 } as React.CSSProperties}>
                <div className="ticket tile flex items-stretch min-h-[84px]">
                  <div className="w-[92px] shrink-0 flex flex-col items-center justify-center border-r-2 border-dashed border-stone-700/70">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">{d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</p>
                    <p className="font-serif text-[34px] leading-none text-amber-50">{d.getUTCDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
                    <p className="text-amber-50 text-[15px] font-medium leading-snug">{label}</p>
                    <p className="text-stone-400 text-xs mt-0.5">
                      {inWords(days)} · {formatDate(date, recurring)}{recurring ? ' · yearly' : ''}
                    </p>
                    {note && <p className="font-hand text-[19px] text-amber-200/90 mt-1 leading-tight">{note}</p>}
                  </div>
                </div>
                <form action={deleteDate.bind(null, id)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button type="submit" aria-label={`Remove ${label}`} className="grid place-items-center h-9 w-9 rounded-full text-stone-500 hover:text-red-400"><X size={15} /></button>
                </form>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-8"><SponsorCard place="dates" /></div>
    </div>
  )
}
