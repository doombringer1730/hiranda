'use client'

import { useState, useEffect, useTransition } from 'react'
import { useLive } from '@/lib/use-live'
import { Loader2, Lock, Sparkles } from 'lucide-react'
import { getDailyPrompt, type DailyPrompt } from './daily-actions'
import { submitResponse, getPromptState } from './games/actions'
import { haptic, celebrate } from '@/lib/feel'
import { Scribble } from '@/components/handmade'

function localDay() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DailyQuestion({ myId, partnerId, partnerName }: {
  myId: string
  partnerId: string
  partnerName: string
}) {
  const [daily, setDaily] = useState<DailyPrompt | null | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  // The day comes from the browser so the question turns over at local midnight.
  useEffect(() => {
    let live = true
    getDailyPrompt(localDay()).then(d => { if (live) setDaily(d) })
    return () => { live = false }
  }, [])

  const waiting = !!(daily?.myResponse && !daily.partnerResponse)
  const promptId = daily?.prompt.id

  // While waiting on the partner, listen for their answer so the reveal
  // appears the moment it lands (realtime, with a slow fallback poll).
  useLive({ table: 'prompt_responses', filter: promptId ? `prompt_id=eq.${promptId}` : undefined, enabled: waiting && !!promptId }, async () => {
    if (!promptId) return
    const fresh = await getPromptState(promptId)
    if (fresh?.partnerResponse) {
      if (fresh.myResponse === fresh.partnerResponse && fresh.prompt.type !== 'question') celebrate()
      setDaily(fresh)
    }
  })

  if (daily === null) return null

  if (daily === undefined) {
    return <div className="skeleton h-full min-h-56 rounded-[6px]" />
  }

  const { prompt, myResponse, partnerResponse } = daily
  const both = !!(myResponse && partnerResponse)

  function answer(value: string) {
    const v = value.trim()
    if (!v || !daily) return
    haptic()
    startTransition(async () => {
      await submitResponse(prompt.id, v)
      if (daily.partnerResponse && daily.partnerResponse === v && prompt.type !== 'question') celebrate()
      setDaily({ ...daily, myResponse: v })
    })
  }

  // most_likely answers are user ids.
  const label = (r: string | null, mine: boolean) => {
    if (prompt.type !== 'most_likely' || !r) return r
    if (r === myId) return mine ? 'Me' : 'You'
    if (r === partnerId) return mine ? partnerName : 'Themselves'
    return r
  }

  const choices =
    prompt.type === 'most_likely' ? [{ value: myId, text: 'Me' }, { value: partnerId, text: partnerName }]
    : prompt.option_a && prompt.option_b ? [{ value: prompt.option_a, text: prompt.option_a }, { value: prompt.option_b, text: prompt.option_b }]
    : null

  // An index card taped to the page: paper and ink in every theme, with
  // answers written by hand.
  const ink = 'text-[var(--paper-ink)]', muted = 'text-[var(--paper-muted)]'
  return (
    <section className="paper paper-ruled rounded-[6px] h-full px-5 pt-7 pb-5 flex flex-col gap-4 -rotate-[0.6deg]">
      <span className="tape -top-3 left-8 -rotate-[5deg]" />
      <div className="flex items-center justify-between gap-3">
        <p className={`${muted} text-[11px] uppercase tracking-[0.22em] flex items-center gap-2`}>
          <Sparkles size={12} /> Today&rsquo;s question
        </p>
        <p className={`${muted} text-[11px]`}>
          {both ? 'revealed' : myResponse ? 'you answered' : partnerResponse ? `${partnerName} answered` : 'new'}
        </p>
      </div>

      <p className={`font-serif text-[28px] ${ink} leading-[1.15]`}>{prompt.text}</p>

      {!myResponse && (
        choices ? (
          <div className={`grid gap-2 ${prompt.type === 'most_likely' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {choices.map(c => (
              <button
                key={c.value}
                onClick={() => answer(c.value)}
                disabled={isPending}
                className={`rounded-xl border border-[rgb(43_38_32/0.16)] bg-white/80 px-4 py-3 text-left text-[15px] ${ink} hover:border-amber-700 hover:bg-white transition-colors disabled:opacity-50`}
              >
                {c.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={2}
              placeholder="Write your answer…"
              className={`w-full bg-transparent border-0 border-b border-[rgb(43_38_32/0.2)] px-1 py-1 font-hand text-[24px] leading-[30px] ${ink} placeholder:text-[rgb(43_38_32/0.35)] focus:outline-none focus:border-amber-700 transition-colors resize-none`}
            />
            <button
              onClick={() => answer(draft)}
              disabled={!draft.trim() || isPending}
              className="self-end bg-[var(--paper-ink)] hover:opacity-90 disabled:opacity-40 text-[var(--paper)] text-sm font-medium rounded-xl px-5 py-2.5 transition-opacity flex items-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />} Answer
            </button>
          </div>
        )
      )}

      {!myResponse && partnerResponse && (
        <p className={`${muted} text-xs flex items-center gap-1.5`}>
          <Lock size={12} /> {partnerName}&rsquo;s answer unlocks when you answer.
        </p>
      )}

      {waiting && (
        <div className="flex flex-col gap-1">
          <p className={`font-hand text-[26px] leading-tight ${ink}`}>{label(myResponse, true)}</p>
          <p className={`${muted} text-xs flex items-center gap-1.5`}>
            <Lock size={12} /> Hidden until {partnerName} answers too.
          </p>
        </div>
      )}

      {both && (
        <div className="flex flex-col gap-3 animate-page-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`${muted} text-[10px] uppercase tracking-[0.2em]`}>You</p>
              <p className={`font-hand text-[26px] leading-tight ${ink}`}>{label(myResponse, true)}</p>
            </div>
            <div>
              <p className={`${muted} text-[10px] uppercase tracking-[0.2em] truncate`}>{partnerName}</p>
              <p className={`font-hand text-[26px] leading-tight ${ink}`}>{label(partnerResponse, false)}</p>
            </div>
          </div>
          {choices && myResponse === partnerResponse && (
            <p className="relative self-center font-hand text-[24px] text-amber-700 px-3">
              you matched!
              <Scribble kind="circle" className="absolute -inset-x-2 -inset-y-1.5 w-[calc(100%+16px)] h-[calc(100%+12px)] text-amber-700/70" strokeWidth={2} />
            </p>
          )}
          <p className={`text-center ${muted} text-xs`}>A new question tomorrow.</p>
        </div>
      )}
      {!both && (
        <p className={`mt-auto pt-1 ${muted} text-[11px]`}>Answers stay hidden until you both reply · feeds your streak 🔥</p>
      )}
    </section>
  )
}
