'use client'

import { useState } from 'react'
import { createMemory } from '../actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, X, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Location = { lat: number; lng: number; name: string }

export default function NewMemoryPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [happenedAt, setHappenedAt] = useState(new Date().toISOString().split('T')[0])
  const [tags, setTags] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [location, setLocation] = useState<Location | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleAddLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const addr = data.address ?? {}
          const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? ''
          const country = addr.country ?? ''
          const name = [city, country].filter(Boolean).join(', ') || (data.display_name?.split(',')[0] ?? 'Unknown location')
          setLocation({ lat, lng, name })
        } catch {
          setLocation({ lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
        }
        setLocating(false)
      },
      () => setLocating(false)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    // Upload photos directly from browser
    const photoPaths: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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

    const result = await createMemory({
      title: title.trim(),
      body: body.trim(),
      happenedAt,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      photoPaths,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      locationName: location?.name ?? null,
    })

    if ('error' in result) {
      setError(result.error ?? 'Something went wrong')
      setSaving(false)
      return
    }

    router.push(`/memories/${result.memoryId}`)
  }

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="font-serif text-3xl text-amber-100">New memory</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="What happened?"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Date</label>
          <input
            type="date"
            required
            value={happenedAt}
            onChange={e => setHappenedAt(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Notes</label>
          <textarea
            rows={5}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none"
            placeholder="Tell the story…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="date night, travel, silly — comma separated"
          />
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Location</label>
          {location ? (
            <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
              <MapPin size={14} className="text-amber-600 flex-shrink-0" />
              <span className="text-amber-50 text-sm flex-1">{location.name}</span>
              <button type="button" onClick={() => setLocation(null)} className="text-stone-500 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddLocation}
              disabled={locating}
              className="flex items-center gap-2 text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
            >
              {locating ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              {locating ? 'Getting location…' : 'Add location'}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-stone-400 text-xs uppercase tracking-widest">Photos</label>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp,image/tiff,video/mp4,video/quicktime,video/mov,video/avi,video/mkv,video/webm"
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
          disabled={saving || !title.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors mt-2 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save memory'}
        </button>
      </form>
    </div>
  )
}
