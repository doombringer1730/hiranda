'use client'

import { useState } from 'react'
import { Loader2, Film, Search, Settings, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createWatchSessionFromUrl } from './actions'
import { useRouter } from 'next/navigation'

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

type TmdbResult = {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

type RdStream = {
  name: string
  title: string
  url: string
  behaviorHints?: { filename?: string; videoSize?: number }
}

type Props = { rdApiKey: string }
type View = 'search' | 'streams'

export default function RealDebridBrowser({ rdApiKey }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbResult[]>([])
  const [streams, setStreams] = useState<RdStream[]>([])
  const [selected, setSelected] = useState<TmdbResult | null>(null)
  const [view, setView] = useState<View>('search')
  const [searching, setSearching] = useState(false)
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.status_message ?? `TMDB error ${res.status}`)
      setResults(data.results ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectMovie(movie: TmdbResult) {
    setSelected(movie)
    setLoadingStreams(true)
    setView('streams')
    setStreams([])
    setError(null)
    try {
      const extRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/external_ids?api_key=${TMDB_KEY}`
      )
      const extData = await extRes.json()
      const imdbId = extData.imdb_id as string | null
      if (!imdbId) throw new Error('No IMDB ID found for this title')

      const streamRes = await fetch(
        `https://torrentio.strem.fun/realdebrid=${rdApiKey}/stream/movie/${imdbId}.json`
      )
      const streamData = await streamRes.json()
      const playable = (streamData.streams ?? []).filter((s: RdStream) =>
        s.url?.startsWith('https://')
      )
      setStreams(playable)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load streams')
    } finally {
      setLoadingStreams(false)
    }
  }

  async function handleStartSession(stream: RdStream) {
    if (!selected) return
    setStarting(stream.url)
    const result = await createWatchSessionFromUrl(selected.title, stream.url)
    if (result?.sessionId) {
      router.push(`/watch/${result.sessionId}`)
    } else {
      setStarting(null)
    }
  }

  function parseQuality(name: string) {
    return name.split('\n')[1] ?? name.split('\n')[0] ?? 'Stream'
  }

  function formatSize(bytes?: number) {
    if (!bytes) return ''
    const gb = bytes / 1024 / 1024 / 1024
    return gb >= 1 ? ` · ${gb.toFixed(1)} GB` : ` · ${(bytes / 1024 / 1024).toFixed(0)} MB`
  }

  if (view === 'streams' && selected) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => { setView('search'); setStreams([]); setSelected(null); setError(null) }}
          className="flex items-center gap-1.5 text-stone-500 hover:text-amber-400 text-sm transition-colors self-start"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          {selected.poster_path && (
            <img
              src={`https://image.tmdb.org/t/p/w92${selected.poster_path}`}
              alt={selected.title}
              className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div>
            <p className="text-amber-100 font-medium">{selected.title}</p>
            <p className="text-stone-500 text-xs">{selected.release_date?.slice(0, 4)}</p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {loadingStreams && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-stone-600" />
          </div>
        )}

        {!loadingStreams && streams.length === 0 && !error && (
          <p className="text-stone-500 text-sm text-center py-6">
            No cached streams found. Try a more popular title or wait for Real-Debrid to cache it.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {streams.map((stream, i) => (
            <button
              key={i}
              onClick={() => handleStartSession(stream)}
              disabled={!!starting}
              className="flex items-center justify-between bg-stone-950 border border-stone-800 hover:border-amber-700/50 rounded-xl px-4 py-3 transition-colors disabled:opacity-50 text-left"
            >
              <div className="min-w-0">
                <p className="text-amber-100 text-sm font-medium">{parseQuality(stream.name)}</p>
                <p className="text-stone-500 text-xs mt-0.5 truncate">
                  {stream.title?.split('\n')[0]}{formatSize(stream.behaviorHints?.videoSize)}
                </p>
              </div>
              {starting === stream.url
                ? <Loader2 size={16} className="animate-spin text-amber-500 flex-shrink-0 ml-3" />
                : <span className="text-amber-600 text-xs flex-shrink-0 ml-3">Watch →</span>
              }
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          placeholder="Search for a movie…"
          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 rounded-xl px-4 py-3 transition-colors flex-shrink-0"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {results.length === 0 && !searching && (
        <p className="text-stone-600 text-xs px-1">Search any movie — streams via Real-Debrid.</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {results.map(movie => (
          <button
            key={movie.id}
            onClick={() => handleSelectMovie(movie)}
            className="flex flex-col gap-1.5 text-left group"
          >
            <div className="aspect-[2/3] bg-stone-800 rounded-xl overflow-hidden">
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={24} className="text-stone-600" />
                </div>
              )}
            </div>
            <p className="text-amber-100 text-xs leading-tight line-clamp-2">{movie.title}</p>
            {movie.release_date && (
              <p className="text-stone-600 text-xs">{movie.release_date.slice(0, 4)}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function RealDebridNotConfigured() {
  return (
    <div className="text-center py-12 flex flex-col items-center gap-3">
      <Film size={36} className="text-stone-700" />
      <p className="text-stone-500 text-sm">Connect your Real-Debrid account first.</p>
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-amber-600 hover:text-amber-500 text-sm transition-colors"
      >
        <Settings size={14} /> Go to Settings
      </Link>
    </div>
  )
}
