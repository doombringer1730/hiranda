'use client'

import { useEffect, useRef, useState } from 'react'
import { createWatchSession } from './actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, Film, Plus, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type WatchSession = { id: string; title: string; created_at: string }

export default function WatchPage() {
  const [sessions, setSessions] = useState<WatchSession[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('watch_sessions')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSessions(data ?? []))
  }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setUploading(false); return }

    const ext = file.name.split('.').pop() ?? 'mp4'
    const path = `${user.id}/${Date.now()}.${ext}`

    // Upload directly from browser — no server size limit
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const result = await createWatchSession(title.trim(), path)
    if ('error' in result) {
      setError(result.error ?? 'Something went wrong')
      setUploading(false)
      return
    }

    router.push(`/watch/${result.sessionId}`)
  }

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Watch Together</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Upload'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-8 flex flex-col gap-4">
          <h3 className="font-serif text-lg text-amber-200">Upload a movie</h3>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{error}</p>
          )}

          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Movie title"
          />

          <input
            ref={fileRef}
            type="file"
            required
            accept="video/mp4,video/quicktime,video/mov,video/avi,video/mkv,video/webm,video/x-matroska"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer"
          />

          {file && (
            <p className="text-stone-500 text-xs -mt-2">
              {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || !file || !title.trim()}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
          >
            {uploading
              ? <><Loader2 size={16} className="animate-spin" /> Uploading…</>
              : 'Upload & watch'}
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
