import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { searchArchive } from '@/theater/catalog/archive'
import { hasTmdb, searchTmdb } from '@/theater/catalog/tmdb'
import { hasYouTube, ytSearch, ytTitle, type YtVideo } from '@/theater/catalog/youtube'
import { youTubeId, youTubeThumb } from '@/theater/youtube'
import { PosterGrid, SearchBar } from '../discover'
import { VideoCard, VideoGrid } from '../youtube-browse'

export default async function TheaterSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim().slice(0, 100)
  // A pasted YouTube link is a video, not a search.
  const linked = youTubeId(q)
  const linkedTitle = linked ? (await ytTitle(linked)) ?? 'YouTube video' : ''
  const [titles, classics, videos] = q && !linked
    ? await Promise.all([searchTmdb(q), searchArchive(q), hasYouTube() ? ytSearch(q) : []])
    : [[], [], [] as YtVideo[]]

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-16 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/watch" aria-label="Back to the Theater" className="text-stone-500 hover:text-amber-400 transition-colors"><ArrowLeft size={20} /></Link>
        <div className="flex-1"><SearchBar defaultValue={q} autoFocus={!q} /></div>
      </div>

      {linked && (
        <section className="flex flex-col gap-3 max-w-sm">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Your link · plays here in sync</h2>
          <VideoCard video={{ id: linked, title: linkedTitle, channel: 'YouTube', thumb: youTubeThumb(linked), duration: null, live: false }} />
        </section>
      )}

      {q && !linked && !titles.length && !classics.length && !videos.length && (
        <p className="text-stone-500 text-sm text-center py-16">Nothing found for “{q}”.</p>
      )}

      {videos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">YouTube · plays here in sync</h2>
          <VideoGrid videos={videos.slice(0, 8)} />
        </section>
      )}

      {titles.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Movies &amp; shows</h2>
          <PosterGrid items={titles} />
        </section>
      )}

      {classics.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Free public-domain films · play here in sync</h2>
          <PosterGrid items={classics} badgeFor={() => 'In sync'} />
        </section>
      )}

      {q && !hasTmdb() && (
        <p className="text-stone-600 text-xs">Only the free film archive is searchable until a TMDB key is added.</p>
      )}
    </div>
  )
}
