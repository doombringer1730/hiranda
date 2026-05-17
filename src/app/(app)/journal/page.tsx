import { createClient } from '@/lib/supabase/server'
import { getProfileMap } from '@/lib/profiles'
import Link from 'next/link'
import { Plus, PenLine, Camera } from 'lucide-react'

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

export default async function JournalPage() {
  const supabase = await createClient()

  const [{ data: entries }, profiles] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('*, journal_photos(id)')
      .order('created_at', { ascending: false })
      .limit(40),
    getProfileMap(),
  ])

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Journal</h2>
        <Link
          href="/journal/new"
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} />
          New entry
        </Link>
      </div>

      {!entries?.length && (
        <div className="text-center py-24">
          <PenLine size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">Nothing written yet. Start your first entry.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {entries?.map((entry) => (
          <Link
            key={entry.id}
            href={`/journal/${entry.id}`}
            className="group bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden hover:border-amber-800/60 transition-colors"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-stone-500 text-sm">
                  {new Date(entry.created_at).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                  {profiles.get(entry.created_by) && (
                    <span className="text-stone-600"> · {profiles.get(entry.created_by)}</span>
                  )}
                </p>
                {entry.mood && (
                  <span className="text-xs bg-amber-900/40 text-amber-400 px-2.5 py-0.5 rounded-full flex-shrink-0">
                    {MOOD_LABELS[entry.mood] ?? entry.mood}
                  </span>
                )}
              </div>
              {entry.title && (
                <h3 className="font-serif text-xl text-amber-100 group-hover:text-amber-300 transition-colors mb-2">
                  {entry.title}
                </h3>
              )}
              <p className="text-stone-400 text-sm line-clamp-3 leading-relaxed">{entry.body}</p>
              {entry.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {entry.tags.map((tag: string) => (
                    <span key={tag} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {entry.journal_photos?.length > 0 && (
                <p className="text-stone-600 text-xs mt-3 flex items-center gap-1">
                  <Camera size={12} /> {entry.journal_photos.length} photo{entry.journal_photos.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
