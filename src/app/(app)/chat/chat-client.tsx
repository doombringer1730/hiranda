'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { ArrowUp, PartyPopper, Heart, Loader2, X } from 'lucide-react'
import { useLive } from '@/lib/use-live'
import { haptic, celebrate } from '@/lib/feel'
import WhyItWorks from '@/components/why-it-works'
import { getMessages, sendMessage, reactTo, markRead, unsend, type Message } from './actions'

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

// Active-constructive replies to good news (Gable et al., 2004): enthusiastic
// and curious beats "nice". Offered, never required.
const CHEERS = ['Tell me everything! 🎉', 'I’m so proud of you', 'How did it feel?', 'We have to celebrate 🥂']

// Small bids for connection (Gottman) — one tap to reach for each other.
const BIDS = ['Thinking of you 💗', 'How’s your day going?', 'Miss you', 'Can’t wait to see you']

type Partner = { name: string; avatar: string | null; accent: string | null }
type Shown = Message & { pending?: boolean }

const dayKey = (iso: string) => new Date(iso).toDateString()
function dayLabel(iso: string) {
  const d = new Date(iso), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export default function ChatClient({ myId, partner }: { myId: string; partner: Partner }) {
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [latest, setLatest] = useState<Message[] | null>(null)
  const [older, setOlder] = useState<Message[]>([])
  const [more, setMore] = useState(false)
  const [pending, setPending] = useState<Shown[]>([])
  const [draft, setDraft] = useState('')
  const [goodNews, setGoodNews] = useState(false)
  const [picker, setPicker] = useState<string | null>(null)
  const [loadingOlder, startOlder] = useTransition()
  const box = useRef<HTMLTextAreaElement>(null)
  const atBottom = useRef(true)
  const cheered = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    const page = await getMessages()
    if (!page) return
    setCoupleId(page.coupleId)
    setLatest(page.messages)
    setMore(m => m || page.more)
  }, [])

  useEffect(() => {
    let live = true
    getMessages().then(page => {
      if (!live || !page) return
      setCoupleId(page.coupleId); setLatest(page.messages); setMore(page.more)
    })
    return () => { live = false }
  }, [])
  useLive({ table: 'messages', filter: coupleId ? `couple_id=eq.${coupleId}` : undefined, enabled: !!coupleId, fallbackMs: 15_000 }, refresh)

  // Merge pages by id, oldest first, then the not-yet-confirmed sends.
  const byId = new Map<string, Shown>()
  for (const m of [...older, ...(latest ?? [])]) byId.set(m.id, m)
  const confirmed = [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const all: Shown[] = [...confirmed, ...pending]

  // Seen: everything your partner sent, once the chat is on screen.
  const unseen = confirmed.some(m => m.sender !== myId && !m.read_at)
  useEffect(() => {
    if (!unseen || document.visibilityState !== 'visible') return
    const t = setTimeout(() => { void markRead() }, 600)
    return () => clearTimeout(t)
  }, [unseen, latest])

  // A little confetti the first time you see your partner's good news.
  useEffect(() => {
    const fresh = confirmed.filter(m => m.kind === 'good_news' && m.sender !== myId && !m.read_at && !cheered.current.has(m.id))
    if (!fresh.length) return
    fresh.forEach(m => cheered.current.add(m.id))
    celebrate(null, { count: 30 })
  }, [confirmed, myId])

  // Stay pinned to the newest message unless you've scrolled up to read.
  useEffect(() => {
    const onScroll = () => { atBottom.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120 }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const count = all.length
  useLayoutEffect(() => {
    if (atBottom.current) window.scrollTo({ top: document.body.scrollHeight })
  }, [count])

  async function send(text: string, kind: 'text' | 'good_news' = 'text') {
    const body = text.trim()
    if (!body) return
    haptic()
    atBottom.current = true
    const temp: Shown = { id: `tmp-${Date.now()}`, sender: myId, kind, body, reaction: null, read_at: null, created_at: new Date().toISOString(), pending: true }
    setPending(p => [...p, temp])
    const res = await sendMessage(body, kind)
    if (res.error) {
      setPending(p => p.filter(m => m.id !== temp.id))
      setDraft(body)
      return
    }
    await refresh()
    setPending(p => p.filter(m => m.id !== temp.id))
  }

  function submit() {
    const text = draft
    setDraft('')
    const kind = goodNews ? 'good_news' : 'text'
    setGoodNews(false)
    if (kind === 'good_news') celebrate(box.current, { count: 22 })
    void send(text, kind)
    box.current?.focus()
  }

  function loadOlder() {
    const first = all[0]
    if (!first) return
    startOlder(async () => {
      const page = await getMessages(first.created_at)
      if (!page) return
      const prevHeight = document.body.scrollHeight
      setOlder(o => [...page.messages, ...o])
      setMore(page.more)
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight - prevHeight + window.scrollY }))
    })
  }

  async function react(m: Message, emoji: string) {
    haptic()
    setPicker(null)
    const next = m.reaction === emoji ? null : emoji
    setLatest(l => l?.map(x => x.id === m.id ? { ...x, reaction: next } : x) ?? l)
    setOlder(o => o.map(x => x.id === m.id ? { ...x, reaction: next } : x))
    await reactTo(m.id, next)
  }

  async function remove(m: Message) {
    setPicker(null)
    setLatest(l => l?.filter(x => x.id !== m.id) ?? l)
    setOlder(o => o.filter(x => x.id !== m.id))
    await unsend(m.id)
  }

  // Your last message that your partner has seen.
  const lastMine = [...confirmed].reverse().find(m => m.sender === myId)
  // Offer cheers under your partner's most recent good news, if you haven't replied since.
  const lastMsg = confirmed[confirmed.length - 1]
  const cheerFor = lastMsg && lastMsg.sender !== myId && lastMsg.kind === 'good_news' ? lastMsg.id : null

  return (
    <div className="max-w-2xl mx-auto px-3 md:px-6 flex flex-col min-h-[calc(100dvh-96px-env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-40px)]">
      {/* Header */}
      <header className="sticky top-0 z-20 -mx-3 md:-mx-6 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-3 md:pt-5 flex items-center gap-3 bg-[color-mix(in_oklab,var(--color-stone-950)_82%,transparent)] backdrop-blur-xl">
        <span className="grid place-items-center h-10 w-10 rounded-full overflow-hidden text-sm font-semibold text-amber-50 shrink-0" style={{ background: partner.accent ?? 'var(--color-amber-800)' }}>
          {partner.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={partner.avatar} alt="" className="h-full w-full object-cover" />
            : partner.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl leading-none text-amber-50">{partner.name}</h1>
          <p className="text-stone-400 text-xs mt-1">Just the two of you</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 flex flex-col pt-2 pb-4">
        {more && (
          <button onClick={loadOlder} disabled={loadingOlder} className="self-center my-3 text-xs text-stone-400 hover:text-amber-300 flex items-center gap-1.5">
            {loadingOlder && <Loader2 size={12} className="animate-spin" />} Earlier messages
          </button>
        )}

        {latest === null && (
          <div className="flex flex-col gap-2 mt-6">
            {[60, 40, 70].map((w, i) => <div key={i} className={`skeleton h-10 rounded-[20px] ${i % 2 ? 'self-end' : ''}`} style={{ width: `${w}%` }} />)}
          </div>
        )}

        {latest !== null && all.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
            <p className="font-hand text-[30px] text-amber-200 leading-tight">say anything.</p>
            <p className="text-stone-400 text-sm mt-2 max-w-xs">It’s just the two of you here — no one else will ever read it.</p>
            <WhyItWorks className="mt-6 max-w-xs" source="Gottman & Levenson">
              Couples who stayed together answered each other’s small bids for attention 86% of the time; those who split, 33%.
            </WhyItWorks>
          </div>
        )}

        {all.map((m, i) => {
          const mine = m.sender === myId
          const prev = all[i - 1]
          const next = all[i + 1]
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at)
          const gap = (a?: Shown, b?: Shown) => !a || !b || a.sender !== b.sender || Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) > 5 * 60_000
          const first = newDay || gap(prev, m)
          const last = gap(m, next) || (next && dayKey(next.created_at) !== dayKey(m.created_at))
          const open = picker === m.id

          return (
            <div key={m.id} className="flex flex-col">
              {newDay && (
                <p className="self-center my-4 font-serif italic text-stone-400 text-sm">{dayLabel(m.created_at)}</p>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${first ? 'mt-2' : 'mt-0.5'}`}>
                <button
                  type="button"
                  onClick={() => { if (!m.pending) { haptic(); setPicker(open ? null : m.id) } }}
                  className={`relative max-w-[82%] text-left animate-bubble ${m.pending ? 'opacity-60' : ''}`}
                  aria-label={mine ? 'Your message — tap for options' : 'Tap to react'}
                >
                  {m.kind === 'good_news' ? (
                    <div className="paper rounded-[18px] px-4 pt-3 pb-3.5 min-w-[200px]">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700 flex items-center gap-1.5"><PartyPopper size={12} /> Good news</p>
                      <p className="font-serif text-[20px] leading-snug text-[var(--paper-ink)] mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  ) : (
                    <div className={`px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words ${
                      mine
                        ? `bg-amber-700 text-amber-50 rounded-[22px] ${last ? 'rounded-br-[8px]' : ''}`
                        : `bg-stone-800 text-amber-50 rounded-[22px] ${last ? 'rounded-bl-[8px]' : ''}`
                    }`}>
                      {m.body}
                    </div>
                  )}
                  {m.reaction && (
                    <span className={`absolute -bottom-2.5 ${mine ? 'left-2' : 'right-2'} grid place-items-center h-6 min-w-6 px-1 rounded-full bg-stone-900 ring-2 ring-stone-950 text-[13px] animate-pop`}>
                      {m.reaction}
                    </span>
                  )}
                </button>
              </div>

              {open && (
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mt-2 animate-fade`}>
                  <div className="material rounded-full p-1 flex items-center gap-0.5">
                    {mine ? (
                      <button onClick={() => remove(m)} className="px-3 h-9 rounded-full text-sm text-stone-300 hover:bg-stone-800">Unsend</button>
                    ) : REACTIONS.map(r => (
                      <button key={r} onClick={() => react(m, r)} className={`h-9 w-9 rounded-full text-lg hover:bg-stone-800 ${m.reaction === r ? 'bg-stone-800' : ''}`} aria-label={`React ${r}`}>{r}</button>
                    ))}
                    <span className="text-[11px] text-stone-500 px-2">{time(m.created_at)}</span>
                  </div>
                </div>
              )}

              {m.id === lastMine?.id && m.read_at && !m.pending && (
                <p className={`self-end text-[11px] text-stone-500 mt-1 ${m.reaction ? 'mt-3' : ''}`}>Seen</p>
              )}
              {m.id === cheerFor && (
                <div className="flex flex-wrap gap-1.5 mt-3 animate-rise">
                  {CHEERS.map(c => (
                    <button key={c} onClick={() => send(c)} className="rounded-full bg-amber-700/20 text-amber-200 hover:bg-amber-700/30 px-3 py-1.5 text-[13px] transition-colors">{c}</button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-4 z-20 pb-2">
        {latest !== null && all.length < 3 && !draft && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
            {BIDS.map(b => (
              <button key={b} onClick={() => send(b)} className="shrink-0 rounded-full material px-3 py-1.5 text-[13px] text-stone-200">{b}</button>
            ))}
          </div>
        )}
        <div className={`material rounded-[26px] p-1.5 flex items-end gap-1.5 transition-shadow ${goodNews ? 'ring-2 ring-amber-500/60' : ''}`}>
          <button
            type="button"
            onClick={() => { haptic(); setGoodNews(g => !g); box.current?.focus() }}
            aria-pressed={goodNews}
            aria-label="Share as good news"
            title="Share good news"
            className={`grid place-items-center h-10 w-10 shrink-0 rounded-full transition-colors ${goodNews ? 'bg-amber-600 text-amber-50' : 'text-stone-400 hover:text-amber-300 hover:bg-stone-800'}`}
          >
            {goodNews ? <X size={17} /> : <PartyPopper size={18} />}
          </button>
          <textarea
            ref={box}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) {
                e.preventDefault(); submit()
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={goodNews ? 'Share your good news…' : `Message ${partner.name}`}
            className="flex-1 min-h-10 max-h-36 resize-none bg-transparent px-2 py-2.5 text-[15px] text-amber-50 placeholder:text-stone-500 focus:outline-none [field-sizing:content]"
          />
          {draft.trim() ? (
            <button type="button" onClick={submit} aria-label="Send" className="grid place-items-center h-10 w-10 shrink-0 rounded-full bg-amber-600 text-amber-50 animate-pop">
              <ArrowUp size={18} />
            </button>
          ) : (
            <button type="button" onClick={() => send('💗')} aria-label="Send a heart" className="grid place-items-center h-10 w-10 shrink-0 rounded-full text-pink-400 hover:bg-pink-500/15">
              <Heart size={18} fill="currentColor" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
