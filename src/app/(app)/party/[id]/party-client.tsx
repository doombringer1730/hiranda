'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Send, Smartphone, Monitor, Tablet, Puzzle } from 'lucide-react'

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']

const PLATFORM_LABELS: Record<string, string> = {
  netflix: 'Netflix', youtube: 'YouTube', disney: 'Disney+',
  prime: 'Prime Video', max: 'Max', hulu: 'Hulu',
  appletv: 'Apple TV+', paramount: 'Paramount+',
}

const PLATFORM_COLORS: Record<string, string> = {
  netflix:   'bg-red-950/60 text-red-400 border-red-900',
  youtube:   'bg-red-950/60 text-red-400 border-red-900',
  disney:    'bg-blue-950/60 text-blue-400 border-blue-900',
  prime:     'bg-blue-950/60 text-blue-300 border-blue-900',
  max:       'bg-purple-950/60 text-purple-400 border-purple-900',
  hulu:      'bg-green-950/60 text-green-400 border-green-900',
  appletv:   'bg-stone-800 text-stone-300 border-stone-700',
  paramount: 'bg-blue-950/60 text-blue-400 border-blue-900',
}

function extractYouTubeId(url: string): string | null {
  const v = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (v) return v[1]
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  return null
}

type ChatMsg = { id: string; user_id: string; body: string | null; emote: string | null; created_at: string }
type FloatingEmote = { id: string; emote: string; x: number }
type PresenceUser = { user_id: string; name: string; device: 'phone' | 'tablet' | 'desktop' }

type Props = {
  sessionId: string
  title: string
  platform: string | null
  partyUrl: string | null
  thumbnailUrl: string | null
  userId: string
  profileMap: Record<string, string>
}

