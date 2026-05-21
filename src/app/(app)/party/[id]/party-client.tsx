'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Send, ExternalLink } from 'lucide-react'

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']

const PLATFORM_LABELS: Record<string, string> = {
  netflix: 'Netflix', youtube: 'YouTube', disney: 'Disney+',
  prime: 'Prime Video', max: 'Max', hulu: 'Hulu',
  appletv: 'Apple TV+', paramount: 'Paramount+',
}

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
  const channelRef = useRef<any>(null)

  const [connected, setConnected]           = useState(false)
  const [partnerPosition, setPartnerPosition] = useState<number | null>(null)
  const [partnerPlaying, setPartnerPlaying]   = useState<boolean | null>(null)
  const [partnerName, setPartnerName]         = useState<string | null>(null)
  const [messages, setMessages]             = useState<ChatMsg[]>([])
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([])
  const [chatInput, setChatInput]           = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const platformLabel = platform ? (PLATFORM_LABELS[platform] ?? platform) : null

  function formatTime(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  // ── Sync channel — listen for partner position updates ────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (payload.from === userId) return
        setPartnerPosition(payload.position)
        setPartnerPlaying(payload.state === 'playing')
        setPartnerName(profileMap[payload.from] ?? 'Partner')
      })
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId])

  // ── Chat (Postgres realtime) ───────────────────────────────────────────────
  useEffect(() => {
    // Load recent messages first
    supabase
      .from('watch_messages')
      .select('*')
      .eq('session_id', sessionId)
      .is('emote', null)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => { if (data) setMessages(data as ChatMsg[]) })

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'watch_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (change) => {
        const msg = change.new as ChatMsg
        if (msg.emote) {
          const fe: FloatingEmote = { id: msg.id, emote: msg.emote, x: 10 + Math.random() * 80 }
          setFloatingEmotes(prev => [...prev, fe])
          setTimeout(() => setFloatingEmotes(prev => prev.filter(e => e.id !== fe.id)), 3200)
        } else {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    await supabase.from('watch_messages').insert({
      session_id: sessionId, user_id: userId, body: text,
      video_position_seconds: partnerPosition ?? 0,
    })
  }

  async function sendEmote(emote: string) {
    await supabase.from('watch_messages').insert({
      session_id: sessionId, user_id: userId, emote,
      video_position_seconds: partnerPosition ?? 0,
    })
  }

  return (
    <div className="flex flex-col h-screen bg-stone-950">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-stone-950 border-b border-stone-800/60 flex-shrink-0">
        <Link href="/watch" className="text-stone-500 hover:text-amber-400 transition-colors flex-shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-amber-100 text-base truncate leading-tight">{title}</p>
          {platformLabel && (
            <p className="text-stone-500 text-xs">{platformLabel}</p>
          )}
        </div>
        {/* Sync status dot */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-stone-600'}`} />
          <span className="text-stone-500 text-xs">{connected ? 'Live' : 'Connecting'}</span>
        </div>
      </div>

      {/* Session card — thumbnail + partner status + open link */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-stone-800/60">
        <div className="flex gap-3 items-start">
          {thumbnailUrl
            ? <img src={thumbnailUrl} alt={title} className="w-14 h-20 object-cover rounded-lg flex-shrink-0" />
            : <div className="w-14 h-20 bg-stone-900 rounded-lg flex-shrink-0" />
          }
          <div className="flex-1 min-w-0 pt-0.5">
            {/* Partner status */}
            <div className="flex items-center gap-2 mb-3">
              {partnerPosition !== null ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-stone-400 text-sm truncate">{partnerName ?? 'Partner'}</span>
                  <span className="text-amber-300 text-sm font-mono">{formatTime(partnerPosition)}</span>
                  <span className="text-stone-500 text-sm">{partnerPlaying ? '▶' : '⏸'}</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-600 flex-shrink-0" />
                  <span className="text-stone-600 text-sm">Waiting for partner…</span>
                </>
              )}
            </div>

            {/* Open on streaming site */}
            {partyUrl && (
              <a
                href={partyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <ExternalLink size={12} />
                Open on {platformLabel ?? 'streaming site'}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 relative">
        {messages.length === 0 && (
          <p className="text-stone-700 text-sm text-center mt-8">No messages yet. Say something!</p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map(msg => (
            <div key={msg.id} className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-stone-400 text-xs font-medium">
                  {(profileMap[msg.user_id] ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-amber-500 text-xs font-medium">
                  {msg.user_id === userId ? 'You' : (profileMap[msg.user_id] ?? 'Partner')}
                </span>
                <p className="text-stone-200 text-sm leading-snug">{msg.body}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Floating emotes */}
        {floatingEmotes.map(fe => (
          <span
            key={fe.id}
            className="absolute text-4xl animate-float-up pointer-events-none select-none"
            style={{ left: `${fe.x}%`, bottom: '60px' }}
          >
            {fe.emote}
          </span>
        ))}
      </div>

      {/* Emotes + chat input */}
      <div className="bg-stone-950 border-t border-stone-800/60 flex-shrink-0 pb-safe">
        <div className="flex justify-center gap-1 px-3 pt-2 pb-1">
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
        <form onSubmit={sendMessage} className="flex gap-2 px-4 pb-3 pt-1">
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
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  )
}
