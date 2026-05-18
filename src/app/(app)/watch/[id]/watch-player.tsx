'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Trash2, Film, Send } from 'lucide-react'

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']

type ChatMsg = {
  id: string
  user_id: string
  body: string | null
  emote: string | null
  created_at: string
}

type FloatingEmote = { id: string; emote: string; x: number }

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
  deleteAction: () => Promise<void>
}

export default function WatchPlayer({
  sessionId, title, sourceType, videoUrl, sourceHint,
  userId, profileMap, initialState, initialPosition, deleteAction,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null)
  const applyingRemote = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncChannelRef = useRef<any>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [visibleMessages, setVisibleMessages] = useState<ChatMsg[]>([])
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([])
  const [chatInput, setChatInput] = useState('')
  const [partnerPosition, setPartnerPosition] = useState<number | null>(null)
  const [partnerPlaying, setPartnerPlaying] = useState<boolean | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const supabase = createClient()

  function formatTime(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  // ── Push state: broadcast for instant sync + update DB for persistence ──
  const pushState = useCallback(async (state: 'playing' | 'paused', position: number) => {
    if (applyingRemote.current) return
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

  // ── Sync: subscribe via Broadcast (no table replication required) ────────
  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        const video = videoRef.current
        if (!video || payload.from === userId) return

        setPartnerPosition(payload.position)
        setPartnerPlaying(payload.state === 'playing')
        setPartnerName(profileMap[payload.from] ?? 'Partner')

        applyingRemote.current = true
        if (Math.abs(video.currentTime - payload.position) > 1.5)
          video.currentTime = payload.position
        if (payload.state === 'playing' && video.paused) video.play().catch(() => {})
        if (payload.state === 'paused' && !video.paused) video.pause()
        setTimeout(() => { applyingRemote.current = false }, 300)
      })
      .subscribe()

    syncChannelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, userId, supabase])

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
      : videoUrl

    if (!src) return

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
  }, [videoUrl, localFile])

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
        />

        {/* Floating emotes */}
        {floatingEmotes.map(fe => (
          <span
            key={fe.id}
            className="absolute bottom-20 text-4xl animate-float-up pointer-events-none select-none"
            style={{ left: `${fe.x}%` }}
          >
            {fe.emote}
          </span>
        ))}

        {/* Overlay chat messages */}
        <div className="absolute bottom-16 left-0 right-0 px-4 pb-2 pointer-events-none flex flex-col gap-1.5 items-start">
          {visibleMessages.map(msg => (
            <div key={msg.id} className="animate-chat-in bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 max-w-xs">
              <span className="text-amber-400 text-xs font-medium">
                {profileMap[msg.user_id] ?? 'Someone'}
              </span>
              <span className="text-white text-sm ml-1.5">{msg.body}</span>
            </div>
          ))}
        </div>

        {/* Emote bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/70 backdrop-blur rounded-2xl px-3 py-2">
          {EMOTES.map(emote => (
            <button
              key={emote}
              onClick={() => sendEmote(emote)}
              className="text-xl hover:scale-125 transition-transform active:scale-110 w-9 h-9 flex items-center justify-center"
            >
              {emote}
            </button>
          ))}
        </div>

        {/* Sync indicator */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/50 rounded-lg px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-stone-400 text-xs">Synced</span>
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

      {/* ── Chat input ── */}
      <form onSubmit={sendMessage} className="flex gap-2 px-4 py-3 bg-stone-950/90 border-t border-stone-800 flex-shrink-0">
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
  )
}