export default function PartyClient({
  sessionId, title, platform, partyUrl, thumbnailUrl, userId, profileMap,
}: Props) {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncChannelRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytPlayerRef = useRef<any>(null)
  const applyingRemote = useRef(false)
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])
  const [connected, setConnected] = useState(false)
  const [partnerPosition, setPartnerPosition] = useState<number | null>(null)
  const [partnerPlaying, setPartnerPlaying] = useState<boolean | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [visibleMessages, setVisibleMessages] = useState<ChatMsg[]>([])
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([])
  const [chatInput, setChatInput] = useState('')
  const [needsUserPlay, setNeedsUserPlay] = useState(false)

  const videoId = platform === 'youtube' && partyUrl ? extractYouTubeId(partyUrl) : null
  const embedsVideo = !!videoId

  function detectDevice(): 'phone' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|android|iphone|ipod|blackberry|phone/i.test(ua)) return 'phone'
    return 'desktop'
  }

  function formatTime(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    return `${m}:${String(sec).padStart(2,'0')}`
  }

  // ── Push sync state to channel + DB ──────────────────────────────────────
  const pushState = useCallback(async (state: 'playing' | 'paused', position: number) => {
    if (applyingRemote.current) return
    syncChannelRef.current?.send({
      type: 'broadcast', event: 'sync',
      payload: { kind: 'action', state, position, from: userId },
    })
    await supabase.from('watch_sessions').update({
      state,
      playback_position_seconds: position,
      last_updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)
  }, [sessionId, userId, supabase])

  // ── Presence + sync channel ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (payload.from === userId) return
        setPartnerPosition(payload.position)
        setPartnerPlaying(payload.state === 'playing')
        setPartnerName(profileMap[payload.from] ?? 'Partner')

        // Apply to YouTube embed if present
        const player = ytPlayerRef.current
        if (player) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const YT = (window as any).YT
          const drift = Math.abs(player.getCurrentTime() - payload.position)
          const threshold = payload.kind === 'action' ? 1 : 2
          if (drift > threshold) {
            applyingRemote.current = true
            player.seekTo(payload.position, true)
            setTimeout(() => { applyingRemote.current = false }, 500)
          }
          if (payload.state === 'playing' && player.getPlayerState() !== YT?.PlayerState?.PLAYING) {
            applyingRemote.current = true
            player.playVideo()
            setTimeout(() => { applyingRemote.current = false }, 500)
          } else if (payload.state === 'paused' && player.getPlayerState() === YT?.PlayerState?.PLAYING) {
            applyingRemote.current = true
            player.pauseVideo()
            setTimeout(() => { applyingRemote.current = false }, 500)
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        setActiveUsers(Object.values(state).flat())
      })
      .subscribe(async (status) => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, name: profileMap[userId] ?? 'You', device: detectDevice() })
        }
      })

    syncChannelRef.current = channel
    return () => { channel.untrack(); supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId])

  // ── YouTube IFrame embed ──────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return

    function initPlayer() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      ytPlayerRef.current = new YT.Player('yt-embed', {
        height: '100%',
        width: '100%',
        videoId,
        playerVars: { playsinline: 1, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (applyingRemote.current) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const YTState = (window as any).YT.PlayerState
            if (e.data === YTState.PLAYING) {
              pushState('playing', ytPlayerRef.current.getCurrentTime())
              setNeedsUserPlay(false)
            } else if (e.data === YTState.PAUSED) {
              pushState('paused', ytPlayerRef.current.getCurrentTime())
            }
          },
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).YT?.Player) {
      initPlayer()
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).onYouTubeIframeAPIReady = initPlayer
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    return () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null }
    }
  }, [videoId, pushState])

  // ── Heartbeat (YouTube embed) ─────────────────────────────────────────────
  useEffect(() => {
    if (!embedsVideo) return
    const interval = setInterval(() => {
      const player = ytPlayerRef.current
      if (!player || !syncChannelRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      const playing = player.getPlayerState() === YT?.PlayerState?.PLAYING
      syncChannelRef.current.send({
        type: 'broadcast', event: 'sync',
        payload: { kind: 'heartbeat', state: playing ? 'playing' : 'paused', position: player.getCurrentTime(), from: userId },
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [userId, embedsVideo])

  // ── Chat ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'watch_messages', filter: `session_id=eq.${sessionId}` }, (payload) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim(); if (!text) return
    setChatInput('')
    await supabase.from('watch_messages').insert({ session_id: sessionId, user_id: userId, body: text, video_position_seconds: partnerPosition ?? 0 })
  }

  async function sendEmote(emote: string) {
    await supabase.from('watch_messages').insert({ session_id: sessionId, user_id: userId, emote, video_position_seconds: ytPlayerRef.current?.getCurrentTime() ?? partnerPosition ?? 0 })
  }

  const platformLabel = platform ? (PLATFORM_LABELS[platform] ?? platform) : null
  const platformColor = platform ? (PLATFORM_COLORS[platform] ?? 'bg-stone-800 text-stone-400 border-stone-700') : null

  return (
    <div className="flex flex-col h-screen bg-black">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-stone-950/90 border-b border-stone-800 flex-shrink-0">
        <Link href="/watch" className="text-stone-500 hover:text-amber-400 transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <p className="font-serif text-amber-100 text-base truncate flex-1">{title}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeUsers.map(u => (
            <div key={u.user_id} className="flex items-center gap-1 bg-stone-800/80 rounded-lg px-2 py-1" title={u.name}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              {u.device === 'phone'   && <Smartphone size={12} className="text-stone-400" />}
              {u.device === 'tablet'  && <Tablet     size={12} className="text-stone-400" />}
              {u.device === 'desktop' && <Monitor    size={12} className="text-stone-400" />}
              <span className="text-stone-400 text-xs max-w-[60px] truncate">{u.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── YouTube embed (or extension nudge for DRM platforms) ── */}
      {embedsVideo ? (
        <div className="relative flex-1 bg-black overflow-hidden">

          {/* YouTube player container */}
          <div id="yt-embed" className="w-full h-full" />

          {/* Autoplay blocked nudge */}
          {needsUserPlay && (
            <button
              onClick={() => { ytPlayerRef.current?.playVideo(); setNeedsUserPlay(false) }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60"
            >
              <div className="bg-amber-700 rounded-2xl px-6 py-4 flex flex-col items-center gap-2">
                <span className="text-3xl">▶</span>
                <span className="text-amber-50 text-sm font-medium">Tap to play</span>
              </div>
            </button>
          )}

          {/* Sync + partner status */}
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

          {/* Floating emotes */}
          {floatingEmotes.map(fe => (
            <span key={fe.id} className="absolute bottom-8 text-4xl animate-float-up pointer-events-none select-none" style={{ left: `${fe.x}%` }}>
              {fe.emote}
            </span>
          ))}

          {/* Chat overlay */}
          <div className="absolute bottom-4 left-0 right-0 px-4 pb-2 pointer-events-none flex flex-col gap-1.5 items-start">
            {visibleMessages.map(msg => (
              <div key={msg.id} className="animate-chat-in bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 max-w-xs">
                <span className="text-amber-400 text-xs font-medium">{profileMap[msg.user_id] ?? 'Someone'}</span>
                <span className="text-white text-sm ml-1.5">{msg.body}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Non-embeddable platform — extension-driven */
        <div className="relative flex-1 overflow-hidden flex flex-col">
          <div className="flex items-start gap-4 px-5 py-5 border-b border-stone-900 flex-shrink-0">
            {thumbnailUrl
              ? <img src={thumbnailUrl} alt={title} className="w-16 h-24 object-cover rounded-xl flex-shrink-0" />
              : <div className="w-16 h-24 bg-stone-900 rounded-xl flex-shrink-0" />
            }
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-amber-100 font-medium text-lg leading-tight truncate mb-2.5">{title}</p>
              {platformLabel && platformColor && (
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${platformColor}`}>
                  Watching on {platformLabel}
                </span>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                {partnerPosition !== null ? (
                  <>
                    <span className="text-stone-500 text-xs">{partnerName ?? 'Partner'}</span>
                    <span className="text-amber-300 text-xs font-mono">{formatTime(partnerPosition)}</span>
                    <span className="text-stone-500 text-sm">{partnerPlaying ? '▶' : '⏸'}</span>
                  </>
                ) : (
                  <span className="text-stone-600 text-xs">{connected ? 'Waiting for extension…' : 'Connecting…'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex-1">
            <div className="flex justify-center pt-5 px-4">
              <div className="bg-stone-900/80 border border-stone-800/80 rounded-xl px-4 py-3 text-center max-w-xs">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Puzzle size={14} className="text-amber-600" />
                  <p className="text-stone-400 text-xs font-medium">Video plays in your streaming app</p>
                </div>
                <p className="text-stone-600 text-xs mb-2">Start the party from the browser extension, then watch in your {platformLabel ?? 'streaming'} tab.</p>
                <Link href="/extension" className="text-amber-500 text-xs hover:text-amber-400 transition-colors font-medium">
                  Get the Hiranda extension →
                </Link>
              </div>
            </div>
            {floatingEmotes.map(fe => (
              <span key={fe.id} className="absolute bottom-8 text-4xl animate-float-up pointer-events-none select-none" style={{ left: `${fe.x}%` }}>
                {fe.emote}
              </span>
            ))}
            <div className="absolute bottom-4 left-0 right-0 px-4 pb-2 pointer-events-none flex flex-col gap-1.5 items-start">
              {visibleMessages.map(msg => (
                <div key={msg.id} className="animate-chat-in bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 max-w-xs">
                  <span className="text-amber-400 text-xs font-medium">{profileMap[msg.user_id] ?? 'Someone'}</span>
                  <span className="text-white text-sm ml-1.5">{msg.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emotes + chat input */}
      <div className="bg-stone-950/90 border-t border-stone-800 flex-shrink-0">
        <div className="flex justify-center gap-1 px-3 pt-2">
          {EMOTES.map(emote => (
            <button key={emote} type="button" onClick={() => sendEmote(emote)}
              className="text-xl hover:scale-125 transition-transform active:scale-110 w-9 h-9 flex items-center justify-center">
              {emote}
            </button>
          ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 px-4 py-2.5">
          <input
            value={chatInput} onChange={e => setChatInput(e.target.value)}
            placeholder="Say something…"
            className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors text-sm"
          />
          <button type="submit" disabled={!chatInput.trim()}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-50 rounded-xl px-4 py-2.5 transition-colors flex items-center gap-1.5 text-sm flex-shrink-0">
            <Send size={14} /> Send
          </button>
        </form>
      </div>
    </div>
  )
}
