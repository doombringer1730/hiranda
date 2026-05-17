'use client'

import { useActionState, useEffect, useState } from 'react'
import { uploadMovie } from './actions'
import Link from 'next/link'
import { Play, Film, Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type WatchSession = { id: string; title: string; created_at: string }

export default function WatchPage() {
  const [state, formAction, pending] = useActionState(uploadMovie, null)
  const [sessions, setSessions] = useState<WatchSession[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('watch_sessions').select('id, title, created_at').order('created_at', { ascending: false })
      .then(({ data }) => setSessions(data ?? []))
  }, [])

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Watch Together</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} /> Upload
        </button>
      </div>

      {showForm && (
        <form action={formAction} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-8 flex flex-col gap-4">
          <h3 className="font-serif text-lg text-amber-200">Upload a movie</h3>
          {state?.error && (
            <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{state.error}</p>
          )}
          <input
            name="title"
            type="text"
            required
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Movie title"
          />
          <input
            name="video"
            type="file"
            required
            accept="video/*"
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
          >
            {pending ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Upload & watch'}
          </button>
        </form>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="text-center py-24">
          <Film size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No movies yet. Upload one to watch together.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/watch/${s.id}`}
            className="flex items-center gap-4 bg-stone-900 border border-stone-800 hover:border-amber-800/60 rounded-xl px-5 py-4 transition-colors group"
          >
            <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center flex-shrink-0">
              <Play size={18} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-100 group-hover:text-amber-300 transition-colors truncate">{s.title}</p>
              <p className="text-stone-500 text-xs mt-0.5">
                {new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
