'use client'

import { useState } from 'react'
import { ArrowRight, Hand, MailOpen } from 'lucide-react'
import { haptic } from '@/lib/feel'
import { withName, type Predict } from '@/lib/grow-map'

// The prediction on one phone: you answer, pass it over, they answer and guess
// you, pass it back, you guess them, and it opens right there. Nothing is
// saved; it's for the two of you in the room.

type Step = 'me-self' | 'pass' | 'them-self' | 'them-guess' | 'pass-back' | 'me-guess' | 'reveal'

export default function TogetherPredict({ predict, me, partner, onNext, paper, eyebrow, option }: {
  predict: Predict
  me: string
  partner: string
  onNext: () => void
  paper: string
  eyebrow: string
  option: (on: boolean) => string
}) {
  const [step, setStep] = useState<Step>('me-self')
  const [a, setA] = useState({ mySelf: -1, theirSelf: -1, theirGuess: -1, myGuess: -1 })
  const to = (s: Step) => { haptic(); setStep(s) }
  const pick = (field: keyof typeof a, then: Step) => (k: number) => { setA(x => ({ ...x, [field]: k })); to(then) }
  const opt = (k: number) => predict.options[k] ?? ''

  const ask = (who: string, q: string, onPick: (k: number) => void, hint: string) => (
    <section className={`${paper} -rotate-[0.3deg]`}>
      <p className={eyebrow}>{who}</p>
      <p className="font-serif text-[21px] leading-snug text-[var(--paper-ink)] mt-2">{q}</p>
      <div className="mt-4 flex flex-col gap-2">
        {predict.options.map((o, k) => <button key={o} onClick={() => onPick(k)} className={option(false)}>{o}</button>)}
      </div>
      <p className="text-[12px] text-[var(--paper-muted)] mt-4">{hint}</p>
    </section>
  )

  const pass = (name: string, next: Step, line: string) => (
    <section className={`${paper} rotate-[0.4deg] text-center py-10`}>
      <Hand size={30} className="mx-auto text-[var(--paper-muted)]" />
      <p className="font-hand text-[30px] leading-tight text-[var(--paper-ink)] mt-3">Hand the phone to {name}</p>
      <p className="text-[13px] text-[var(--paper-muted)] mt-2">{line}</p>
      <button onClick={() => to(next)} className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] px-5 h-10 text-sm font-medium">
        I’m {name} <ArrowRight size={15} />
      </button>
    </section>
  )

  if (step === 'me-self') return ask(`${me}, you first`, predict.self, pick('mySelf', 'pass'), `${partner}, no peeking.`)
  if (step === 'pass') return pass(partner, 'them-self', `${me}’s answer is hidden.`)
  if (step === 'them-self') return ask(`${partner}’s turn`, predict.self, pick('theirSelf', 'them-guess'), `${me}, no peeking.`)
  if (step === 'them-guess') return ask(`${partner}, now guess ${me}`, withName(predict.q, me), pick('theirGuess', 'pass-back'), 'Then pass it back.')
  if (step === 'pass-back') return pass(me, 'me-guess', `${partner}’s answers are hidden.`)
  if (step === 'me-guess') return ask(`${me}, now guess ${partner}`, withName(predict.q, partner), pick('myGuess', 'reveal'), 'Then open it together.')

  const iGotThem = a.myGuess === a.theirSelf, theyGotMe = a.theirGuess === a.mySelf
  return (
    <section className={`${paper} -rotate-[0.4deg] animate-pop`}>
      <span className="tape -top-3 left-1/2 -translate-x-1/2" />
      <p className={`${eyebrow} flex items-center gap-1.5`}><MailOpen size={12} /> Opened, together</p>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <p className={eyebrow}>{partner} picked</p>
          <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">{opt(a.theirSelf)}</p>
          <p className="text-[12px] text-[var(--paper-muted)] mt-1">{me} guessed {opt(a.myGuess)}</p>
        </div>
        <div>
          <p className={eyebrow}>{me} picked</p>
          <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">{opt(a.mySelf)}</p>
          <p className="text-[12px] text-[var(--paper-muted)] mt-1">{partner} guessed {opt(a.theirGuess)}</p>
        </div>
      </div>
      <p className="font-hand text-[22px] leading-snug text-[var(--paper-ink)] mt-4">
        {iGotThem && theyGotMe
          ? 'You’ve both got this one mapped.'
          : !iGotThem && !theyGotMe
            ? 'Two new things on your maps. Ask each other how come?'
            : !iGotThem
            ? <>New on {me}’s map: {partner} picked “{opt(a.theirSelf)}”. Ask how come, right now?</>
            : <>New on {partner}’s map: {me} picked “{opt(a.mySelf)}”. Ask how come, right now?</>}
      </p>
      <button onClick={onNext} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--paper-ink)]">Next <ArrowRight size={15} /></button>
    </section>
  )
}
