'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check, X, Loader2, Trash2, Plus, Sparkles } from 'lucide-react'
import { createTrivia, guessTrivia, deleteTrivia } from './actions'
import { haptic, celebrate } from '@/lib/feel'

export type Trivia = {
  id: string
  author: string
  question: string
  options: string[]
  correct: number // -1 when hidden (partner's question you haven't guessed)
  guess: number | null
  created_at: string
}

const STARTERS = [
  'What’s my go-to comfort food?',
  'What was my dream job as a kid?',
  'What’s my biggest pet peeve?',
  'Which song would I pick for karaoke?',
  'What’s my favorite season?',
  'What would I do with a free Saturday?',
  'What’s my coffee (or tea) order?',
  'Which movie could I rewatch forever?',
  'What am I most afraid of?',
  'Where would I go on a dream trip?',
  'What’s my love language?',
  'What did I notice first about you?',
]

const LETTERS = ['A', 'B', 'C', 'D']

export default function TriviaClient({ myId, partnerName, questions }: {
  myId: string
  partnerName: string
  questions: Trivia[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'quiz' | 'write'>('quiz')
  // Results of guesses made this session, so the card can reveal in place.
  const [results, setResults] = useState<Record<string, { guess: number; correct: boolean }>>({})
  const [isPending, startTransition] = useTransition()

  const theirs = questions.filter(q => q.author !== myId)
  const mine = questions.filter(q => q.author === myId)
  const toGuess = theirs.filter(q => q.guess === null && !results[q.id])
  const current = toGuess[toGuess.length - 1] // oldest first
  const justAnswered = theirs.find(q => results[q.id] && q.guess === null)

  const score = (list: Trivia[]) => {
    const answered = list.filter(q => q.guess !== null)
    return { right: answered.filter(q => q.guess === q.correct).length, total: answered.length }
  }
  const iKnow = score(theirs)
  for (const r of Object.values(results)) { iKnow.total++; if (r.correct) iKnow.right++ }
  const theyKnow = score(mine)

  function guess(q: Trivia, i: number) {
    startTransition(async () => {
      haptic()
      const res = await guessTrivia(q.id, i)
      if ('correct' in res && res.correct !== undefined) {
        if (res.correct) celebrate()
        setResults(r => ({ ...r, [q.id]: { guess: i, correct: res.correct! } }))
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/games" className="text-stone-500 hover:text-amber-300 transition-colors -ml-2 p-2 flex items-center" aria-label="Back to games">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-serif text-3xl text-amber-50">Trivia About Us</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ScoreTile label={`You know ${partnerName}`} {...iKnow} />
        <ScoreTile label={`${partnerName} knows you`} {...theyKnow} />
      </div>

      <div className="flex gap-1 bg-stone-900/70 border border-stone-800 rounded-2xl p-1">
        {(['quiz', 'write'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs font-medium py-2.5 rounded-xl transition-all ${tab === t ? 'bg-amber-700 text-amber-50' : 'text-stone-500 hover:text-stone-300'}`}
          >
            {t === 'quiz' ? `Quiz me${toGuess.length ? ` (${toGuess.length})` : ''}` : 'Write about me'}
          </button>
        ))}
      </div>

      {tab === 'quiz' && (
        <div className="flex flex-col gap-4">
          {justAnswered && (
            <QuestionCard q={justAnswered} result={results[justAnswered.id]} partnerName={partnerName} />
          )}
          {!justAnswered && current && (
            <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-5 flex flex-col gap-4">
              <p className="text-stone-500 text-[10px] uppercase tracking-[0.25em]">About {partnerName}</p>
              <p className="font-serif text-2xl text-amber-50 leading-snug">{current.question}</p>
              <div className="flex flex-col gap-2">
                {current.options.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => guess(current, i)}
                    disabled={isPending}
                    className="flex items-center gap-3 w-full bg-stone-950 border border-stone-800 hover:border-amber-700 text-amber-100 rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-50"
                  >
                    <span className="text-stone-500 text-xs font-medium w-4">{LETTERS[i]}</span>{o}
                  </button>
                ))}
              </div>
            </div>
          )}
          {justAnswered && (
            <button
              onClick={() => { setResults({}); router.refresh() }}
              className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium rounded-xl px-4 py-3 text-sm transition-colors"
            >
              {toGuess.length ? 'Next question' : 'Done'}
            </button>
          )}
          {!justAnswered && !current && (
            <div className="text-center py-10 flex flex-col items-center gap-2">
              <Sparkles size={22} className="text-amber-600" />
              <p className="text-stone-400 text-sm">You&rsquo;re all caught up.</p>
              <p className="text-stone-600 text-xs">When {partnerName} writes new questions about themselves, they&rsquo;ll show up here.</p>
            </div>
          )}

          {theirs.some(q => q.guess !== null) && (
            <details className="group">
              <summary className="cursor-pointer list-none text-stone-500 text-[10px] uppercase tracking-[0.25em] py-2">Past answers ▾</summary>
              <div className="flex flex-col gap-2 mt-2">
                {theirs.filter(q => q.guess !== null).map(q => <HistoryRow key={q.id} q={q} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'write' && (
        <div className="flex flex-col gap-6">
          <WriteForm partnerName={partnerName} />
          {mine.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-stone-500 text-[10px] uppercase tracking-[0.25em]">Your questions</p>
              {mine.map(q => <MyRow key={q.id} q={q} partnerName={partnerName} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreTile({ label, right, total }: { label: string; right: number; total: number }) {
  return (
    <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-4 text-center">
      <p className="font-serif text-3xl text-amber-50">{total ? `${Math.round((right / total) * 100)}%` : '—'}</p>
      <p className="text-stone-500 text-xs mt-1 truncate">{label}</p>
      {total > 0 && <p className="text-stone-600 text-[10px] mt-0.5">{right} of {total}</p>}
    </div>
  )
}

function QuestionCard({ q, result, partnerName }: { q: Trivia; result: { guess: number; correct: boolean }; partnerName: string }) {
  return (
    <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-5 flex flex-col gap-4 animate-page-in">
      <p className={`text-sm font-medium ${result.correct ? 'text-emerald-400' : 'text-rose-400'}`}>
        {result.correct ? 'You got it! 🎉' : `Not quite — ${partnerName} will tease you about this one`}
      </p>
      <p className="font-serif text-2xl text-amber-50 leading-snug">{q.question}</p>
      <div className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const picked = i === result.guess
          const right = result.correct && picked
          return (
            <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
              right ? 'border-emerald-600 bg-emerald-950/30 text-emerald-200'
              : picked ? 'border-rose-700 bg-rose-950/30 text-rose-200'
              : 'border-stone-800 bg-stone-950 text-stone-400'
            }`}>
              <span className="text-xs font-medium w-4 opacity-70">{LETTERS[i]}</span>{o}
              {picked && (right ? <Check size={16} className="ml-auto" /> : <X size={16} className="ml-auto" />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HistoryRow({ q }: { q: Trivia }) {
  const right = q.guess === q.correct
  return (
    <div className="flex items-start gap-3 bg-stone-900/50 border border-stone-800/60 rounded-xl px-4 py-3">
      {right ? <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <X size={16} className="text-rose-400 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-amber-100 text-sm">{q.question}</p>
        <p className="text-stone-500 text-xs mt-0.5">
          {q.options[q.correct]}{!right && q.guess !== null && <span className="text-stone-600"> · you said {q.options[q.guess]}</span>}
        </p>
      </div>
    </div>
  )
}

function MyRow({ q, partnerName }: { q: Trivia; partnerName: string }) {
  const [isPending, startTransition] = useTransition()
  const answered = q.guess !== null
  const right = q.guess === q.correct
  return (
    <div className="flex items-start gap-3 bg-stone-900/50 border border-stone-800/60 rounded-xl px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-amber-100 text-sm">{q.question}</p>
        <p className="text-xs mt-0.5">
          <span className="text-stone-500">{q.options[q.correct]}</span>
          {' · '}
          {!answered ? <span className="text-stone-600">waiting for {partnerName}</span>
            : right ? <span className="text-emerald-400">{partnerName} got it</span>
            : <span className="text-rose-400">{partnerName} said {q.options[q.guess!]}</span>}
        </p>
      </div>
      <button
        onClick={() => confirm('Delete this question?') && startTransition(() => deleteTrivia(q.id))}
        disabled={isPending}
        aria-label="Delete question"
        className="text-stone-600 hover:text-red-400 transition-colors p-1 -m-1 flex items-center"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  )
}

function WriteForm({ partnerName }: { partnerName: string }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', ''])
  const [correct, setCorrect] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createTrivia(question, options, correct)
      if (res.error) { setError(res.error); return }
      setQuestion(''); setOptions(['', '', '']); setCorrect(0)
    })
  }

  return (
    <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-5 flex flex-col gap-4">
      <p className="text-stone-400 text-sm">Write a question about <em>you</em>. {partnerName} gets one guess.</p>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]">
        {STARTERS.map(s => (
          <button
            key={s}
            onClick={() => setQuestion(s)}
            style={{ minHeight: 0 }}
            className="shrink-0 rounded-full border border-stone-800 bg-stone-950 px-3 py-1.5 text-xs text-stone-400 hover:text-amber-200 hover:border-amber-800 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="What’s my favorite…"
        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
      />
      <div className="flex flex-col gap-2">
        <p className="text-stone-500 text-[10px] uppercase tracking-[0.25em]">Answers · tap the circle for the right one</p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setCorrect(i)}
              aria-label={`Mark answer ${LETTERS[i]} correct`}
              className={`h-11 w-11 shrink-0 rounded-full border flex items-center justify-center text-xs font-medium transition-colors ${
                correct === i ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300' : 'border-stone-800 text-stone-500 hover:border-stone-600'
              }`}
            >
              {correct === i ? <Check size={16} /> : LETTERS[i]}
            </button>
            <input
              value={o}
              onChange={e => setOptions(prev => prev.map((p, j) => j === i ? e.target.value : p))}
              placeholder={i === 0 ? 'The real answer…' : 'A sneaky decoy…'}
              className="flex-1 min-w-0 bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            />
            {options.length > 2 && (
              <button
                onClick={() => { setOptions(prev => prev.filter((_, j) => j !== i)); setCorrect(c => c === i ? 0 : c > i ? c - 1 : c) }}
                aria-label="Remove answer"
                className="text-stone-600 hover:text-red-400 p-1 flex items-center"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button onClick={() => setOptions(prev => [...prev, ''])} className="self-start text-stone-500 hover:text-amber-200 text-xs flex items-center gap-1.5">
            <Plus size={13} /> Add an answer
          </button>
        )}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={submit}
        disabled={isPending || !question.trim() || options.some(o => !o.trim())}
        className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-5 py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 size={14} className="animate-spin" />} Add question
      </button>
    </div>
  )
}
