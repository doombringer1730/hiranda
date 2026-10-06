'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { MessagesSquare, Minus, Plus, X, Loader2 } from 'lucide-react'
import { useLive } from '@/lib/use-live'
import { haptic, celebrate } from '@/lib/feel'
import { getTalkState, startTalk, stretchTalk, endTalk, type TalkState, type TalkSession } from './talk-actions'

const PRESETS = [5, 10, 15, 20, 30]
const DEFAULT_MINUTES = 15

// Optional nudges for when the silence feels big. One a day, same for both.
const STARTERS = [
  'What’s been taking up the most space in your head lately?',
  'Best and hardest part of your week so far?',
  'Something you’ve been meaning to tell me.',
  'What are you looking forward to right now?',
  'What would make tomorrow a good day for you?',
  'A moment with me recently that you loved.',
  'Anything you’re worried about that you haven’t said out loud?',
  'What do you need a little more of from me?',
  'Something that made you laugh this week.',
  'A dream you haven’t told me about yet.',
  'How are you, really?',
  'Something you’re quietly proud of lately.',
  'One thing we should do together soon.',
  'Anything you want to clear up between us?',
]

// Shown one at a time while the timer runs.
const TIPS = [
  'Phones face down. This time is just for you two.',
  'Listen to understand, not to reply.',
  'No fixing unless they ask — just hear each other.',
  'Anything goes: a worry, a win, a weird thought.',
  'Ask “what else?” before changing the subject.',
  'Say one thing you appreciated about them today.',
  'Comfortable silence counts too.',
  'Try “I feel…” instead of “you always…”.',
]

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

const endsAt = (s: TalkSession) => new Date(s.started_at).getTime() + s.minutes * 60_000
const isRunning = (s: TalkSession, now: number) => !s.ended_at && endsAt(s) > now
// Ran its course, or was ended past halfway (the server sets `completed`).
const counts = (s: TalkSession, now: number) => s.completed || (!s.ended_at && endsAt(s) <= now)

function clock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

// Consecutive local days with a talk, ending today (or yesterday, as grace).
function streakOf(days: Set<string>) {
  const d = new Date()
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(localDay(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

// A soft two-note bell. The AudioContext is created during a tap (iOS only
// allows sound that way) and kept for when the timer ends.
function useChime() {
  const ctx = useRef<AudioContext | null>(null)
  const unlock = useCallback(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx.current ??= new AC()
      void ctx.current.resume()
    } catch { /* no sound, no problem */ }
  }, [])
  const play = useCallback(() => {
    const a = ctx.current
    if (!a) return
    try {
      ;[659.25, 987.77].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain()
        o.type = 'sine'; o.frequency.value = f
        const t = a.currentTime + i * 0.35
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
        o.connect(g).connect(a.destination)
        o.start(t); o.stop(t + 2.5)
      })
    } catch { /* best effort */ }
  }, [])
  return { unlock, play }
}

// Keep the screen awake while the timer is showing, so it can chime.
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const grab = () => navigator.wakeLock.request('screen').then(l => { if (cancelled) void l.release(); else lock = l }).catch(() => {})
    grab()
    const again = () => { if (document.visibilityState === 'visible') grab() }
    document.addEventListener('visibilitychange', again)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', again); void lock?.release() }
  }, [on])
}

