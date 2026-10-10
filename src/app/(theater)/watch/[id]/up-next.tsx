'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Play, Plus, Search, X } from 'lucide-react'
import { createClient } from '@/theater/supabase/client'
import { formatDuration } from '@/theater/youtube'
import type { YtVideo } from '@/theater/catalog/youtube'
import { addToQueue, playNow, playQueued, removeFromQueue, searchYouTube, type NowPlaying } from './queue-actions'

type Item = { id: string; video_id: string; title: string; thumb: string | null; duration: number | null; added_by: string }

// "Up next": search YouTube without leaving the player and line videos up.
// When the current one ends, the oldest in the list plays for you both.
export default function UpNext({ sessionId, refresh, onChanged, onPlay }: {
  sessionId: string
  /** Bumped when the list may have changed (your partner added something, a video moved on). */
  refresh: number
  onChanged: () => void
  onPlay: (next: NowPlaying) => void
}) {
  const [supabase] = useState(createClient)
  const [items, setItems] = useState<Item[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<YtVideo[] | null>(null)
  const [searching, startSearch] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true
    supabase.from('watch_queue').select('id, video_id, title, thumb, duration, added_by')
      .eq('session_id', sessionId).is('played_at', null).order('created_at', { ascending: true }).limit(50)
      .then(({ data, error }) => {
        if (!live) return
        if (error) { setUnavailable(true); return } // before migration 043
        setItems(data as Item[])
      })
    return () => { live = false }
  }, [supabase, sessionId, refresh])

  function search(e: React.FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    startSearch(async () => setResults(await searchYouTube(query)))
  }

  async function add(v: YtVideo) {
    setBusy(v.id)
    const res = await addToQueue(sessionId, { id: v.id, title: v.title, thumb: v.thumb, duration: v.duration })
    setBusy(null)
    if (res.ok) { setAdded(prev => new Set(prev).add(v.id)); onChanged() }
  }

  async function play(v: YtVideo) {
    setBusy(v.id)
    const next = await playNow(sessionId, { id: v.id, title: v.title, thumb: v.thumb, duration: v.duration })
    setBusy(null)
    if (next) onPlay(next)
  }

  async function playItem(item: Item) {
    setBusy(item.id)
    const next = await playQueued(sessionId, item.id)
    setBusy(null)
    if (next) { onPlay(next); onChanged() }
  }

  async function remove(item: Item) {
    setItems(prev => prev?.filter(i => i.id !== item.id) ?? null)
    await removeFromQueue(item.id)
    onChanged()
  }

  if (unavailable) {
    return <p className="text-stone-500 text-sm text-center px-6 py-10">“Up next” isn’t switched on yet.</p>
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <form onSubmit={search} role="search" className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)} type="search" placeholder="Search YouTube or paste a link"
          aria-label="Search YouTube"
          className="w-full bg-stone-900 border border-stone-800 rounded-full pl-10 pr-10 py-2.5 text-sm text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
        {searching && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 animate-spin" />}
      </form>

      {results && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Results</h3>
            <button onClick={() => { setResults(null); setQ('') }} className="text-stone-500 hover:text-stone-300 text-xs" style={{ minHeight: 0 }}>Clear</button>
          </div>
          {!results.length && <p className="text-stone-500 text-sm py-4">Nothing found — try other words.</p>}
          {results.map(v => (
            <Row key={v.id} thumb={v.thumb} title={v.title} sub={v.channel} time={v.live ? 'LIVE' : formatDuration(v.duration)}>
              <button onClick={() => play(v)} disabled={busy === v.id} aria-label={`Play ${v.title} now`}
                className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-50" style={{ minHeight: 0 }}>
                <Play size={14} fill="currentColor" />
              </button>
              <button onClick={() => add(v)} disabled={busy === v.id || added.has(v.id)}
                className="inline-flex items-center gap-1 h-9 rounded-full bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-400 text-amber-50 text-xs font-medium px-3" style={{ minHeight: 0 }}>
                {added.has(v.id) ? 'Added' : <><Plus size={13} /> Up next</>}
              </button>
            </Row>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Up next{items?.length ? ` · ${items.length}` : ''}</h3>
        {items === null
          ? <Loader2 size={16} className="text-stone-600 animate-spin mx-auto my-4" />
          : !items.length
            ? <p className="text-stone-600 text-sm py-2">Nothing lined up. Search above and add a few — they’ll play one after another for both of you.</p>
            : items.map((item, i) => (
              <Row key={item.id} thumb={item.thumb} title={item.title} sub={i === 0 ? 'Plays next' : `#${i + 1}`} time={formatDuration(item.duration)}>
                <button onClick={() => playItem(item)} disabled={busy === item.id} aria-label={`Play ${item.title} now`}
                  className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-50" style={{ minHeight: 0 }}>
                  <Play size={14} fill="currentColor" />
                </button>
                <button onClick={() => remove(item)} aria-label={`Remove ${item.title}`}
                  className="grid place-items-center h-9 w-9 rounded-full text-stone-500 hover:text-red-400" style={{ minHeight: 0 }}>
                  <X size={15} />
                </button>
              </Row>
            ))}
      </section>
    </div>
  )
}

function Row({ thumb, title, sub, time, children }: { thumb: string | null; title: string; sub: string; time: string | null; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-28 shrink-0 aspect-video rounded-md overflow-hidden bg-stone-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {time && <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 text-[10px] text-stone-100">{time}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-100 leading-snug line-clamp-2">{title}</p>
        <p className="text-[11px] text-stone-500 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  )
}
