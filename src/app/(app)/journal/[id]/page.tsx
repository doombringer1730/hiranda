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

      {/* The entry reads like a letter: paper and ink in every theme. */}
      <article className="paper rounded-[6px] px-6 pt-9 pb-8 sm:px-9">
        <span className="tape -top-3 right-10 rotate-[4deg]" />
        <p className="text-[var(--paper-muted)] text-sm mb-3">
          {new Date(entry.created_at).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>

        {entry.mood && (
          <span className="inline-block text-xs bg-amber-700/15 text-amber-800 px-2.5 py-0.5 rounded-full mb-4">
            {MOOD_LABELS[entry.mood] ?? entry.mood}
          </span>
        )}

        {entry.title && (
          <h1 className="font-serif text-4xl text-[var(--paper-ink)] mb-6">{entry.title}</h1>
        )}

        {entry.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {entry.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-[rgb(43_38_32/0.07)] text-[var(--paper-muted)] px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="font-serif text-[19px] text-[var(--paper-ink)] leading-relaxed whitespace-pre-wrap">{entry.body}</p>
      </article>

      {photosWithUrls.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-amber-200 mb-5">Photos</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {photosWithUrls.map((photo, i) =>
              photo.url ? (
                <div key={photo.id} className="polaroid group pb-3" style={{ rotate: `${[-2.5, 1.8, -1, 2.4][i % 4]}deg` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-[2px]"
                  />
                  <form
                    action={deleteJournalPhoto.bind(null, photo.id, photo.storage_path, id)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
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
