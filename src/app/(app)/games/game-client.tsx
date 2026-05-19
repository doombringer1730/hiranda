'use client'

import { useState, useTransition } from 'react'
import { submitResponse, getNextPrompt } from './actions'
import { Loader2 } from 'lucide-react'

type PromptType = 'question' | 'would_you_rather' | 'this_or_that'

type Prompt = {
  id: string
  type: string
  text: string
  option_a: string | null
  option_b: string | null
}

type PromptState = {
  prompt: Prompt
  myResponse: string | null
  partnerResponse: string | null
}

type Tab = { type: PromptType; label: string; shortLabel?: string; initial: PromptState | null }

type Props = {
  tabs: Tab[]
  partnerName: string
}

export default function GameClient({ tabs, partnerName }: Props) {
  const [activeTab, setActiveTab] = useState<PromptType>(tabs[0].type)
  const [states, setStates] = useState<Record<PromptType, PromptState | null>>(
    Object.fromEntries(tabs.map(t => [t.type, t.initial])) as Record<PromptType, PromptState | null>
  )
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [nextPending, setNextPending] = useState(false)

  const current = states[activeTab]

  function handleAnswer(value: string) {
    setAnswers(prev => ({ ...prev, [activeTab]: value }))
  }

  function handleSubmit() {
    if (!current) return
    const response = answers[activeTab]
    if (!response?.trim()) return

    startTransition(async () => {
      await submitResponse(current.prompt.id, response.trim())
      setStates(prev => ({
        ...prev,
        [activeTab]: { ...current, myResponse: response.trim() }
      }))
    })
  }

  function handleOptionSelect(option: 'a' | 'b') {
    if (!current || current.myResponse) return
    const value = option === 'a' ? current.prompt.option_a! : current.prompt.option_b!
    handleAnswer(value)
    startTransition(async () => {
      await submitResponse(current.prompt.id, value)
      setStates(prev => ({
        ...prev,
        [activeTab]: { ...current, myResponse: value }
      }))
    })
  }

  async function handleNext() {
    if (!current) return
    setNextPending(true)
    const next = await getNextPrompt(activeTab, current.prompt.id)
    setStates(prev => ({ ...prev, [activeTab]: next }))
    setAnswers(prev => ({ ...prev, [activeTab]: '' }))
    setNextPending(false)
  }

  const bothAnswered = !!(current?.myResponse && current?.partnerResponse)
  const iWaiting = !!(current?.myResponse && !current?.partnerResponse)

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-stone-900 rounded-2xl p-1">
        {tabs.map(t => (
          <button
            key={t.type}
            onClick={() => setActiveTab(t.type)}
            className={`flex-1 text-xs font-medium py-2.5 rounded-xl transition-all ${
              activeTab === t.type
                ? 'bg-amber-700 text-amber-50'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.shortLabel ?? t.label}</span>
          </button>
        ))}
      </div>

      {!current && (
        <p className="text-stone-500 text-sm text-center py-12">No prompts available.</p>
      )}

      {current && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col gap-5">
          {/* Prompt text */}
          <p className="font-serif text-xl text-amber-100 leading-snug">{current.prompt.text}</p>

          {/* Question type — text input */}
          {current.prompt.type === 'question' && !current.myResponse && (
            <div className="flex flex-col gap-3">
              <textarea
                value={answers[activeTab] ?? ''}
                onChange={e => handleAnswer(e.target.value)}
                rows={3}
                placeholder="Your answer…"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!answers[activeTab]?.trim() || isPending}
                className="self-end bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-5 py-2.5 text-sm transition-colors flex items-center gap-2"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Submit
              </button>
            </div>
          )}

          {/* WYR / This or That — option buttons */}
          {(current.prompt.type === 'would_you_rather' || current.prompt.type === 'this_or_that') && !current.myResponse && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleOptionSelect('a')}
                disabled={isPending}
                className="w-full bg-stone-950 border border-stone-800 hover:border-amber-700 text-amber-100 rounded-xl px-4 py-4 text-left transition-colors disabled:opacity-50 font-medium"
              >
                {current.prompt.option_a}
              </button>
              <div className="text-center text-stone-600 text-xs font-medium">or</div>
              <button
                onClick={() => handleOptionSelect('b')}
                disabled={isPending}
                className="w-full bg-stone-950 border border-stone-800 hover:border-amber-700 text-amber-100 rounded-xl px-4 py-4 text-left transition-colors disabled:opacity-50 font-medium"
              >
                {current.prompt.option_b}
              </button>
            </div>
          )}

          {/* Waiting state */}
          {iWaiting && (
            <div className="flex flex-col gap-3">
              <div className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3">
                <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Your answer</p>
                <p className="text-amber-100">{current.myResponse}</p>
              </div>
              <p className="text-stone-500 text-sm text-center py-2">
                Waiting for {partnerName} to answer…
              </p>
            </div>
          )}

          {/* Reveal state */}
          {bothAnswered && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
                  <p className="text-amber-500 text-xs uppercase tracking-widest mb-1.5">You</p>
                  <p className="text-amber-100 text-sm">{current.myResponse}</p>
                </div>
                <div className="bg-stone-800/60 border border-stone-700/60 rounded-xl p-3">
                  <p className="text-stone-400 text-xs uppercase tracking-widest mb-1.5">{partnerName}</p>
                  <p className="text-amber-100 text-sm">{current.partnerResponse}</p>
                </div>
              </div>
              {current.myResponse === current.partnerResponse && (
                <p className="text-center text-amber-500 text-sm font-medium">You matched! 🎉</p>
              )}
              <button
                onClick={handleNext}
                disabled={nextPending}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium rounded-xl px-4 py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {nextPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Next prompt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
