'use client'

import { useState } from 'react'
import { Loader2, Film, Search, Settings, ChevronLeft, Tv } from 'lucide-react'
import Link from 'next/link'
import { createWatchSessionFromUrl } from './actions'
import { useRouter } from 'next/navigation'

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

type SearchType = 'movie' | 'tv'
type View = 'search' | 'seasons' | 'episodes' | 'streams'

type TmdbMovie = {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

type TmdbShow = {
  id: number
  name: string
  first_air_date: string
  poster_path: string | null
}

type TvSeason = {
  season_number: number
  episode_count: number
  name: string
  air_date: string | null
}

type TvEpisode = {
  episode_number: number
  name: string
}

type RdStream = {
  name: string
  title: string
  url: string
  behaviorHints?: { filename?: string; videoSize?: number }
}

type Props = { addonUrl: string }

export default function StremioAddonBrowser({ addonUrl }: Props) {
  const [searchType, setSearchType] = useState<SearchType>('movie')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('search')

  const [movieResults, setMovieResults] = useState<TmdbMovie[]>([])
  const [tvResults, setTvResults] = useState<TmdbShow[]>([])
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null)
  const [selectedShow, setSelectedShow] = useState<TmdbShow | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<TvSeason | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<TvEpisode | null>(null)
  const [seasons, setSeasons] = useState<TvSeason[]>([])
  const [episodes, setEpisodes] = useState<TvEpisode[]>([])
  const [streams, setStreams] = useState<RdStream[]>([])

  const [searching, setSearching] = useState(false)
  const [loadingSeasons, setLoadingSeasons] = useState(false)
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compatOnly, setCompatOnly] = useState(true)

  const router = useRouter()

  const INCOMPAT_AUDIO = /\b(AC3|DTS|TrueHD|EAC3|DDP|DD5\.1|Atmos)\b/i

  function isCompatible(stream: RdStream) {
    const filename = stream.behaviorHints?.filename ?? ''
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext && ext !== 'mp4') return false
    return !INCOMPAT_AUDIO.test(stream.name + ' ' + stream.title)
  }

  function getExt(stream: RdStream) {
    return stream.behaviorHints?.filename?.split('.').pop()?.toLowerCase() ?? ''
  }

  function parseQuality(name: string) {
    return name.split('\n')[1] ?? name.split('\n')[0] ?? 'Stream'
  }

  function formatSize(bytes?: number) {
    if (!bytes) return ''
    const gb = bytes / 1024 / 1024 / 1024
    return gb >= 1 ? ` · ${gb.toFixed(1)} GB` : ` · ${(bytes / 1024 / 1024).toFixed(0)} MB`
  }

  function pad(n: number) { return String(n).padStart(2, '0') }

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    setMovieResults([])
    setTvResults([])
    try {
      const endpoint = searchType === 'movie' ? 'search/movie' : 'search/tv'
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.status_message ?? `TMDB error ${res.status}`)
      if (searchType === 'movie') setMovieResults(data.results ?? [])
      else setTvResults(data.results ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectMovie(movie: TmdbMovie) {
    setSelectedMovie(movie)
    setLoadingStreams(true)
    setView('streams')
    setStreams([])
    setError(null)
    try {
      const extRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/external_ids?api_key=${TMDB_KEY}`)
      const extData = await extRes.json()
      const imdbId = extData.imdb_id as string | null
      if (!imdbId) throw new Error('No IMDB ID found')

      const streamRes = await fetch(`${addonUrl}/stream/movie/${imdbId}.json`)
      const streamData = await streamRes.json()
      setStreams((streamData.streams ?? []).filter((s: RdStream) => s.url?.startsWith('https://')))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load streams')
    } finally {
      setLoadingStreams(false)
    }
  }

  async function handleSelectShow(show: TmdbShow) {
    setSelectedShow(show)
    setLoadingSeasons(true)
    setView('seasons')
    setSeasons([])
    setError(null)
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${show.id}?api_key=${TMDB_KEY}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.status_message ?? `TMDB error ${res.status}`)
      const filtered = (data.seasons ?? []).filter((s: TvSeason) => s.season_number > 0)
      setSeasons(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load seasons')
    } finally {
      setLoadingSeasons(false)
    }
  }

  async function handleSelectSeason(season: TvSeason) {
    if (!selectedShow) return
    setSelectedSeason(season)
    setLoadingEpisodes(true)
    setView('episodes')
    setEpisodes([])
    setError(null)
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${selectedShow.id}/season/${season.season_number}?api_key=${TMDB_KEY}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.status_message ?? `TMDB error ${res.status}`)
      setEpisodes(data.episodes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load episodes')
    } finally {
      setLoadingEpisodes(false)
    }
  }

  async function handleSelectEpisode(episode: TvEpisode) {
    if (!selectedShow || !selectedSeason) return
    setSelectedEpisode(episode)
    setLoadingStreams(true)
    setView('streams')
    setStreams([])
    setError(null)
    try {
      const extRes = await fetch(`https://api.themoviedb.org/3/tv/${selectedShow.id}/external_ids?api_key=${TMDB_KEY}`)
      const extData = await extRes.json()
      const imdbId = extData.imdb_id as string | null
      if (!imdbId) throw new Error('No IMDB ID found')

      const streamRes = await fetch(
        `${addonUrl}/stream/series/${imdbId}:${selectedSeason.season_number}:${episode.episode_number}.json`
      )
      const streamData = await streamRes.json()
      setStreams((streamData.streams ?? []).filter((s: RdStream) => s.url?.startsWith('https://')))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load streams')
    } finally {
      setLoadingStreams(false)
    }
  }

  async function handleStartSession(stream: RdStream) {
    let title = ''
    if (selectedMovie) {
      title = selectedMovie.title
    } else if (selectedShow && selectedSeason && selectedEpisode) {
      title = `${selectedShow.name} S${pad(selectedSeason.season_number)}E${pad(selectedEpisode.episode_number)}`
    }
    setStarting(stream.url)
    const result = await createWatchSessionFromUrl(title, stream.url)
    if (result?.sessionId) {
      router.push(`/watch/${result.sessionId}`)
    } else {
      setStarting(null)
    }
  }

  // ── Streams view ──────────────────────────────────────────────────────────
  if (view === 'streams') {
    const backLabel = selectedMovie ? selectedMovie.title : selectedEpisode
      ? `S${pad(selectedSeason!.season_number)}E${pad(selectedEpisode.episode_number)}`
      : 'Back'
    const posterPath = selectedMovie?.poster_path ?? selectedShow?.poster_path
    const heading = selectedMovie?.title
      ?? (selectedShow && selectedSeason && selectedEpisode
        ? `${selectedShow.name} · S${pad(selectedSeason.season_number)}E${pad(selectedEpisode.episode_number)}`
        : '')
    const year = selectedMovie?.release_date?.slice(0, 4) ?? selectedShow?.first_air_date?.slice(0, 4)

    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => {
            if (selectedMovie) { setView('search'); setSelectedMovie(null) }
            else { setView('episodes') }
            setStreams([]); setError(null)
          }}
          className="flex items-center gap-1.5 text-stone-500 hover:text-amber-400 text-sm transition-colors self-start"
        >
          <ChevronLeft size={16} /> {backLabel}
        </button>

        <div className="flex items-center gap-3">
          {posterPath && (
            <img src={`https://image.tmdb.org/t/p/w92${posterPath}`} alt={heading}
              className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
          )}
          <div>
            <p className="text-amber-100 font-medium">{heading}</p>
            {year && <p className="text-stone-500 text-xs">{year}</p>}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loadingStreams && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-stone-600" /></div>}

        {!loadingStreams && streams.length > 0 && (
          <button type="button" onClick={() => setCompatOnly(v => !v)}
            className={`self-start flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              compatOnly ? 'bg-amber-900/30 border-amber-700/50 text-amber-400' : 'bg-stone-900 border-stone-700 text-stone-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${compatOnly ? 'bg-amber-400' : 'bg-stone-600'}`} />
            {compatOnly ? 'AAC / browser-safe only' : 'Showing all codecs'}
          </button>
        )}

        {!loadingStreams && streams.length === 0 && !error && (
          <p className="text-stone-500 text-sm text-center py-6">No cached streams found.</p>
        )}
        {!loadingStreams && streams.length > 0 && compatOnly && streams.filter(isCompatible).length === 0 && (
          <p className="text-stone-500 text-sm text-center py-4">No AAC streams found. Toggle the filter above to see all.</p>
        )}

        <div className="flex flex-col gap-2">
          {(compatOnly ? streams.filter(isCompatible) : streams).map((stream, i) => (
            <button key={i} onClick={() => handleStartSession(stream)} disabled={!!starting}
              className="flex items-center justify-between bg-stone-950 border border-stone-800 hover:border-amber-700/50 rounded-xl px-4 py-3 transition-colors disabled:opacity-50 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-amber-100 text-sm font-medium">{parseQuality(stream.name)}</p>
                  {getExt(stream) && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${
                      getExt(stream) === 'mp4' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                    }`}>{getExt(stream)}</span>
                  )}
                </div>
                <p className="text-stone-500 text-xs mt-0.5 truncate">
                  {stream.title?.split('\n')[0]}{formatSize(stream.behaviorHints?.videoSize)}
                </p>
              </div>
              {starting === stream.url
                ? <Loader2 size={16} className="animate-spin text-amber-500 flex-shrink-0 ml-3" />
                : <span className="text-amber-600 text-xs flex-shrink-0 ml-3">Watch →</span>}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Episodes view ─────────────────────────────────────────────────────────
  if (view === 'episodes' && selectedShow && selectedSeason) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => { setView('seasons'); setEpisodes([]); setSelectedEpisode(null); setError(null) }}
          className="flex items-center gap-1.5 text-stone-500 hover:text-amber-400 text-sm transition-colors self-start">
          <ChevronLeft size={16} /> {selectedShow.name}
        </button>
        <p className="text-amber-200 font-medium">{selectedSeason.name}</p>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loadingEpisodes && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-stone-600" /></div>}

        <div className="flex flex-col gap-1.5">
          {episodes.map(ep => (
            <button key={ep.episode_number} onClick={() => handleSelectEpisode(ep)}
              className="flex items-center gap-3 bg-stone-950 border border-stone-800 hover:border-amber-700/50 rounded-xl px-4 py-3 transition-colors text-left">
              <span className="text-stone-600 text-xs font-mono w-8 flex-shrink-0">E{pad(ep.episode_number)}</span>
              <span className="text-amber-100 text-sm truncate">{ep.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Seasons view ──────────────────────────────────────────────────────────
  if (view === 'seasons' && selectedShow) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => { setView('search'); setSelectedShow(null); setSeasons([]); setError(null) }}
          className="flex items-center gap-1.5 text-stone-500 hover:text-amber-400 text-sm transition-colors self-start">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          {selectedShow.poster_path && (
            <img src={`https://image.tmdb.org/t/p/w92${selectedShow.poster_path}`} alt={selectedShow.name}
              className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
          )}
          <div>
            <p className="text-amber-100 font-medium">{selectedShow.name}</p>
            <p className="text-stone-500 text-xs">{selectedShow.first_air_date?.slice(0, 4)}</p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loadingSeasons && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-stone-600" /></div>}

        <div className="flex flex-col gap-1.5">
          {seasons.map(s => (
            <button key={s.season_number} onClick={() => handleSelectSeason(s)}
              className="flex items-center justify-between bg-stone-950 border border-stone-800 hover:border-amber-700/50 rounded-xl px-4 py-3 transition-colors text-left">
              <span className="text-amber-100 text-sm">{s.name}</span>
              <span className="text-stone-500 text-xs">{s.episode_count} eps</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Search view ───────────────────────────────────────────────────────────
  const results = searchType === 'movie' ? movieResults : tvResults

  return (
    <div className="flex flex-col gap-4">
      {/* Movie / TV toggle */}
      <div className="flex gap-1 bg-stone-950 rounded-xl p-1">
        <button type="button" onClick={() => { setSearchType('movie'); setTvResults([]) }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${
            searchType === 'movie' ? 'bg-amber-700 text-amber-50' : 'text-stone-500 hover:text-stone-300'
          }`}>
          <Film size={13} /> Movies
        </button>
        <button type="button" onClick={() => { setSearchType('tv'); setMovieResults([]) }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${
            searchType === 'tv' ? 'bg-amber-700 text-amber-50' : 'text-stone-500 hover:text-stone-300'
          }`}>
          <Tv size={13} /> TV Shows
        </button>
      </div>

      <div className="flex gap-2">
        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          placeholder={searchType === 'movie' ? 'Search movies…' : 'Search TV shows…'}
          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
        />
        <button type="button" onClick={handleSearch} disabled={searching || !query.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 rounded-xl px-4 py-3 transition-colors flex-shrink-0">
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {results.length === 0 && !searching && (
        <p className="text-stone-600 text-xs px-1">
          {searchType === 'movie' ? 'Search any movie — streams via Real-Debrid.' : 'Search any TV show — pick a season and episode.'}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {searchType === 'movie'
          ? movieResults.map(movie => (
            <button key={movie.id} onClick={() => handleSelectMovie(movie)} className="flex flex-col gap-1.5 text-left group">
              <div className="aspect-[2/3] bg-stone-800 rounded-xl overflow-hidden">
                {movie.poster_path
                  ? <img src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center"><Film size={24} className="text-stone-600" /></div>}
              </div>
              <p className="text-amber-100 text-xs leading-tight line-clamp-2">{movie.title}</p>
              {movie.release_date && <p className="text-stone-600 text-xs">{movie.release_date.slice(0, 4)}</p>}
            </button>
          ))
          : tvResults.map(show => (
            <button key={show.id} onClick={() => handleSelectShow(show)} className="flex flex-col gap-1.5 text-left group">
              <div className="aspect-[2/3] bg-stone-800 rounded-xl overflow-hidden">
                {show.poster_path
                  ? <img src={`https://image.tmdb.org/t/p/w200${show.poster_path}`} alt={show.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center"><Tv size={24} className="text-stone-600" /></div>}
              </div>
              <p className="text-amber-100 text-xs leading-tight line-clamp-2">{show.name}</p>
              {show.first_air_date && <p className="text-stone-600 text-xs">{show.first_air_date.slice(0, 4)}</p>}
            </button>
          ))
        }
      </div>
    </div>
  )
}

export function StremioAddonNotConfigured() {
  return (
    <div className="text-center py-12 flex flex-col items-center gap-3">
      <Film size={36} className="text-stone-700" />
      <p className="text-stone-500 text-sm">Add a Stremio addon URL in Settings first.</p>
      <Link href="/settings" className="flex items-center gap-1.5 text-amber-600 hover:text-amber-500 text-sm transition-colors">
        <Settings size={14} /> Go to Settings
      </Link>
    </div>
  )
}
