'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Lock, PenLine, X, Loader2, Heart, CalendarDays } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { Jar, SLIP_ME, SLIP_PARTNER } from '@/components/jar'
import { Scribble } from '@/components/handmade'
import WhyItWorks from '@/components/why-it-works'
import { haptic, celebrate, toast } from '@/lib/feel'
import {
  getLetters, writeLetter, openLetter, takeBackLetter, dropThanks, setThanksOpenOn,
  type LettersState, type Envelope,
} from './actions'

// The "open when…" letters trend: a stack of envelopes for the moments you
// can't be there. Suggestions only — anything can follow "open when".
const OPEN_WHEN = [
  'you miss me', 'you can’t sleep', 'you’ve had a bad day', 'you need a laugh',
  'we’ve had a fight', 'you’re proud of yourself', 'you’re nervous', 'it’s our anniversary',
]

const today = () => new Date().toISOString().slice(0, 10)
const longDate = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const sealed = (l: Envelope) => !!l.unlock_at && new Date(l.unlock_at).getTime() > Date.now()

function label(l: Envelope) {
  if (l.open_when) return `Open when ${l.open_when.replace(/^open when\s*/i, '')}`
  return l.title || 'A letter for you'
}

export default function LettersClient({ initial }: { initial: LettersState }) {
  const [state, setState] = useState(initial)
  const [tab, setTab] = useState<'for' | 'from'>('for')
  const [writing, setWriting] = useState(false)
  const [reading, setReading] = useState<{ env: Envelope; body: string } | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  async function refresh() {
    const s = await getLetters()
    if (s) setState(s)
  }

  async function open(env: Envelope) {
    haptic()
    if (sealed(env) && env.author !== state.myId) {
      toast(`Sealed until ${longDate(env.unlock_at!)} 🔒`)
      return
    }
    setOpening(env.id)
    const res = await openLetter(env.id)
    setOpening(null)
    if (!res) { toast('Couldn’t open it — try again'); return }
    if (!env.opened_at && env.recipient === state.myId) celebrate(null, { count: 18 })
    setReading({ env, body: res.body })
    if (!env.opened_at) void refresh()
  }

  const list = tab === 'for' ? state.received : state.sent
  const unopened = state.received.filter(l => !l.opened_at).length

  return (
    <div className="px-4 pb-10 pt-6 max-w-2xl md:max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-2">
        <PageHeader eyebrow="Sealed with a kiss" title="Letters" />
        <button onClick={() => { haptic(); setWriting(true) }} className="shrink-0 flex items-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 h-10 transition-colors">
          <PenLine size={15} /> Write
        </button>
      </div>
      <p className="font-hand text-[22px] text-stone-400 mb-6">for the moments you can’t be there.</p>

      {/* For you / From you */}
      <div role="tablist" className="inline-flex rounded-full material p-1 mb-5">
        {(['for', 'from'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { haptic(); setTab(t) }}
            className={`px-4 h-8 rounded-full text-[13px] font-semibold transition-colors ${tab === t ? 'bg-stone-700 text-amber-50' : 'text-stone-400'}`}>
            {t === 'for' ? `For you${unopened ? ` · ${unopened}` : ''}` : 'From you'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="paper rounded-[6px] px-6 py-10 text-center -rotate-[0.4deg]">
          <p className="font-hand text-[28px] text-[var(--paper-ink)] leading-tight">
            {tab === 'for' ? `No letters from ${state.partnerName} yet.` : 'Your first letter is waiting to be written.'}
          </p>
          <p className="text-[var(--paper-muted)] text-sm mt-2">
            {tab === 'for' ? 'When one arrives, it’ll be right here — sealed until it’s time.' : `Write an “open when…” letter ${state.partnerName} can open on a hard day.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
          {list.map((l, i) => (
            <button key={l.id} onClick={() => open(l)} className="text-left group animate-rise" style={{ '--i': i, rotate: `${[-1.5, 1, -0.5, 1.6][i % 4]}deg` } as React.CSSProperties}>
              <EnvelopeCard env={l} mine={l.author === state.myId} loading={opening === l.id} partnerName={state.partnerName} />
            </button>
          ))}
        </div>
      )}

      <ThanksJar state={state} onChange={refresh} />

      {writing && <Composer partnerName={state.partnerName} onClose={() => setWriting(false)} onSent={() => { setWriting(false); setTab('from'); void refresh() }} />}
      {reading && <Reader env={reading.env} body={reading.body} mine={reading.env.author === state.myId} partnerName={state.partnerName}
        onClose={() => setReading(null)}
        onTakeBack={async () => { await takeBackLetter(reading.env.id); setReading(null); void refresh() }} />}
    </div>
  )
}

function EnvelopeCard({ env, mine, loading, partnerName }: { env: Envelope; mine: boolean; loading: boolean; partnerName: string }) {
  const locked = sealed(env)
  const opened = !!env.opened_at
  return (
    <div className="relative">
      <div className="paper relative aspect-[3/2] rounded-[4px] overflow-hidden transition-transform duration-300 group-hover:-translate-y-0.5">
        {/* flap */}
        <div className="absolute inset-x-0 top-0 h-[58%] bg-[#efe6d4] [clip-path:polygon(0_0,100%_0,50%_100%)] shadow-[inset_0_-1px_0_rgb(0_0_0/0.06)]" />
        {/* wax seal */}
        {!opened && (
          <span className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-amber-700 text-amber-50 shadow-[0_2px_4px_rgb(0_0_0/0.3),inset_0_1px_0_rgb(255_255_255/0.25)]">
            {loading ? <Loader2 size={14} className="animate-spin" /> : locked ? <Lock size={13} /> : <Heart size={14} fill="currentColor" />}
          </span>
        )}
        {opened && (
          <span className="absolute right-2 bottom-2 rotate-[-8deg] border border-[rgb(43_38_32/0.35)] rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[var(--paper-muted)]">opened</span>
        )}
      </div>
      <p className="font-hand text-[21px] leading-[1.05] text-amber-100 mt-2 line-clamp-2">{label(env)}</p>
      <p className="text-stone-500 text-[11px] mt-0.5">
        {mine
          ? opened ? `${partnerName} opened it ${shortDate(env.opened_at!)}` : locked ? `Opens ${shortDate(env.unlock_at!)}` : 'Not opened yet'
          : locked ? `Sealed until ${shortDate(env.unlock_at!)}` : opened ? `From ${partnerName} · ${shortDate(env.created_at)}` : `From ${partnerName}`}
      </p>
    </div>
  )
}

function Sheet({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 animate-fade" />
      {children}
    </div>,
    document.body,
  )
}

function Composer({ partnerName, onClose, onSent }: { partnerName: string; onClose: () => void; onSent: () => void }) {
  const [mode, setMode] = useState<'when' | 'date'>('when')
  const [openWhen, setOpenWhen] = useState(OPEN_WHEN[0])
  const [date, setDate] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function seal() {
    setError(null)
    if (mode === 'date' && !date) { setError('Pick the day it opens'); return }
    start(async () => {
      const res = await writeLetter({
        body,
        title: mode === 'date' ? title : undefined,
        openWhen: mode === 'when' ? openWhen : undefined,
        unlockAt: mode === 'date' ? `${date}T00:00:00` : undefined,
      })
      if (res.error) { setError(res.error); return }
      haptic(); celebrate(null, { count: 20 })
      toast(`Sealed and sent to ${partnerName} 💌`)
      onSent()
    })
  }

  return (
    <Sheet onClose={onClose} label="Write a letter">
      <div className="relative w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] bg-stone-900 px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] animate-sheet">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl text-amber-50">A letter for {partnerName}</h2>
          <button onClick={onClose} aria-label="Close" className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 text-stone-300"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 rounded-full bg-stone-800/70 p-1 mb-4">
          {([['when', 'Open when…'], ['date', 'Open on a date']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setMode(k)} className={`h-8 rounded-full text-[13px] font-semibold transition-colors ${mode === k ? 'bg-stone-700 text-amber-50' : 'text-stone-400'}`}>{t}</button>
          ))}
        </div>

        {mode === 'when' ? (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {OPEN_WHEN.map(o => (
                <button key={o} onClick={() => setOpenWhen(o)} className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${openWhen === o ? 'bg-amber-700 text-amber-50' : 'bg-stone-800 text-stone-300'}`}>{o}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl bg-stone-950/60 border border-stone-800 px-3">
              <span className="text-stone-500 text-sm shrink-0">Open when</span>
              <input value={openWhen} onChange={e => setOpenWhen(e.target.value)} maxLength={70} className="flex-1 bg-transparent py-2.5 text-amber-50 focus:outline-none" />
            </label>
          </div>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 rounded-xl bg-stone-950/60 border border-stone-800 px-3">
              <CalendarDays size={15} className="text-stone-500" />
              <span className="text-stone-500 text-sm shrink-0">Opens on</span>
              <input type="date" min={today()} value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-transparent py-2.5 text-amber-50 focus:outline-none" />
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Title (optional) — e.g. For our first anniversary"
              className="rounded-xl bg-stone-950/60 border border-stone-800 px-3 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none" />
          </div>
        )}

        <div className="paper paper-ruled rounded-[6px] px-4 pt-3 pb-2">
          <p className="font-hand text-[22px] text-[var(--paper-muted)] leading-[30px]">Dear {partnerName},</p>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} maxLength={20000} placeholder="Write from the heart…"
            className="w-full bg-transparent resize-none font-hand text-[23px] leading-[30px] text-[var(--paper-ink)] placeholder:text-[rgb(43_38_32/0.3)] focus:outline-none" />
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <button onClick={seal} disabled={pending || !body.trim()} className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium py-3 transition-colors">
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Heart size={15} fill="currentColor" />} Seal it
        </button>
        <p className="text-stone-500 text-xs text-center mt-2">
          {mode === 'when' ? `${partnerName} can open it whenever they need it.` : `It stays sealed — even from peeking — until that day.`}
        </p>
      </div>
    </Sheet>
  )
}

