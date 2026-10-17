'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, MailOpen } from 'lucide-react'
import { haptic, toast } from '@/lib/feel'
import { withName, type Guess, type Predict } from '@/lib/grow-map'
import { answerPrediction, completeLesson } from '../../actions'

// One map stop, dealt one card at a time: Guess → Learn → Predict (you, then
// them) → the sealed note → Do → Reflect. Nothing is scored: a guess shows the
// answer warmly, and a prediction is a discovery, never right or wrong.

type Pair = { mine: number; guess: number }
type Card = 'guess' | 'learn' | 'self' | 'them' | 'sealed' | 'do' | 'reflect'

export default function LessonClient({ stop, route, position, partnerName, done, notes, answers, next }: {
  stop: { key: string; title: string; guess: Guess | null; learn: string; source: string; caveat: string | null; predict: Predict | null; do: { text: string; href?: string; label?: string }; reflect: string }
  route: { key: string; title: string; emoji: string; color: string; safety: string | null }
  position: { n: number; of: number }
  partnerName: string
  done: { me: boolean; them: boolean }
  notes: { mine: string | null; theirs: string | null }
  answers: { mine: Pair | null; theirs: Pair | null }
  next: { key: string; title: string } | null
}) {
  const router = useRouter()
  const p = partnerName
  // Answered predictions skip straight to the note.
  const cards: Card[] = [
    ...(stop.guess && !done.me ? ['guess' as const] : []),
    'learn',
    ...(stop.predict ? (answers.mine ? ['sealed' as const] : ['self' as const, 'them' as const, 'sealed' as const]) : []),
    'do', 'reflect',
  ]
  const [i, setI] = useState(done.me ? cards.length - 1 : 0)
  const card = cards[i]
  const go = (n = i + 1) => { haptic(); setI(Math.min(cards.length - 1, n)) }

  const [guessPick, setGuessPick] = useState<number | null>(null)
  const [self, setSelf] = useState<number | null>(answers.mine?.mine ?? null)
  const [mine, setMine] = useState<Pair | null>(answers.mine)
  const [theirs, setTheirs] = useState<Pair | null>(answers.theirs)
  const [note, setNote] = useState(notes.mine ?? '')
  const [finished, setFinished] = useState(done.me)
  const [pending, start] = useTransition()

  function seal(guess: number) {
    if (self === null) return
    start(async () => {
      const res = await answerPrediction(stop.key, self, guess)
      if ('error' in res && res.error) { toast(res.error); return }
      setMine({ mine: self, guess })
      if ('theirs' in res && res.theirs) setTheirs(res.theirs)
      go()
    })
  }

  function finish() {
    start(async () => {
      const res = await completeLesson(stop.key, note)
      if ('error' in res && res.error) { toast(res.error); return }
      setFinished(true)
      if ('together' in res && res.together) toast(`You finished this one together with ${p} 💛`)
      router.refresh()
    })
  }

  const paper = 'paper rounded-[6px] px-5 pt-6 pb-5 relative'
  const eyebrow = 'text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]'
  const option = (on: boolean) => `w-full text-left rounded-xl border px-4 py-3 text-[15px] text-[var(--paper-ink)] transition-colors ${on ? 'border-[var(--paper-ink)] bg-white' : 'border-[rgb(43_38_32/0.16)] bg-white/70 hover:bg-white'}`
  const primary = 'w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50'
  const opt = (k: number) => stop.predict?.options[k] ?? ''

  return (
    <div className="px-4 pt-6 pb-12 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/grow" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm"><ArrowLeft size={16} /> The map</Link>
        {!finished && <Link href="/grow" className="text-stone-500 hover:text-stone-300 text-xs">Save for later</Link>}
      </div>

      {/* where you are: one dash per card, in the route's ink */}
      <div className="flex gap-1.5 mb-5" aria-label={`Card ${i + 1} of ${cards.length}`}>
        {cards.map((c, n) => (
          <span key={c} className="h-1.5 flex-1 rounded-full transition-colors duration-500" style={{ background: n <= i ? route.color : 'var(--color-stone-800)' }} />
        ))}
      </div>

      <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">{route.emoji} {route.title} · stop {position.n} of {position.of}</p>
      <h1 className="font-serif text-[36px] leading-[1.05] text-amber-50 mt-1 mb-5">{stop.title}</h1>

      <div key={card} className="animate-rise">
        {card === 'guess' && stop.guess && (
          <section className={`${paper} -rotate-[0.4deg]`}>
            <span className="tape -top-3 left-6 -rotate-6" />
            <p className={eyebrow}>A guess, just for fun</p>
            <p className="font-serif text-[21px] leading-snug text-[var(--paper-ink)] mt-2">{stop.guess.q}</p>
            <div className="mt-4 flex flex-col gap-2">
              {stop.guess.options.map((o, k) => (
                <button key={o} disabled={guessPick !== null} onClick={() => { haptic(); setGuessPick(k) }}
                  className={option(guessPick !== null && k === stop.guess!.answer)}>
                  {o}{guessPick !== null && k === stop.guess!.answer && <Check size={15} className="inline ml-2 -mt-0.5" />}
                </button>
              ))}
            </div>
            {guessPick !== null && (
              <p className="font-hand text-[22px] leading-snug text-[var(--paper-ink)] mt-4 animate-rise">{stop.guess.reveal}</p>
            )}
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => go()} className="text-sm text-[var(--paper-muted)]">Skip</button>
              {guessPick !== null && <button onClick={() => go()} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--paper-ink)]">Next <ArrowRight size={15} /></button>}
            </div>
          </section>
        )}

        {card === 'learn' && (
          <section className={`${paper} rotate-[0.3deg]`}>
            <span className="tape -top-3 right-8 rotate-6" />
            <p className={eyebrow}>Learn</p>
            <p className="font-serif text-[20px] leading-relaxed text-[var(--paper-ink)] mt-2">{stop.learn}</p>
            <p className="text-[11px] text-[var(--paper-muted)] mt-3">— {stop.source}{stop.caveat ? ` · ${stop.caveat}` : ''}</p>
            {route.safety && <p className="mt-4 rounded-lg bg-[rgb(43_38_32/0.06)] px-3 py-2 text-[12px] leading-snug text-[var(--paper-muted)]">{route.safety}</p>}
            <button onClick={() => go()} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--paper-ink)]">Next <ArrowRight size={15} /></button>
          </section>
        )}

        {card === 'self' && stop.predict && (
          <section className={`${paper} -rotate-[0.3deg]`}>
            <p className={eyebrow}>You first</p>
            <p className="font-serif text-[21px] leading-snug text-[var(--paper-ink)] mt-2">{stop.predict.self}</p>
            <div className="mt-4 flex flex-col gap-2">
              {stop.predict.options.map((o, k) => <button key={o} onClick={() => { haptic(); setSelf(k) }} className={option(self === k)}>{o}</button>)}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => go(cards.indexOf('do'))} className="text-sm text-[var(--paper-muted)]">Skip this one</button>
              <button disabled={self === null} onClick={() => go()} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--paper-ink)] disabled:opacity-40">Next <ArrowRight size={15} /></button>
            </div>
          </section>
        )}

        {card === 'them' && stop.predict && (
          <section className={`${paper} rotate-[0.3deg]`}>
            <p className={eyebrow}>Now guess {p}</p>
            <p className="font-serif text-[21px] leading-snug text-[var(--paper-ink)] mt-2">{withName(stop.predict.q, p)}</p>
            <div className="mt-4 flex flex-col gap-2">
              {stop.predict.options.map((o, k) => (
                <button key={o} disabled={pending} onClick={() => { haptic(); seal(k) }} className={option(false)}>
                  {o}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[var(--paper-muted)] mt-4">Both answers stay sealed until {p} answers too.</p>
          </section>
        )}

        {card === 'sealed' && mine && (
          theirs ? (
            <section className={`${paper} -rotate-[0.4deg] animate-pop`}>
              <span className="tape -top-3 left-1/2 -translate-x-1/2" />
              <p className={`${eyebrow} flex items-center gap-1.5`}><MailOpen size={12} /> Opened</p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className={eyebrow}>{p} picked</p>
                  <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">{opt(theirs.mine)}</p>
                  <p className="text-[12px] text-[var(--paper-muted)] mt-1">you guessed {opt(mine.guess)}</p>
                </div>
                <div>
                  <p className={eyebrow}>You picked</p>
                  <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">{opt(mine.mine)}</p>
                  <p className="text-[12px] text-[var(--paper-muted)] mt-1">{p} guessed {opt(theirs.guess)}</p>
                </div>
              </div>
              <p className="font-hand text-[22px] leading-snug text-[var(--paper-ink)] mt-4">
                {mine.guess === theirs.mine
                  ? 'You’ve got this one mapped.'
                  : <>New on your map: {p} picked “{opt(theirs.mine)}”. Ask them how come?</>}
              </p>
              <button onClick={() => go()} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--paper-ink)]">Next <ArrowRight size={15} /></button>
            </section>
          ) : (
            <section className={`${paper} rotate-[0.4deg]`}>
              <p className={eyebrow}>Sealed</p>
              <p className="font-hand text-[24px] leading-snug text-[var(--paper-ink)] mt-2">Your answers are folded up and waiting. They open when {p} answers too, and you’ll both see them side by side.</p>
              <button onClick={() => go()} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--paper-ink)]">Next <ArrowRight size={15} /></button>
            </section>
          )
        )}

        {card === 'do' && (
          <section className="flex flex-col gap-3">
            <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em]">Do it, for real</p>
            <div className="tile p-4" style={{ background: `linear-gradient(110deg, color-mix(in oklab, ${route.color} 26%, transparent), transparent 75%), color-mix(in oklab, var(--color-stone-900) 80%, transparent)` }}>
              <p className="text-amber-50 text-[16px] leading-snug">{stop.do.text}</p>
              {stop.do.href && (
                <Link href={stop.do.href} className="mt-3 inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 text-sm">{stop.do.label ?? 'Open'} <ArrowRight size={14} /></Link>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 text-xs">Done it, or doing it later? Either way:</span>
              <button onClick={() => go()} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-200">Next <ArrowRight size={15} /></button>
            </div>
          </section>
        )}

        {card === 'reflect' && (
          <section className="flex flex-col gap-4">
            <div className="paper paper-ruled rounded-[6px] px-4 pt-3 pb-2">
              <p className="font-hand text-[21px] text-[var(--paper-muted)] leading-[30px]">{stop.reflect}</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} aria-label={stop.reflect}
                className="w-full bg-transparent resize-none font-hand text-[23px] leading-[30px] text-[var(--paper-ink)] focus:outline-none" />
            </div>
            <p className="text-stone-500 text-xs -mt-2">Optional. {p} sees it once you’ve both finished this stop.</p>
            <button onClick={finish} disabled={pending} className={primary}
              style={{ background: route.color, boxShadow: `0 5px 0 color-mix(in oklab, ${route.color} 55%, black)` }}>
              {pending ? <Loader2 size={17} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
              {finished ? 'Save my note' : 'Finish this stop'}
            </button>

            <div className="tile p-4">
              {done.them ? (
                <>
                  <p className="text-amber-200 text-sm">{p} finished this one{finished ? ': you did it together 💛' : '.'}</p>
                  {finished && notes.theirs && <p className="font-hand text-[22px] text-amber-100 mt-2 leading-tight">“{notes.theirs}”</p>}
                </>
              ) : (
                <p className="text-stone-400 text-sm">{finished ? `It counts together whenever ${p} gets to it.` : `${p} hasn’t been here yet.`}</p>
              )}
            </div>

            {finished && next && (
              <Link href={`/grow/lesson/${next.key}`} className="flex items-center justify-between text-amber-300 hover:text-amber-200 text-sm px-1">
                <span>Next stop: {next.title}</span><ArrowRight size={16} />
              </Link>
            )}
          </section>
        )}
      </div>

      {i > 0 && card !== 'them' && (
        <button onClick={() => setI(i - 1)} className="mt-6 text-stone-500 hover:text-stone-300 text-xs">← Back a card</button>
      )}
    </div>
  )
}
