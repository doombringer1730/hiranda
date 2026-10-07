import { createClient } from '@/lib/supabase/server'
import { getPeople } from '@/lib/profiles'
import Link from 'next/link'
import { Plus, Camera } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { EmptyState, PersonChip, primaryButton } from '@/components/ui'

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

// Entries read as letters passed back and forth: yours on the right,
// your partner's on the left.
export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: entries }, people] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('*, journal_photos(id)')
      .order('created_at', { ascending: false })
      .limit(40),
    getPeople(),
  ])

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="Words for each other" title="Journal" />
        <Link href="/journal/new" className={primaryButton}><Plus size={16} /> Write</Link>
      </div>
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-8">the long version of how your day went.</p>

      {!entries?.length && (
        <EmptyState title="Nothing written yet." sub="A few lines about today — what happened, how it felt. Your partner will see it here." href="/journal/new" action="Write the first entry" />
      )}

      <div className="flex flex-col gap-6">
        {entries?.map((entry, i) => {
          const mine = entry.created_by === user?.id
          const mood = entry.mood ? (MOOD_LABELS[entry.mood] ?? entry.mood) : null
          return (
            <Link
              key={entry.id}
              href={`/journal/${entry.id}`}
              className={`group block w-[88%] animate-rise ${mine ? 'self-end' : 'self-start'}`}
              style={{ '--i': Math.min(i, 8), rotate: `${mine ? 0.6 : -0.6}deg` } as React.CSSProperties}
            >
              <article className="paper rounded-[5px] px-5 pt-5 pb-4 transition-transform duration-300 group-hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[var(--paper-muted)] text-xs">
                    {new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  {mood && <span className="text-xs text-[var(--paper-muted)]">{mood}</span>}
                </div>
                {entry.title && <h3 className="font-serif text-[23px] leading-tight text-[var(--paper-ink)] mb-1.5">{entry.title}</h3>}
                <p className="font-serif text-[16px] text-[var(--paper-ink)]/80 line-clamp-3 leading-relaxed">{entry.body}</p>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-[var(--paper-muted)]">
                  <PersonChip person={people.get(entry.created_by)} size={18} withName />
                  {entry.journal_photos?.length > 0 && <span className="flex items-center gap-1"><Camera size={11} /> {entry.journal_photos.length}</span>}
                  {entry.tags?.slice(0, 3).map((t: string) => <span key={t}>#{t}</span>)}
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
