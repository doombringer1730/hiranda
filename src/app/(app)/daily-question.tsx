'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2, Lock, Sparkles } from 'lucide-react'
import { getDailyPrompt, type DailyPrompt } from './daily-actions'
import { submitResponse, getPromptState } from './games/actions'

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

  // While waiting on the partner, poll so the reveal appears on its own.
  useEffect(() => {
    if (!waiting || !promptId) return
    const interval = setInterval(async () => {
      const fresh = await getPromptState(promptId)
      if (fresh?.partnerResponse) setDaily(fresh)
    }, 5000)
    return () => clearInterval(interval)
  }, [waiting, promptId])

  if (daily === null) return null

  if (daily === undefined) {
    return <div className="h-40 rounded-2xl bg-stone-900/70 border border-stone-800 animate-pulse" />
  }

  const { prompt, myResponse, partnerResponse } = daily
  const both = !!(myResponse && partnerResponse)

  function answer(value: string) {
    const v = value.trim()
    if (!v || !daily) return
    startTransition(async () => {
      await submitResponse(prompt.id, v)
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

  return (
    <section className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-amber-950/40 via-stone-900/80 to-stone-900/80 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-amber-300/80 text-[10px] uppercase tracking-[0.25em] flex items-center gap-2">
          <Sparkles size={12} /> Today&rsquo;s question
        </p>
        <p className="text-stone-500 text-[11px]">
          {both ? 'revealed' : myResponse ? 'you answered' : partnerResponse ? `${partnerName} answered` : 'new'}
        </p>
      </div>

      <p className="font-serif text-2xl text-amber-50 leading-snug">{prompt.text}</p>

      {!myResponse && (
        choices ? (
          <div className={`grid gap-2 ${prompt.type === 'most_likely' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {choices.map(c => (
              <button
                key={c.value}
                onClick={() => answer(c.value)}
                disabled={isPending}
                className="rounded-xl border border-stone-800 bg-stone-950/80 px-4 py-3 text-left text-sm text-amber-100 hover:border-amber-700 transition-colors disabled:opacity-50"
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
              placeholder="Your answer…"
              className="w-full bg-stone-950/80 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none"
            />
            <button
              onClick={() => answer(draft)}
              disabled={!draft.trim() || isPending}
              className="self-end bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm font-medium rounded-xl px-5 py-2.5 transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />} Answer
            </button>
          </div>
        )
      )}

      {!myResponse && partnerResponse && (
        <p className="text-stone-500 text-xs flex items-center gap-1.5">
          <Lock size={12} /> {partnerName}&rsquo;s answer unlocks when you answer.
        </p>
      )}

      {waiting && (
        <div className="flex flex-col gap-2">
          <p className="text-amber-100 text-sm bg-stone-950/60 border border-stone-800 rounded-xl px-4 py-3">{label(myResponse, true)}</p>
          <p className="text-stone-500 text-xs flex items-center gap-1.5">
            <Lock size={12} /> Hidden until {partnerName} answers too.
          </p>
        </div>
      )}

      {both && (
        <div className="flex flex-col gap-2 animate-page-in">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-900/25 border border-amber-800/40 p-3">
              <p className="text-amber-500 text-[10px] uppercase tracking-[0.2em] mb-1">You</p>
              <p className="text-amber-100 text-sm">{label(myResponse, true)}</p>
            </div>
            <div className="rounded-xl bg-stone-800/50 border border-stone-700/60 p-3">
              <p className="text-stone-400 text-[10px] uppercase tracking-[0.2em] mb-1 truncate">{partnerName}</p>
              <p className="text-amber-100 text-sm">{label(partnerResponse, false)}</p>
            </div>
          </div>
          {choices && myResponse === partnerResponse && (
            <p className="text-center text-amber-400 text-sm">Same answer — you matched! 🎉</p>
          )}
          <p className="text-center text-stone-600 text-xs">A new question tomorrow.</p>
        </div>
      )}
    </section>
  )
}
