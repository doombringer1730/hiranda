'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import WhyItWorks from '@/components/why-it-works'
import { EmptyState } from '@/components/ui'
import { haptic, celebrate } from '@/lib/feel'
import { gradeReview, type ReviewCard } from '../actions'

// Love Map review: guess what your partner said, then see. Spaced repetition
// brings back the ones you miss sooner and the ones you know later.
export default function ReviewClient({ partnerName, cards }: { partnerName: string; cards: ReviewCard[] }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [right, setRight] = useState(0)

  const card = cards[i]
  const finished = i >= cards.length

  function guess(value: string) {
    if (picked) return
    haptic()
    setPicked(value)
    const ok = value === card.answerValue
    if (ok) { setRight(r => r + 1); celebrate(null, { count: 14, spread: 0.5 }) }
    void gradeReview(card.promptId, ok)
  }

  function selfGrade(ok: boolean) {
    haptic()
    if (ok) setRight(r => r + 1)
    void gradeReview(card.promptId, ok)
    nextCard()
  }

  function nextCard() { setPicked(null); setShown(false); setI(n => n + 1) }

  return (
    <div className="px-4 pt-6 pb-12 max-w-xl mx-auto">
      <Link href="/grow" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-4"><ArrowLeft size={16} /> Grow</Link>
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.3em]">How well do you know {partnerName}?</p>
      <h1 className="font-serif text-[44px] leading-none text-amber-50 mt-2 mb-6">Love Map<span className="text-amber-500">.</span></h1>

      {cards.length === 0 ? (
        <EmptyState title="Nothing to review today." sub={`Answer more Quick Questions together — every one you both answer becomes a card about ${partnerName}.`} href="/games/questions" action="Answer a few" />
      ) : finished ? (
        <div className="paper rounded-[6px] px-6 py-10 text-center animate-rise">
          <p className="font-hand text-[34px] text-[var(--paper-ink)] leading-tight">You knew {right} of {cards.length}.</p>
          <p className="text-[var(--paper-muted)] text-sm mt-2">The ones you missed come back sooner. See you tomorrow.</p>
          <Link href="/grow" className="inline-flex mt-5 h-10 px-5 items-center rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium">Back to Grow</Link>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-5">
            {cards.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < i ? 'bg-amber-500' : k === i ? 'bg-amber-300' : 'bg-stone-800'}`} />)}
          </div>

          <div key={card.promptId} className="paper rounded-[6px] px-5 pt-6 pb-5 animate-rise -rotate-[0.4deg]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">What did {partnerName} say?</p>
            <p className="font-serif text-[26px] leading-snug text-[var(--paper-ink)] mt-2">{card.text}</p>

            {card.options ? (
              <div className="grid gap-2 mt-5">
                {card.options.map(o => {
                  const isAnswer = o.value === card.answerValue
                  const state = !picked ? '' : isAnswer ? 'border-emerald-600 bg-emerald-50' : o.value === picked ? 'border-red-400 bg-red-50' : 'opacity-50'
                  return (
                    <button key={o.value} onClick={() => guess(o.value)} disabled={!!picked}
                      className={`rounded-xl border border-[rgb(43_38_32/0.16)] bg-white/80 px-4 py-3 text-left text-[15px] text-[var(--paper-ink)] transition-colors ${state}`}>
                      {o.label}{picked && isAnswer ? '  ✓' : ''}
                    </button>
                  )
                })}
              </div>
            ) : !shown ? (
              <button onClick={() => { haptic(); setShown(true) }} className="mt-5 w-full rounded-xl border border-dashed border-[rgb(43_38_32/0.3)] px-4 py-4 font-hand text-[22px] text-[var(--paper-muted)]">
                think of their answer… then tap
              </button>
            ) : (
              <div className="mt-5 animate-rise">
                <p className="font-hand text-[26px] leading-tight text-[var(--paper-ink)]">“{card.answer}”</p>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button onClick={() => selfGrade(false)} className="rounded-xl bg-white/80 border border-[rgb(43_38_32/0.16)] py-2.5 text-sm text-[var(--paper-ink)]">Not quite</button>
                  <button onClick={() => selfGrade(true)} className="rounded-xl bg-[var(--paper-ink)] text-[var(--paper)] py-2.5 text-sm font-medium">I knew it</button>
                </div>
              </div>
            )}
          </div>

          {picked && (
            <button onClick={nextCard} className="mt-4 w-full rounded-2xl bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium py-3 animate-rise">
              {i + 1 < cards.length ? 'Next' : 'Finish'}
            </button>
          )}
        </>
      )}

      <WhyItWorks className="mt-10" source="Gottman; Cepeda et al., 2006">
        Knowing your partner’s inner world protects couples through big changes — and short, spaced reviews are how memories stick.
      </WhyItWorks>
    </div>
  )
}
