'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Send, Trash2 } from 'lucide-react'
import { createClient } from '@/theater/supabase/client'

// Synced YouTube, through YouTube's official embedded player (IFrame API).
// It speaks the same protocol as watch-player.tsx — channel `watch:<id>`,
// the same SyncPayload, NTP-style clock correction against /api/time, the same
// drift thresholds and watch_messages chat — so both players stay compatible.
// watch-player.tsx itself is deliberately left untouched.

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']
const HEARTBEAT_MS = 4000
const NTP_INTERVAL_MS = 30000
const NTP_SAMPLES = 5
const DRIFT_THRESHOLD = 1.5
const DRIFT_ACTION = 0.8
const SEEK_JUMP = 2 // seconds of unexplained movement that counts as a seek
const ECHO_MS = 1200 // ignore our own player's events this long after applying a remote change

type SyncPayload = { kind: 'heartbeat' | 'action'; state: 'playing' | 'paused'; position: number; sentAt: number; from: string }
type ChatMsg = { id: string; user_id: string; body: string | null; emote: string | null; created_at: string }
type FloatingEmote = { id: string; emote: string; x: number }

// The slice of the YouTube IFrame API we use.
type YTPlayer = {
  playVideo(): void; pauseVideo(): void; seekTo(s: number, allowSeekAhead: boolean): void
  getCurrentTime(): number; getPlayerState(): number; destroy(): void
}
type YTNamespace = {
  Player: new (el: HTMLElement, opts: {
    videoId: string; width?: string; height?: string
    playerVars?: Record<string, string | number>
    events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void }
  }) => YTPlayer
}
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

const PLAYING = 1, PAUSED = 2, ENDED = 0

let apiPromise: Promise<YTNamespace> | null = null
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise(resolve => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!) }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      document.head.appendChild(s)
    })
  }
  return apiPromise
}

const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0)

