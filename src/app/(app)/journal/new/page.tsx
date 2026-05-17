'use client'

import { useState } from 'react'
import { createEntry } from '../actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MOODS = [
  { value: 'happy',    label: 'Happy'    },
  { value: 'loved',    label: 'Loved'    },
  { value: 'grateful', label: 'Grateful' },
  { value: 'excited',  label: 'Excited'  },
  { value: 'calm',     label: 'Calm'     },
  { value: 'anxious',  label: 'Anxious'  },
  { value: 'sad',      label: 'Sad'      },
  { value: 'angry',    label: 'Angry'    },
]

export default function NewEntryPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [tags, setTags] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const photoPaths: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `journal/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, file, { contentType: file.type })
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`)
        setSaving(false)
        return
      }
      photoPaths.push(path)
    }

    const result = await createEntry({
      title: title.trim(),
      body: body.trim(),
      mood,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      photoPaths,
    })

    if ('error' in result) {
      setError(result.error ?? 'Something went wrong')
      setSaving(false)
      return
    }

    router.push(`/journal/${result.entryId}`)
  }

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/journal" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="font-serif text-3xl text-amber-100">New entry</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">How are you feeling?</label>
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(mood === m.value ? null : m.value)}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                  mood === m.value
                    ? 'bg-amber-700 border-amber-600 text-amber-50'
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Title <span className="normal-case text-stone-600">(optional)</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Give this entry a name…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Entry</label>
          <textarea
            required
            rows={10}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none leading-relaxed"
            placeholder="Write whatever's on your mind…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="reflection, growth, love — comma separated"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Photos</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer"
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-stone-800 rounded-lg px-2.5 py-1">
                  <span className="text-stone-300 text-xs truncate max-w-[120px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-stone-500 hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors mt-2 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save entry'}
        </button>
      </form>
    </div>
  )
}
