'use client'

import { useState } from 'react'
import { addDate } from '../actions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewDatePage() {
  const [recurring, setRecurring] = useState(true)

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dates" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="font-serif text-3xl text-amber-100">Add a date</h2>
      </div>

      <form action={addDate} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Label</label>
          <input
            name="label"
            type="text"
            required
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Our anniversary, your birthday…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Date</label>
          <input
            name="date"
            type="date"
            required
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
          <div>
            <p className="text-amber-50 text-sm">Repeats yearly</p>
            <p className="text-stone-500 text-xs mt-0.5">Countdown resets each year</p>
          </div>
          <button
            type="button"
            onClick={() => setRecurring(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              recurring ? 'bg-amber-700' : 'bg-stone-700'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              recurring ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
          <input type="hidden" name="recurring" value={recurring ? 'on' : 'off'} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Note <span className="normal-case text-stone-600">(optional)</span></label>
          <textarea
            name="note"
            rows={3}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none"
            placeholder="A little note about this date…"
          />
        </div>

        <button
          type="submit"
          className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors mt-2"
        >
          Save date
        </button>
      </form>
    </div>
  )
}
