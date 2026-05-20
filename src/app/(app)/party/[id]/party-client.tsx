'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Send, Smartphone, Monitor, Tablet, Puzzle } from 'lucide-react'

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']

const PLATFORM_LABELS: Record<string, string> = {
  netflix: 'Netflix',
  youtube: 'YouTube',
  disney: 'Disney+',
  prime: 'Prime Video',
  max: 'Max',
  hulu: 'Hulu',
  appletv: 'Apple TV+',
  paramount: 'Paramount+',
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
  platform: string | null
  thumbnailUrl: string | null
  userId: string
  profileMap: Record<string, string>
}

export default function PartyClient({
  sessionId, title, platform, thumbnailUrl, userId, profileMap,
}: Props) {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncChannelRef = useRef<any>(null)
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])
  const [connected, setConnected] = useState(false)
  const [partnerPosition, setPartnerPosition] = useState<number | null>(null)
  const [partnerPlaying, setPartnerPlaying] = useState<boolean | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [visibleMessages, setVisibleMessages] = useState<ChatMsg[]>([])
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([])
  const [chatInput, setChatInput] = useState('')

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

  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (payload.from === userId) return
        setPartnerPosition(payload.position)
        setPartnerPlaying(payload.state === 'playing')
        setPartnerName(profileMap[payload.from] ?? 'Partner')
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    await supabase.from('watch_messages').insert({
      session_id: sessionId,
      user_id: userId,
      body: text,
      video_position_seconds: partnerPosition ?? 0,
    })
  }

  async function sendEmote(emote: string) {
    await supabase.from('watch_messages').insert({
      session_id: sessionId,
      user_id: userId,
      emote,
      video_position_seconds: partnerPosition ?? 0,
    })
  }

  const platformLabel = platform ? (PLATFORM_LABELS[platform] ?? platform) : null
  const platformColor = platform
    ? (PLATFORM_COLORS[platform] ?? 'bg-stone-800 text-stone-400 border-stone-700')
    : null

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

      {/* Now-watching card */}
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
              <span className="text-stone-600 text-xs">
                {connected ? 'Waiting for extension to start…' : 'Connecting…'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Extension nudge */}
        <div className="flex justify-center pt-5 px-4">
          <div className="bg-stone-900/80 border border-stone-800/80 rounded-xl px-4 py-3 text-center max-w-xs">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Puzzle size={14} className="text-amber-600" />
              <p className="text-stone-400 text-xs font-medium">Video plays in your streaming app</p>
            </div>
            <p className="text-stone-600 text-xs mb-2">This page is the chat &amp; sync layer. Start the party from the browser extension.</p>
            <Link href="/extension" className="text-amber-500 text-xs hover:text-amber-400 transition-colors font-medium">
              Get the Hiranda extension →
            </Link>
          </div>
        </div>

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

        {/* Chat overlay */}
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
      </div>

      {/* Emotes + Chat input */}
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
