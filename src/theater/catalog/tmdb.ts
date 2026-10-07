import 'server-only'
import type { CatalogItem, TitleDetails, WatchOption } from './types'
import { SERVICES } from './providers'

// Movie and TV metadata from TMDB, and where each title streams (TMDB's
// JustWatch data — attribution is shown wherever it's used).
// Accepts either a v3 API key or a v4 read-access token.
const KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || ''

export function hasTmdb() {
  return KEY.length > 0
}

const IMG = 'https://image.tmdb.org/t/p'
const img = (path: string | null | undefined, size: string) => (path ? `${IMG}/${size}${path}` : null)

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!KEY) return null
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const bearer = KEY.startsWith('eyJ')
  if (!bearer) url.searchParams.set('api_key', KEY)
  try {
    const res = await fetch(url, {
      headers: bearer ? { Authorization: `Bearer ${KEY}` } : undefined,
      next: { revalidate: 3600 },
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

type Result = {
  id: number; media_type?: string
  title?: string; name?: string
  release_date?: string; first_air_date?: string
  poster_path?: string | null
}

function toItem(r: Result, kind: 'movie' | 'tv'): CatalogItem {
  const date = kind === 'movie' ? r.release_date : r.first_air_date
  return { kind, id: String(r.id), title: r.title ?? r.name ?? 'Untitled', year: Number(date?.slice(0, 4)) || null, poster: img(r.poster_path, 'w342') }
}

const usable = (r: Result) => (r.media_type === 'movie' || r.media_type === 'tv') && !!r.poster_path

export async function trending(): Promise<CatalogItem[]> {
  const data = await tmdb<{ results: Result[] }>('/trending/all/week')
  return (data?.results ?? []).filter(usable).map(r => toItem(r, r.media_type as 'movie' | 'tv'))
}

export async function searchTmdb(query: string): Promise<CatalogItem[]> {
  const data = await tmdb<{ results: Result[] }>('/search/multi', { query, include_adult: 'false' })
  return (data?.results ?? []).filter(usable).map(r => toItem(r, r.media_type as 'movie' | 'tv'))
}

type Provider = { provider_id: number; provider_name: string; logo_path: string | null }
type Details = Result & {
  overview?: string; backdrop_path?: string | null
  runtime?: number; episode_run_time?: number[]
  genres?: { name: string }[]
  imdb_id?: string; external_ids?: { imdb_id?: string }
  videos?: { results: { site: string; type: string; key: string; official?: boolean }[] }
  'watch/providers'?: { results: Record<string, { link?: string } & Partial<Record<'flatrate' | 'free' | 'ads' | 'rent' | 'buy', Provider[]>>> }
}

const OFFERS = [['free', 'free'], ['ads', 'ads'], ['flatrate', 'subscription'], ['rent', 'rent'], ['buy', 'buy']] as const

export async function tmdbDetails(kind: 'movie' | 'tv', id: string, region: string): Promise<TitleDetails | null> {
  if (!/^\d{1,9}$/.test(id)) return null
  const d = await tmdb<Details>(`/${kind}/${id}`, { append_to_response: 'videos,watch/providers,external_ids' })
  if (!d) return null
  const base = toItem(d, kind)

  const where = d['watch/providers']?.results?.[region] ?? d['watch/providers']?.results?.US
  const options: WatchOption[] = []
  const seen = new Set<string>()
  for (const [field, offer] of OFFERS) {
    for (const p of where?.[field] ?? []) {
      const service = SERVICES[p.provider_id]
      const key = `${service?.platform ?? p.provider_id}:${offer === 'rent' || offer === 'buy' ? 'store' : 'watch'}`
      if (seen.has(key)) continue
      seen.add(key)
      options.push({
        provider: service?.label ?? p.provider_name,
        logo: img(p.logo_path, 'w92'),
        offer,
        mode: service?.mode ?? 'countdown',
        platform: service?.platform ?? p.provider_name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        url: service ? service.search(base.title) : (where?.link ?? `https://www.justwatch.com/us/search?q=${encodeURIComponent(base.title)}`),
      })
    }
  }

  const trailer = (d.videos?.results ?? []).find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
    ?? (d.videos?.results ?? []).find(v => v.site === 'YouTube' && v.type === 'Trailer')

  return {
    ...base,
    backdrop: img(d.backdrop_path, 'w1280'),
    overview: d.overview || null,
    runtime: d.runtime ?? d.episode_run_time?.[0] ?? null,
    genres: (d.genres ?? []).map(g => g.name).slice(0, 3),
    imdbId: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
    trailerYouTubeId: trailer?.key ?? null,
    playableUrl: null,
    options,
    justWatchLink: where?.link ?? null,
  }
}
