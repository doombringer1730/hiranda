import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, CalendarHeart, Trash2 } from 'lucide-react'
import { deleteDate } from './actions'

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

function CountdownLabel({ days }: { days: number }) {
  if (days === 0) return <span className="text-amber-400 text-4xl font-serif">Today</span>
  if (days < 0) return (
    <span className="text-stone-400 text-4xl font-serif">{Math.abs(days)}<span className="text-lg ml-1">days ago</span></span>
  )
  return (
    <span className="text-amber-100 text-4xl font-serif">{days}<span className="text-stone-400 text-lg ml-1.5">days</span></span>
  )
}

export default async function DatesPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('important_dates')
    .select('id, label, date, recurring, note')
    .order('date', { ascending: true })

  const dates = (rows ?? [])
    .map(row => ({ ...row, days: daysUntil(row.date, row.recurring) }))
    .sort((a, b) => a.days - b.days)

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Dates</h2>
        <Link
          href="/dates/new"
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add date
        </Link>
      </div>

      {dates.length === 0 && (
        <div className="text-center py-24">
          <CalendarHeart size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No dates saved yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {dates.map(({ id, label, date, recurring, note, days }) => (
          <div key={id} className="group bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center gap-5">
            <div className="w-24 flex-shrink-0 text-center">
              <CountdownLabel days={days} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-amber-100 font-medium leading-snug">{label}</p>
              <p className="text-stone-500 text-sm mt-0.5">
                {formatDate(date, recurring)}
                {recurring && <span className="text-stone-600"> · yearly</span>}
              </p>
              {note && <p className="text-stone-400 text-sm mt-1.5 italic">{note}</p>}
            </div>

            <form action={deleteDate.bind(null, id)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-1">
                <Trash2 size={16} />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
