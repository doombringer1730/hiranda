import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { deleteEntry, deleteJournalPhoto } from '../actions'

const MOOD_LABELS: Record<string, string> = {
  happy: 'Happy',
  loved: 'Loved',
  grateful: 'Grateful',
  calm: 'Calm',
  anxious: 'Anxious',
  sad: 'Sad',
  angry: 'Angry',
  excited: 'Excited',
}

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: entry } = await supabase
    .from('journal_entries')
    .select('*, journal_photos(*)')
    .eq('id', id)
    .single()

  if (!entry) notFound()

  const photosWithUrls = await Promise.all(
    (entry.journal_photos ?? []).map(async (photo: { id: string; storage_path: string }) => {
      const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 3600)
      return { ...photo, url: data?.signedUrl ?? null }
    })
  )

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <Link href="/journal" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <form action={deleteEntry.bind(null, id)}>
          <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-2">
            <Trash2 size={18} />
          </button>
        </form>
      </div>

      <p className="text-stone-500 text-sm mb-3">
        {new Date(entry.created_at).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })}
      </p>

      {entry.mood && (
        <span className="inline-block text-xs bg-amber-900/40 text-amber-400 px-2.5 py-0.5 rounded-full mb-4">
          {MOOD_LABELS[entry.mood] ?? entry.mood}
        </span>
      )}

      {entry.title && (
        <h1 className="font-serif text-4xl text-amber-100 mb-6">{entry.title}</h1>
      )}

      {entry.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {entry.tags.map((tag: string) => (
            <span key={tag} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-stone-300 leading-relaxed whitespace-pre-wrap">{entry.body}</p>

      {photosWithUrls.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-amber-200 mb-4">Photos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photosWithUrls.map((photo) =>
              photo.url ? (
                <div key={photo.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                  <form
                    action={deleteJournalPhoto.bind(null, photo.id, photo.storage_path, id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      type="submit"
                      className="bg-black/60 text-red-400 rounded-lg p-1.5 hover:bg-black/80 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  )
}
