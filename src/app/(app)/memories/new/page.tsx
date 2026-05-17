'use client'

import { useActionState } from 'react'
import { createMemory } from '../actions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewMemoryPage() {
  const [state, formAction, pending] = useActionState(createMemory, null)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="font-serif text-3xl text-amber-100">New memory</h2>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        {state?.error && (
          <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{state.error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="What happened?"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="happened_at">Date</label>
          <input
            id="happened_at"
            name="happened_at"
            type="date"
            required
            defaultValue={today}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="body">Notes</label>
          <textarea
            id="body"
            name="body"
            rows={5}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none"
            placeholder="Tell the story…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            type="text"
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="date night, travel, silly — comma separated"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="photos">Photos</label>
          <input
            id="photos"
            name="photos"
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp,image/tiff,video/mp4,video/quicktime,video/mov,video/avi,video/mkv,video/webm"
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors mt-2"
        >
          {pending ? 'Saving…' : 'Save memory'}
        </button>
      </form>
    </div>
  )
}