export default function TalkTime({ myId, partnerName }: { myId: string; partnerName: string }) {
  const [state, setState] = useState<TalkState | null | undefined>(undefined)
  const [offset, setOffset] = useState(0) // server clock minus this phone's clock
  const [now, setNow] = useState(() => Date.now())
  const [picked, setPicked] = useState<number | null>(null)
  const [custom, setCustom] = useState(false)
  const [draft, setDraft] = useState<string | null>(null) // custom box while typing
  const [openId, setOpenId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const finishing = useRef<string | null>(null)
  const { unlock, play } = useChime()

  const refresh = useCallback(async () => {
    const fresh = await getTalkState()
    if (fresh) setOffset(fresh.serverNow - Date.now())
    setState(fresh)
  }, [])

  useEffect(() => {
    let live = true
    getTalkState().then(fresh => {
      if (!live) return
      if (fresh) setOffset(fresh.serverNow - Date.now())
      setState(fresh)
    })
    return () => { live = false }
  }, [])
  useLive({ table: 'talk_sessions', filter: state ? `couple_id=eq.${state.coupleId}` : undefined, enabled: !!state }, refresh)

  const sessions = state?.sessions ?? []
  const t = now + offset
  const latest = sessions[0]
  const active = latest && isRunning(latest, t) ? latest : null
  const open = openId ? sessions.find(s => s.id === openId) ?? null : null

  // Tick while something is counting down.
  useEffect(() => {
    if (!active && !open) return
    const i = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(i)
  }, [active, open])

  // Time's up: mark it done (whichever phone gets there first), and chime
  // if the timer is on screen.
  useEffect(() => {
    if (!latest || latest.ended_at || endsAt(latest) > t || finishing.current === latest.id) return
    finishing.current = latest.id
    if (openId === latest.id) {
      play(); haptic(); celebrate(null, { count: 24 })
    }
    void endTalk(latest.id, true).then(refresh)
  }, [latest, t, openId, play, refresh])

  useWakeLock(!!open && !!active && open.id === active.id)

  if (state === null) return null
  if (state === undefined) return <div className="skeleton h-44 rounded-[28px]" />

  const today = localDay(new Date(t))
  const talkedDays = new Set(sessions.filter(s => counts(s, t)).map(s => localDay(new Date(s.started_at))))
  const talkedToday = talkedDays.has(today)
  const streak = streakOf(talkedDays)
  const minutes = picked ?? latest?.minutes ?? DEFAULT_MINUTES
  const starter = STARTERS[hash(`${state.coupleId}:${today}`) % STARTERS.length]
  const minutesToday = sessions
    .filter(s => counts(s, t) && localDay(new Date(s.started_at)) === today)
    .reduce((n, s) => n + (s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000) : s.minutes), 0)

  function start() {
    haptic(); unlock()
    startTransition(async () => {
      await startTalk(minutes)
      const fresh = await getTalkState()
      if (fresh) { setOffset(fresh.serverNow - Date.now()); setState(fresh); setOpenId(fresh.sessions[0]?.id ?? null) }
    })
  }

  function join() {
    if (!active) return
    haptic(); unlock(); setOpenId(active.id)
  }

  const eyebrow = 'text-[10px] uppercase tracking-[0.25em]'

  return (
    <section className="tile h-full p-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className={`${eyebrow} text-amber-300/80 flex items-center gap-2`}><MessagesSquare size={12} /> Talk time</p>
          {streak >= 2 && <p className="text-stone-400 text-[11px]">🔥 {streak} days in a row</p>}
        </div>

        {active ? (
          <>
            <p className="font-serif text-2xl text-amber-50 leading-snug">
              {active.started_by === myId ? 'You’re talking' : `${partnerName} started talk time`}
            </p>
            <p className="text-stone-400 text-sm tabular-nums">{clock(endsAt(active) - t)} left of {active.minutes} min</p>
            <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
              <div className="h-full bg-amber-500 transition-[width] duration-500" style={{ width: `${Math.min(100, ((t - new Date(active.started_at).getTime()) / (active.minutes * 60_000)) * 100)}%` }} />
            </div>
          </>
        ) : talkedToday ? (
          <>
            <p className="font-serif text-2xl text-amber-50 leading-snug">You two talked today 💛</p>
            <p className="text-stone-400 text-sm">{minutesToday} minute{minutesToday === 1 ? '' : 's'} of just each other. Same again tomorrow?</p>
          </>
        ) : (
          <>
            <p className="font-serif text-2xl text-amber-50 leading-snug">{minutes} minutes, just you two</p>
            <p className="text-stone-400 text-sm leading-relaxed">Phones down. Say whatever you want to each other — no agenda, no fixing, just listening.</p>
            <p className="text-stone-500 text-xs leading-relaxed">Stuck? Try: <span className="text-stone-300">{starter}</span></p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 md:w-72 shrink-0">
        {active ? (
          <button onClick={join} className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium rounded-xl px-5 py-3 transition-colors">
            {active.started_by === myId ? 'Open timer' : 'Join'}
          </button>
        ) : (
          <>
            {!talkedToday && (
              <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="How long">
                {PRESETS.map(p => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={!custom && minutes === p}
                    onClick={() => { haptic(); setCustom(false); setPicked(p) }}
                    className={`rounded-full py-1.5 text-xs tabular-nums transition-colors ${!custom && minutes === p ? 'bg-amber-700 text-amber-50' : 'bg-stone-800/70 text-stone-300 hover:bg-stone-800'}`}
                  >
                    {p}m
                  </button>
                ))}
                <button
                  role="radio"
                  aria-checked={custom || !PRESETS.includes(minutes)}
                  onClick={() => { haptic(); setCustom(true) }}
                  className={`rounded-full py-1.5 text-[11px] transition-colors ${custom || !PRESETS.includes(minutes) ? 'bg-amber-700 text-amber-50' : 'bg-stone-800/70 text-stone-300 hover:bg-stone-800'}`}
                >
                  {!custom && !PRESETS.includes(minutes) ? `${minutes}m` : 'Custom'}
                </button>
              </div>
            )}
            {custom && !talkedToday && (
              <div className="flex items-center gap-2">
                <button aria-label="Less time" onClick={() => { setDraft(null); setPicked(Math.max(1, minutes - (minutes > 10 ? 5 : 1))) }} className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 text-stone-200"><Minus size={14} /></button>
                <label className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-stone-950/70 border border-stone-800 py-1.5">
                  <input
                    type="number" inputMode="numeric" min={1} max={180} value={draft ?? minutes}
                    onChange={e => {
                      setDraft(e.target.value)
                      const n = Math.round(Number(e.target.value))
                      if (n >= 1 && n <= 180) setPicked(n)
                    }}
                    onBlur={() => setDraft(null)}
                    className="w-12 bg-transparent text-center text-amber-50 tabular-nums focus:outline-none"
                    aria-label="Minutes"
                  />
                  <span className="text-stone-500 text-xs">min</span>
                </label>
                <button aria-label="More time" onClick={() => { setDraft(null); setPicked(Math.min(180, minutes + (minutes >= 10 ? 5 : 1))) }} className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 text-stone-200"><Plus size={14} /></button>
              </div>
            )}
            <button
              onClick={start}
              disabled={isPending}
              className={`w-full flex items-center justify-center gap-2 text-sm font-medium rounded-xl px-5 py-3 transition-colors disabled:opacity-60 ${talkedToday ? 'bg-stone-800 hover:bg-stone-700 text-stone-200' : 'bg-amber-700 hover:bg-amber-600 text-amber-50'}`}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {talkedToday ? 'Go again' : `Start ${minutes} minute${minutes === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>

      {open && <TalkOverlay session={open} now={t} myId={myId} partnerName={partnerName} onClose={() => setOpenId(null)} onChange={refresh} />}
    </section>
  )
}

function TalkOverlay({ session, now, myId, partnerName, onClose, onChange }: {
  session: TalkSession
  now: number
  myId: string
  partnerName: string
  onClose: () => void
  onChange: () => Promise<void>
}) {
  const [busy, startTransition] = useTransition()
  const total = session.minutes * 60_000
  const elapsed = now - new Date(session.started_at).getTime()
  const done = !!session.ended_at || elapsed >= total
  const progress = done ? 1 : Math.min(1, Math.max(0, elapsed / total))
  const tip = TIPS[Math.floor(Math.max(0, elapsed) / 45_000) % TIPS.length]
  const halfway = !done && progress >= 0.5 && progress < 0.58
  const talked = Math.max(1, Math.round(((session.ended_at ? new Date(session.ended_at).getTime() : Math.min(now, new Date(session.started_at).getTime() + total)) - new Date(session.started_at).getTime()) / 60_000))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const R = 120, C = 2 * Math.PI * R

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Talk time" className="fixed inset-0 z-[70] bg-stone-950/95 backdrop-blur-xl flex flex-col items-center justify-center px-6 animate-fade">
      <button onClick={onClose} aria-label={done ? 'Close' : 'Hide timer'} className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] grid place-items-center h-10 w-10 rounded-full bg-stone-800/80 text-stone-300">
        <X size={18} />
      </button>

      <p className="text-amber-300/80 text-[10px] uppercase tracking-[0.3em] mb-8">
        {done ? 'Talk time' : session.started_by === myId ? 'Talk time' : `Talk time · started by ${partnerName}`}
      </p>

      <div className="relative h-[260px] w-[260px]">
        <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="130" cy="130" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-stone-800" />
          <circle
            cx="130" cy="130" r={R} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
            className="text-amber-500 transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          {done ? (
            <>
              <p className="font-serif text-5xl text-amber-50">Done</p>
              <p className="text-stone-400 text-sm mt-2">💛</p>
            </>
          ) : (
            <>
              <p className="font-serif text-6xl text-amber-50 tabular-nums" role="timer">{clock(total - elapsed)}</p>
              <p className="text-stone-500 text-xs mt-2">of {session.minutes} min</p>
            </>
          )}
        </div>
      </div>

      <p key={done ? 'done' : halfway ? 'half' : tip} className="mt-10 max-w-xs text-center text-stone-300 text-base leading-relaxed min-h-[3.5rem] animate-page-in">
        {done
          ? session.completed || !session.ended_at
            ? `That was ${talked} minute${talked === 1 ? '' : 's'} of just you two.`
            : 'Cut short today — that’s okay. Try again tomorrow.'
          : halfway
            ? 'Halfway. If one of you has done most of the talking, switch.'
            : tip}
      </p>

      <div className="mt-8 flex gap-3">
        {done ? (
          <button onClick={onClose} className="rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-8 py-3 transition-colors">Close</button>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => { haptic(); startTransition(async () => { await stretchTalk(session.id, 5); await onChange() }) }}
              className="rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium px-5 py-3 transition-colors disabled:opacity-60"
            >
              +5 min
            </button>
            <button
              disabled={busy}
              onClick={() => { haptic(); startTransition(async () => { await endTalk(session.id, false); await onChange() }) }}
              className="rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium px-5 py-3 transition-colors disabled:opacity-60"
            >
              End
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