export default function YouTubePlayer({ sessionId, title, videoId, userId, profileMap, initialState, initialPosition, deleteAction }: {
  sessionId: string; title: string; videoId: string; userId: string
  profileMap: Record<string, string>; initialState: string; initialPosition: number
  deleteAction: () => Promise<void>
}) {
  const [supabase] = useState(createClient)
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const suppressUntil = useRef(0)
  const hasFirstSync = useRef(false)
  const offset = useRef(0)
  const rtts = useRef<number[]>([])
  const offsets = useRef<number[]>([])
  const last = useRef({ pos: initialPosition, wall: Date.now(), playing: false })

  const [ready, setReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [partner, setPartner] = useState<{ name: string; pos: number; playing: boolean } | null>(null)
  const [here, setHere] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [emotes, setEmotes] = useState<FloatingEmote[]>([])
  const [input, setInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)

  const suppressed = () => Date.now() < suppressUntil.current
  const now = () => Date.now() - offset.current // server-normalised
  const position = () => playerRef.current?.getCurrentTime() ?? 0
  const isPlaying = () => playerRef.current?.getPlayerState() === PLAYING

  // ── Clock sync (rolling median, like watch-player.tsx) ──
  useEffect(() => {
    async function sync() {
      try {
        const sent = Date.now()
        const { t } = (await (await fetch('/api/time')).json()) as { t: number }
        const got = Date.now()
        rtts.current = [...rtts.current, got - sent].slice(-NTP_SAMPLES)
        offsets.current = [...offsets.current, got - Math.round(median(rtts.current) / 2) - t].slice(-NTP_SAMPLES)
        offset.current = median(offsets.current)
      } catch { /* keep the last estimate */ }
    }
    sync()
    const id = setInterval(sync, NTP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const send = useCallback((kind: SyncPayload['kind'], state: SyncPayload['state'], pos: number) => {
    const payload: SyncPayload = { kind, state, position: pos, sentAt: now(), from: userId }
    channelRef.current?.send({ type: 'broadcast', event: 'sync', payload })
    if (kind === 'action') {
      supabase.from('watch_sessions').update({
        state, playback_position_seconds: pos, last_updated_by: userId, updated_at: new Date().toISOString(),
      }).eq('id', sessionId).then(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, supabase])

  // ── Apply a partner's state ──
  const apply = useCallback((p: SyncPayload) => {
    setPartner({ name: profileMap[p.from] ?? 'Partner', pos: p.position, playing: p.state === 'playing' })
    const player = playerRef.current
    if (!player) return
    const expected = p.state === 'playing' && p.sentAt ? p.position + Math.max(0, now() - p.sentAt) / 1000 : p.position
    const drift = Math.abs(player.getCurrentTime() - expected)
    const threshold = p.kind === 'action' ? DRIFT_ACTION : DRIFT_THRESHOLD
    if (!hasFirstSync.current || drift > threshold) {
      hasFirstSync.current = true
      suppressUntil.current = Date.now() + ECHO_MS
      player.seekTo(expected, true)
    }
    const playing = player.getPlayerState() === PLAYING
    if (p.state === 'playing' && !playing) {
      suppressUntil.current = Date.now() + ECHO_MS
      player.playVideo()
      // Phones block autoplay without a tap — offer one if it didn't start.
      setTimeout(() => { if (playerRef.current?.getPlayerState() !== PLAYING) setNeedsTap(true) }, 1500)
    } else if (p.state === 'paused' && playing) {
      suppressUntil.current = Date.now() + ECHO_MS
      player.pauseVideo()
    }
    last.current = { pos: expected, wall: Date.now(), playing: p.state === 'playing' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileMap])

  // ── The player ──
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then(YT => {
      if (cancelled || !mountRef.current) return
      const el = document.createElement('div')
      mountRef.current.appendChild(el)
      playerRef.current = new YT.Player(el, {
        videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(initialPosition), origin: location.origin },
        events: {
          onReady: () => {
            setReady(true)
            last.current = { pos: initialPosition, wall: Date.now(), playing: false }
            if (initialState === 'playing') { suppressUntil.current = Date.now() + ECHO_MS; playerRef.current?.playVideo() }
          },
          onStateChange: ({ data }) => {
            if (data === PLAYING) setNeedsTap(false)
            const pos = position()
            if (data === PLAYING || data === PAUSED || data === ENDED) last.current = { pos, wall: Date.now(), playing: data === PLAYING }
            if (suppressed()) return
            if (data === PLAYING) send('action', 'playing', pos)
            else if (data === PAUSED || data === ENDED) send('action', 'paused', pos)
          },
        },
      })
    })
    return () => { cancelled = true; playerRef.current?.destroy(); playerRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // ── Seek detection + heartbeat (the IFrame API has no seek event) ──
  useEffect(() => {
    const tick = setInterval(() => {
      if (!playerRef.current || !ready) return
      const pos = position(), playing = isPlaying()
      const expected = last.current.pos + (last.current.playing ? (Date.now() - last.current.wall) / 1000 : 0)
      if (!suppressed() && Math.abs(pos - expected) > SEEK_JUMP) send('action', playing ? 'playing' : 'paused', pos)
      last.current = { pos, wall: Date.now(), playing }
    }, 1000)
    const beat = setInterval(() => {
      if (playerRef.current && ready) send('heartbeat', isPlaying() ? 'playing' : 'paused', position())
    }, HEARTBEAT_MS)
    return () => { clearInterval(tick); clearInterval(beat) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, send])

  // ── Sync channel + presence ──
  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }: { payload: SyncPayload }) => { if (payload.from !== userId) apply(payload) })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string }>()
        setHere(Object.values(state).flat().map(p => p.name))
      })
      .subscribe(async status => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: profileMap[userId] ?? 'You', device: /mobile|iphone|android/i.test(navigator.userAgent) ? 'phone' : 'desktop' })
      })
    channelRef.current = channel
    return () => { channel.untrack(); supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId])

  // ── Chat ──
  useEffect(() => {
    supabase.from('watch_messages').select('id, user_id, body, emote, created_at')
      .eq('session_id', sessionId).is('emote', null).order('created_at', { ascending: true }).limit(50)
      .then(({ data }) => { if (data) setMessages(data as ChatMsg[]) })
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'watch_messages', filter: `session_id=eq.${sessionId}` }, change => {
        const msg = change.new as ChatMsg
        if (msg.emote) {
          const fe = { id: msg.id, emote: msg.emote, x: 10 + Math.random() * 80 }
          setEmotes(prev => [...prev, fe])
          setTimeout(() => setEmotes(prev => prev.filter(e => e.id !== fe.id)), 3200)
        } else setMessages(prev => [...prev, msg])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, supabase])

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body) return
    setInput('')
    await supabase.from('watch_messages').insert({ session_id: sessionId, user_id: userId, body, video_position_seconds: position() })
  }
  async function sendEmote(emote: string) {
    await supabase.from('watch_messages').insert({ session_id: sessionId, user_id: userId, emote, video_position_seconds: position() })
  }

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black">
      <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 bg-stone-950 border-b border-stone-800/60 shrink-0">
        <Link href="/watch" aria-label="Back to the Theater" className="text-stone-500 hover:text-amber-400 transition-colors"><ArrowLeft size={20} /></Link>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-amber-100 truncate leading-tight">{title}</p>
          <p className="text-stone-500 text-xs truncate">
            {partner ? <>{partner.name} · {fmt(partner.pos)} {partner.playing ? '▶' : '⏸'}</> : here.length > 1 ? `${here.join(' & ')} here` : 'Waiting for your partner…'}
          </p>
        </div>
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-stone-600'}`} aria-label={connected ? 'Live' : 'Connecting'} />
        <button onClick={() => confirmDelete ? deleteAction() : setConfirmDelete(true)} onBlur={() => setConfirmDelete(false)}
          className={`text-xs flex items-center gap-1 transition-colors ${confirmDelete ? 'text-red-400' : 'text-stone-600 hover:text-stone-300'}`}>
          <Trash2 size={15} />{confirmDelete && 'Delete?'}
        </button>
      </div>

      <div className="relative w-full aspect-video max-h-[60dvh] bg-black shrink-0">
        <div ref={mountRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
        {needsTap && (
          <button onClick={() => { setNeedsTap(false); playerRef.current?.playVideo() }}
            className="absolute inset-0 z-10 grid place-items-center bg-black/70 text-amber-50">
            <span className="flex items-center gap-2 rounded-full bg-amber-700 px-5 py-3 text-sm font-medium"><Play size={16} fill="currentColor" /> Tap to join {partner?.name ?? 'your partner'}</span>
          </button>
        )}
        {emotes.map(fe => (
          <span key={fe.id} className="absolute text-4xl animate-float-up pointer-events-none select-none z-20" style={{ left: `${fe.x}%`, bottom: '12px' }}>{fe.emote}</span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 bg-stone-950">
        {!messages.length && <p className="text-stone-700 text-sm text-center mt-6">Say something while you watch.</p>}
        <div className="flex flex-col gap-2">
          {messages.map(m => (
            <p key={m.id} className="text-sm leading-snug">
              <span className="text-amber-500 text-xs font-medium mr-1.5">{m.user_id === userId ? 'You' : (profileMap[m.user_id] ?? 'Partner')}</span>
              <span className="text-stone-200">{m.body}</span>
            </p>
          ))}
          <div ref={chatEnd} />
        </div>
      </div>

      <div className="bg-stone-950 border-t border-stone-800/60 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center gap-1 px-3 pt-2">
          {EMOTES.map(e => (
            <button key={e} type="button" onClick={() => sendEmote(e)} aria-label={`Send ${e}`}
              className="text-xl hover:scale-125 active:scale-110 transition-transform w-9 h-9 grid place-items-center">{e}</button>
          ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 px-4 pb-3 pt-1">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Say something…"
            className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 text-sm" />
          <button type="submit" disabled={!input.trim()} aria-label="Send"
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-50 rounded-xl px-4 transition-colors"><Send size={14} /></button>
        </form>
      </div>
    </div>
  )
}