function Reader({ env, body, mine, partnerName, onClose, onTakeBack }: {
  env: Envelope; body: string; mine: boolean; partnerName: string; onClose: () => void; onTakeBack: () => void
}) {
  return (
    <Sheet onClose={onClose} label={label(env)}>
      <div className="relative w-full md:max-w-xl max-h-[92dvh] overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] md:pb-4">
        <div className="paper paper-ruled rounded-[6px] px-6 pt-8 pb-7 animate-letter rotate-[-0.5deg]">
          <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-3" />
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">{label(env)}</p>
          {env.title && env.open_when && <p className="font-serif text-2xl text-[var(--paper-ink)] mt-1">{env.title}</p>}
          <p className="font-hand text-[25px] leading-[30px] text-[var(--paper-ink)] whitespace-pre-wrap break-words mt-3">{body}</p>
          <p className="font-hand text-[24px] text-[var(--paper-ink)] text-right mt-4">— {mine ? 'you' : partnerName} ♡</p>
          <p className="text-[11px] text-[var(--paper-muted)] text-right">{longDate(env.created_at)}</p>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={onClose} className="rounded-full bg-stone-800 text-stone-200 text-sm px-5 h-10">Close</button>
          {mine && !env.opened_at && (
            <button onClick={onTakeBack} className="rounded-full text-stone-400 hover:text-red-400 text-sm px-4 h-10">Take it back</button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function ThanksJar({ state, onChange }: { state: LettersState; onChange: () => Promise<void> }) {
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const [shake, setShake] = useState(0)
  const [editing, setEditing] = useState(false)
  const { openOn, suggestedOpenOn, slips } = state.thanks
  const opensOn = openOn ?? suggestedOpenOn
  const isOpen = !!openOn && openOn <= today()
  // Notes written before the opening day belong to this jar; later ones start the next.
  const cutoff = openOn ? new Date(openOn + 'T23:59:59').getTime() : Infinity
  const season = slips.filter(s => new Date(s.created_at).getTime() <= cutoff)
  const next = slips.filter(s => new Date(s.created_at).getTime() > cutoff)
  const shown = isOpen ? next : slips
  const mine = shown.filter(s => s.author === state.myId).length
  const theirs = shown.length - mine
  const colors = [...shown].reverse().map(s => s.author === state.myId ? SLIP_ME : SLIP_PARTNER)

  function drop() {
    const text = note.trim()
    if (!text) return
    start(async () => {
      const res = await dropThanks(text)
      if (res.error) { toast(res.error); return }
      haptic(); setNote(''); setShake(s => s + 1)
      await onChange()
    })
  }

  async function changeDate(d: string) {
    setEditing(false)
    await setThanksOpenOn(d)
    await onChange()
  }

  return (
    <section className="mt-12">
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-2">The appreciation jar</p>
      <div className="tile p-5 md:p-6 grid md:grid-cols-[auto_1fr] gap-6 items-center">
        <div className="justify-self-center text-stone-300">
          <Jar key={shake} slips={colors} size={150} shake={shake > 0} label={`${shown.length} thank-you notes in the jar`} />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-[28px] leading-tight text-amber-50">Little thank-yous, saved up.</h2>
          <p className="text-stone-400 text-sm mt-1.5 leading-relaxed">
            Drop in a note whenever {state.partnerName} does something you’re grateful for. They stay folded until the jar opens — then you read them together.
          </p>
          <p className="relative inline-block font-hand text-[22px] text-amber-200 mt-3">
            {shown.length === 0 ? 'the jar is empty — be the first' : `${mine} from you · ${theirs} from ${state.partnerName}`}
            <Scribble kind="underline" className="absolute left-0 -bottom-1.5 h-2 w-full text-amber-500/60" />
          </p>
          <p className="text-stone-500 text-xs mt-2 flex items-center gap-2 flex-wrap">
            {opensOn ? <>Opens {longDate(isOpen && next.length === 0 ? opensOn : opensOn)}</> : 'Set a day to open it'}
            {editing ? (
              <input type="date" min={today()} defaultValue={opensOn ?? ''} onChange={e => e.target.value && changeDate(e.target.value)} autoFocus className="bg-stone-950/60 border border-stone-800 rounded-lg px-2 py-1 text-amber-50 text-xs" />
            ) : (
              <button onClick={() => setEditing(true)} className="text-amber-400 hover:text-amber-300">change</button>
            )}
          </p>
          <WhyItWorks className="mt-3" source="Algoe, Gable & Maisel, 2010">
            Everyday gratitude works like a “booster shot” for relationships — noticing it makes both partners feel closer.
          </WhyItWorks>
          <div className="mt-4 flex gap-2">
            <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') drop() }} maxLength={500}
              placeholder={`Thank you for…`}
              className="flex-1 min-w-0 rounded-xl bg-stone-950/60 border border-stone-800 px-3 py-2.5 font-hand text-[21px] text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
            <button onClick={drop} disabled={pending || !note.trim()} className="shrink-0 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm font-medium px-4">
              {pending ? <Loader2 size={15} className="animate-spin" /> : 'Drop it in'}
            </button>
          </div>
        </div>
      </div>

      {isOpen && season.length > 0 && (
        <div className="mt-6">
          <p className="font-hand text-[26px] text-amber-200 mb-3">The jar is open 💛 — {season.length} notes from this year</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {season.map((s, i) => (
              <div key={s.id} className="paper rounded-[3px] px-3 py-2.5" style={{ rotate: `${[-2, 1.5, -1, 2.2, -0.5][i % 5]}deg` }}>
                <p className="font-hand text-[21px] leading-tight text-[var(--paper-ink)]">{s.body ?? '…'}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper-muted)] mt-1">{s.author === state.myId ? 'from you' : `from ${state.partnerName}`}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
