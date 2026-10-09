import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { archiveItem, isArchiveId, searchArchive } from '@/theater/catalog/archive'
import { tmdbDetails } from '@/theater/catalog/tmdb'
import type { TitleDetails } from '@/theater/catalog/types'
import { Group, PlayHereButton, ServiceGroups, TrailerButton, YouTubeLinkForm } from './start-buttons'
import { InkUnderline } from '../../../discover'

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

async function load(kind: string, id: string, region: string): Promise<(TitleDetails & { archiveId: string | null }) | null> {
  if (kind === 'archive') {
    if (!isArchiveId(id)) return null
    const item = await archiveItem(id)
    if (!item) return null
    return {
      kind: 'archive', id, title: item.title, year: item.year, poster: item.poster, backdrop: null,
      overview: item.overview, runtime: null, genres: [], imdbId: null, trailerYouTubeId: null,
      playableUrl: item.url, options: [], justWatchLink: null, archiveId: item.url ? id : null,
    }
  }
  if (kind !== 'movie' && kind !== 'tv') return null
  const d = await tmdbDetails(kind, id, region)
  if (!d) return null
  // Old enough to be public domain? Look for a free copy we can play in sync.
  let archiveId: string | null = null
  if (kind === 'movie' && d.year && d.year < 1970) {
    const hits = await searchArchive(d.title, 5)
    const hit = hits.find(h => norm(h.title) === norm(d.title) && (!h.year || Math.abs(h.year - d.year!) <= 1))
    if (hit) archiveId = hit.id
  }
  return { ...d, archiveId }
}

export default async function TitlePage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const region = ((await headers()).get('x-vercel-ip-country') ?? 'US').toUpperCase()
  const t = await load(kind, id, region)
  if (!t) notFound()

  const onYouTube = t.options.some(o => o.platform === 'youtube')
  const meta = [t.year, t.runtime ? `${Math.floor(t.runtime / 60) ? `${Math.floor(t.runtime / 60)}h ` : ''}${t.runtime % 60}m` : null, ...t.genres].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen pb-16">
      {/* Backdrop */}
      <div className="relative h-56 md:h-80 overflow-hidden">
        {(t.backdrop ?? t.poster) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(t.backdrop ?? t.poster)!} alt="" className={`h-full w-full object-cover ${t.backdrop ? '' : 'blur-2xl scale-110 opacity-60'}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/40 via-stone-950/30 to-stone-950" />
        <Link href="/watch" aria-label="Back to the Theater"
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+0.75rem)] grid place-items-center h-10 w-10 rounded-full bg-black/50 backdrop-blur text-stone-100 hover:bg-black/70 transition-colors">
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 -mt-28 relative flex flex-col gap-8">
        <div className="flex gap-4 items-end">
          {t.poster && (
            <div className="polaroid !p-1.5 !pb-1.5 shrink-0 -rotate-2">
              <span className="tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg] !w-16" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.poster} alt="" className="w-28 md:w-36 aspect-[2/3] object-cover rounded-[2px]" />
            </div>
          )}
          <div className="min-w-0 pb-1">
            <h1 className="font-serif text-3xl md:text-4xl text-amber-50 leading-[1.05]">{t.title}</h1>
            {meta && <p className="text-stone-400 text-sm mt-1.5">{meta}</p>}
          </div>
        </div>

        {t.overview && <p className="text-stone-300 text-[15px] leading-relaxed">{t.overview}</p>}

        {/* ── Watch together ── */}
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl text-amber-50 relative self-start">
            Watch together
            <InkUnderline className="absolute left-0 -bottom-1.5 w-full h-2 text-amber-500/60" />
          </h2>

          {(t.archiveId || t.trailerYouTubeId || onYouTube) && (
            <Group mode="here">
              {t.archiveId && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-stone-300 text-sm">Free public-domain copy from the Internet Archive.</p>
                  <PlayHereButton archiveId={t.archiveId} />
                </div>
              )}
              {onYouTube && (
                <div className="flex flex-col gap-2">
                  <p className="text-stone-300 text-sm">On YouTube? Paste its link and it plays here, in sync.</p>
                  <YouTubeLinkForm title={t.title} poster={t.poster} />
                </div>
              )}
              {t.trailerYouTubeId && <TrailerButton youTubeId={t.trailerYouTubeId} title={t.title} poster={t.poster} />}
            </Group>
          )}

          <ServiceGroups options={t.options.filter(o => o.mode !== 'here')} title={t.title} poster={t.poster} />

          {t.kind !== 'archive' && !t.options.length && !t.archiveId && (
            <p className="text-stone-500 text-sm rounded-2xl border border-stone-800 p-4">
              We couldn’t find where this streams in your region. You can still start a session from a link or file on the Theater page.
            </p>
          )}

          {t.kind !== 'archive' && (
            <p className="text-stone-600 text-[11px] leading-relaxed">
              Where-to-watch data by JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.
              {t.justWatchLink && <> <a href={t.justWatchLink} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-stone-400">More options</a></>}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
