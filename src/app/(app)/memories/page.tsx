import { createClient } from '@/lib/supabase/server'
import { getPeople } from '@/lib/profiles'
import Link from 'next/link'
import { Plus, Map, BookOpen, Hourglass } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { Polaroid } from '@/components/handmade'
import { EmptyState, PersonChip, primaryButton, iconButton } from '@/components/ui'

type Memory = {
  id: string
  title: string
  body: string | null
  happened_at: string
  created_by: string
  tags: string[] | null
  photos: { id: string; storage_path: string }[] | null
}

const TILTS = [-2.4, 1.6, -1, 2.2, -1.8, 1]

// A wall of polaroids: the photos lead, because they're what you come back
// for. Memories without a photo are pinned up as paper notes.
export default async function MemoriesPage() {
  const supabase = await createClient()

  const [{ data }, people] = await Promise.all([
    supabase.from('memories').select('id, title, body, happened_at, created_by, tags, photos(id, storage_path)')
      .order('happened_at', { ascending: false }).limit(60),
    getPeople(),
  ])
  const memories = (data ?? []) as Memory[]

  const covers = memories.map(m => m.photos?.[0]?.storage_path).filter((p): p is string => !!p)
  const signed = new globalThis.Map<string, string>()
  if (covers.length) {
    const { data: urls } = await supabase.storage.from('photos').createSignedUrls(covers, 3600)
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
  }

  const now = new Date()
  const onThisDay = (d: string) => {
    const [y, mo, da] = d.split('-').map(Number)
    return mo === now.getMonth() + 1 && da === now.getDate() && y < now.getFullYear()
  }
  const when = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl md:max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="The good stuff" title="Memories" />
        <div className="flex items-center gap-2">
          <Link href="/month" aria-label="Our month" title="Our month" className={iconButton}><BookOpen size={17} /></Link>
          <Link href="/together" aria-label="Hours together" title="Hours together" className={iconButton}><Hourglass size={17} /></Link>
          <Link href="/memories/map" aria-label="Map of memories" className={iconButton}><Map size={17} /></Link>
          <Link href="/memories/new" className={primaryButton}><Plus size={16} /> New</Link>
        </div>
      </div>
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-8">
        {memories.length ? `${memories.length} little moments, pinned up.` : 'the wall is waiting.'}
      </p>

      {!memories.length ? (
        <EmptyState title="Pin your first memory." sub="A photo, a date, a sentence about why it mattered — that’s all it takes." href="/memories/new" action="Add a memory" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-7">
          {memories.map((m, i) => {
            const cover = m.photos?.[0] ? signed.get(m.photos[0].storage_path) ?? null : null
            const flashback = onThisDay(m.happened_at)
            const tilt = TILTS[i % TILTS.length]
            return (
              <Link key={m.id} href={`/memories/${m.id}`} className="relative block animate-rise" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
                {flashback && (
                  <span className="absolute -top-2 -right-1 z-10 rotate-6 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold uppercase tracking-wider px-2 py-1 shadow">on this day</span>
                )}
                {cover || m.photos?.length ? (
                  <Polaroid src={cover} caption={m.title} sub={when(m.happened_at)} tilt={tilt} tape={i % 3 === 0} />
                ) : (
                  <div className="paper rounded-[3px] px-3.5 pt-4 pb-3 min-h-[150px] flex flex-col" style={{ rotate: `${tilt}deg` }}>
                    {i % 3 === 0 && <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-3" />}
                    <p className="font-hand text-[23px] leading-[1.05] text-[var(--paper-ink)]">{m.title}</p>
                    {m.body && <p className="text-[13px] leading-snug text-[var(--paper-muted)] mt-2 line-clamp-3">{m.body}</p>}
                    <p className="mt-auto pt-2 text-[10px] uppercase tracking-[0.18em] text-[#8a7f70]">{when(m.happened_at)}</p>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-2.5 px-1 text-stone-500 text-[11px]">
                  <PersonChip person={people.get(m.created_by)} size={16} />
                  {(m.photos?.length ?? 0) > 1 && <span>{m.photos!.length} photos</span>}
                  {m.tags?.slice(0, 2).map(t => <span key={t} className="truncate">#{t}</span>)}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
