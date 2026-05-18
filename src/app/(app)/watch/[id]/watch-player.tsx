'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Trash2, Film, Send, Smartphone, Monitor, Tablet } from 'lucide-react'

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']

type ChatMsg = {
  id: string
  user_id: string
  body: string | null
  emote: string | null
  created_at: string
}

type FloatingEmote = { id: string; emote: string; x: number }
type PresenceUser = { user_id: string; name: string; device: 'phone' | 'tablet' | 'desktop' }

type Props = {
  sessionId: string
  title: string
  sourceType: string
  videoUrl: string | null
  sourceHint: string | null
  storagePath: string | null
  userId: string
  profileMap: Record<string, string>
  initialState: string
  initialPosition: number
  fallbackUrls: string[]
  deleteAction: () => Promise<void>
}

export default function WatchPlayer({
  sessionId, title, sourceType, videoUrl, sourceHint,
  userId, profileMap, initialState, initialPosition, fallbackUrls, deleteAction,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null)
  const lastReceivedAt = useRef(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncChannelRef = useRef<any>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [visibleMessages, setVisibleMessages] = useState<ChatMsg[]>([])
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([])
  const [chatInput, setChatInput] = useState('')
  const [partnerPosition, setPartnerPosition] = useState<number | null>(null)
  const [partnerPlaying, setPartnerPlaying] = useState<boolean | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])
  const [connected, setConnected] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(videoUrl)
  const [fallbackIndex, setFallbackIndex] = useState(0)
  const [streamError, setStreamError] = useState(false)
  const supabase = createClient()

  function detectDevice(): 'phone' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|android|iphone|ipod|blackberry|phone/i.test(ua)) return 'phone'
    return 'desktop'
  }

  function formatTime(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  // ── Push state: only sends if we haven't just received a remote event ────
  const pushState = useCallback(async (state: 'playing' | 'paused', position: number) => {
    if (Date.now() - lastReceivedAt.current < 500) return
    syncChannelRef.current?.send({
      type: 'broadcast',
      event: 'sync',
      payload: { state, position, from: userId },
    })
    await supabase.from('watch_sessions').update({
      state,
      playback_position_seconds: position,
      last_updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)
  }, [sessionId, userId, supabase])

  // ── Sync + Presence ──────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (payload.from === userId) return
        lastReceivedAt.current = Date.now()

        const video = videoRef.current
        if (!video) return

        setPartnerPosition(payload.position)
        setPartnerPlaying(payload.state === 'playing')
        setPartnerName(profileMap[payload.from] ?? 'Partner')

        if (Math.abs(video.currentTime - payload.position) > 2)
          video.currentTime = payload.position
        if (payload.state === 'playing' && video.paused) video.play().catch(() => {})
        if (payload.state === 'paused' && !video.paused) video.pause()
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        setActiveUsers(Object.values(state).flat())
      })
      .subscribe(async (status) => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            name: profileMap[userId] ?? 'You',
            device: detectDevice(),
          })
        }
      })

    syncChannelRef.current = channel
    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [sessionId, userId, supabase])

  // ── Heartbeat: 1s broadcast keeps both devices in sync ───────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current
      if (!video || !syncChannelRef.current) return
      syncChannelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: { state: video.paused ? 'paused' : 'playing', position: video.currentTime, from: userId },
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [userId])

  // ── Chat: subscribe to incoming messages ────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'watch_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const msg = payload.new as ChatMsg

        if (msg.emote) {
          const fe: FloatingEmote = { id: msg.id, emote: msg.emote, x: 10 + Math.random() * 80 }
          setFloatingEmotes(prev => [...prev, fe])
          setTimeout(() => setFloatingEmotes(prev => prev.filter(e => e.id !== fe.id)), 3200)
        } else {
          setVisibleMessages(prev => [...prev.slice(-4), msg])
          setTimeout(() => setVisibleMessages(prev => prev.filter(m => m.id !== msg.id)), 6000)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, supabase])

  // ── Video source setup ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const src = sourceType === 'local'
      ? (localFile ? URL.createObjectURL(localFile) : null)
      : currentUrl

    if (!src) return
    setStreamError(false)

    const isHls = src.includes('.m3u8')

    if (isHls) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          if (hlsRef.current) hlsRef.current.destroy()
          const hls = new Hls()
          hls.loadSource(src)
          hls.attachMedia(video)
          hlsRef.current = hls
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.currentTime = initialPosition
            if (initialState === 'playing') video.play().catch(() => {})
          })
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src
          video.currentTime = initialPosition
          if (initialState === 'playing') video.play().catch(() => {})
        }
      })
    } else {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      video.src = src
      video.currentTime = initialPosition
      if (initialState === 'playing') video.play().catch(() => {})
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      if (sourceType === 'local' && src) URL.revokeObjectURL(src)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, localFile])

  // ── Auto-retry fallback streams on error ─────────────────────────────────
  async function tryNextStream() {
    if (fallbackIndex >= fallbackUrls.length) { setStreamError(true); return }
    const next = fallbackUrls[fallbackIndex]
    setFallbackIndex(i => i + 1)
    setCurrentUrl(next)
    await supabase.from('watch_sessions').update({ source_url: next }).eq('id', sessionId)
  }

  // ── Send chat message ───────────────────────────────────────────────────
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    await supabase.from('watch_messages').insert({
      session_id: sessionId,
      user_id: userId,
      body: text,
      video_position_seconds: videoRef.current?.currentTime ?? 0,
    })
  }

  async function sendEmote(emote: string) {
    await supabase.from('watch_messages').insert({
      session_id: sessionId,
      user_id: userId,
      emote,
      video_position_seconds: videoRef.current?.currentTime ?? 0,
    })
  }

  return (
    <div className="flex flex-col h-screen bg-black">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-stone-950/90 border-b border-stone-800 flex-shrink-0 z-10">
        <Link href="/watch" className="text-stone-500 hover:text-amber-400 transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <p className="font-serif text-amber-100 text-base truncate flex-1">{title}</p>

        {/* Presence badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeUsers.map(u => (
            <div key={u.user_id} className="flex items-center gap-1 bg-stone-800/80 rounded-lg px-2 py-1" title={u.name}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              {u.device === 'phone' && <Smartphone size={12} className="text-stone-400" />}
              {u.device === 'tablet' && <Tablet size={12} className="text-stone-400" />}
              {u.device === 'desktop' && <Monitor size={12} className="text-stone-400" />}
              <span className="text-stone-400 text-xs max-w-[60px] truncate">{u.name}</span>
            </div>
          ))}
        </div>

        <form action={deleteAction} className="flex-shrink-0">
          <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-1">
            <Trash2 size={17} />
          </button>
        </form>
      </div>

      {/* ── Video + overlay ── */}
      <div className="relative flex-1 bg-black overflow-hidden">

        {/* Local file picker */}
        {sourceType === 'local' && !localFile && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black">
            <Film size={48} className="text-stone-700 mb-4" />
            {sourceHint && (
              <p className="text-stone-400 text-sm mb-6 text-center px-8 max-w-sm">
                Select your copy of{' '}
                <span className="text-amber-300 font-medium">{sourceHint}</span>
              </p>
            )}
            <label className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-6 py-3 cursor-pointer transition-colors">
              Choose file
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setLocalFile(f) }}
              />
            </label>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full h-full object-contain"
          onPlay={e => pushState('playing', (e.target as HTMLVideoElement).currentTime)}
          onPause={e => pushState('paused', (e.target as HTMLVideoElement).currentTime)}
          onSeeked={e => {
            const v = e.target as HTMLVideoElement
            pushState(v.paused ? 'paused' : 'playing', v.currentTime)
          }}
          onError={() => tryNextStream()}
        />

        {/* Stream error — no more fallbacks */}
        {streamError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/90 gap-3">
            <p className="text-stone-300 text-sm">This stream was removed from the debrid service.</p>
            <p className="text-stone-500 text-xs">All fallback streams exhausted.</p>
            <Link href="/watch" className="text-amber-500 text-sm hover:text-amber-400 transition-colors">
              ← Pick a new stream
            </Link>
          </div>
        )}

        {/* Trying fallback */}
        {!streamError && fallbackIndex > 0 && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-black/70 rounded-xl px-4 py-2 pointer-events-none">
            <p className="text-amber-300 text-xs">Stream removed — trying fallback {fallbackIndex}/{fallbackUrls.length}…</p>
          </div>
        )}

        {/* Floating emotes */}
        {floatingEmotes.map(fe => (
          <span
            key={fe.id}
            className="absolute bottom-8 text-4xl animate-float-up pointer-events-none select-none"
            style={{ left: `${fe.x}%` }}
          >
            {fe.emote}
          </span>
        ))}

        {/* Overlay chat messages */}
        <div className="absolute bottom-4 left-0 right-0 px-4 pb-2 pointer-events-none flex flex-col gap-1.5 items-start">
          {visibleMessages.map(msg => (
            <div key={msg.id} className="animate-chat-in bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 max-w-xs">
              <span className="text-amber-400 text-xs font-medium">
                {profileMap[msg.user_id] ?? 'Someone'}
              </span>
              <span className="text-white text-sm ml-1.5">{msg.body}</span>
            </div>
          ))}
        </div>

        {/* Sync indicator */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/50 rounded-lg px-2.5 py-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-stone-400 text-xs">{connected ? 'Synced' : 'Connecting…'}</span>
          </div>
          {partnerPosition !== null && (
            <div className="flex items-center gap-1.5 bg-black/50 rounded-lg px-2.5 py-1.5">
              <span className="text-stone-400 text-xs">{partnerName ?? 'Partner'}</span>
              <span className="text-amber-300 text-xs font-mono">{formatTime(partnerPosition)}</span>
              <span className="text-stone-500 text-xs">{partnerPlaying ? '▶' : '⏸'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Emotes + Chat ── */}
      <div className="bg-stone-950/90 border-t border-stone-800 flex-shrink-0">
        <div className="flex justify-center gap-1 px-3 pt-2">
          {EMOTES.map(emote => (
            <button
              key={emote}
              type="button"
              onClick={() => sendEmote(emote)}
              className="text-xl hover:scale-125 transition-transform active:scale-110 w-9 h-9 flex items-center justify-center"
            >
              {emote}
            </button>
          ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 px-4 py-2.5">
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Say something…"
          className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors text-sm"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-50 rounded-xl px-4 py-2.5 transition-colors flex items-center gap-1.5 text-sm flex-shrink-0"
        >
          <Send size={14} /> Send
        </button>
        </form>
      </div>
    </div>
  )
}
