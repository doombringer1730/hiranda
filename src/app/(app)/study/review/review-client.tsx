'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X, Zap } from 'lucide-react'
import { reviewCard, recordAttempt } from '../actions'

type Card = { id: string; term: string; definition: string }

export default function ReviewClient({ cards }: { cards: Card[] }) {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)
  const start = useRef(Date.now())
  const c = cards[i]

  async function rate(got: boolean) {
    await reviewCard(c.id, got)
    const nc = correct + (got ? 1 : 0)
    if (i + 1 >= cards.length) {
      setCorrect(nc); setFinished(true)
      await recordAttempt(null, 'review', nc, cards.length, nc * 6, Date.now() - start.current)
      router.refresh()
    } else { setCorrect(nc); setI(i + 1); setRevealed(false) }
  }

  return (
    <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/study" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm"><ArrowLeft size={15} /> Study</Link>
        {!finished && <span className="text-stone-500 text-sm">{i + 1} / {cards.length}</span>}
      </div>

      {finished ? (
        <div className="text-center py-10">
          <div className="text-5xl mb-2">🎯</div>
          <p className="text-stone-500 text-xs uppercase tracking-widest">Reviewed</p>
          <p className="font-serif text-6xl text-amber-100 my-2">{correct}<span className="text-stone-600 text-3xl">/{cards.length}</span></p>
          <p className="inline-flex items-center gap-2 text-lg font-semibold text-indigo-300 bg-indigo-950/50 border border-indigo-800/50 rounded-full px-4 py-1.5"><Zap size={18} />+{correct * 6} XP</p>
          <p className="text-stone-500 text-sm mt-3">Missed cards come back sooner; the rest space out.</p>
          <Link href="/study" className="block w-full mt-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium">Done</Link>
        </div>
      ) : (
        <>
          <div className="w-full min-h-[16rem] rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-3">term</p>
              <p className="font-serif text-2xl text-amber-100">{c.term}</p>
              {revealed && <><div className="h-px bg-stone-800 my-5" /><p className="text-indigo-200">{c.definition}</p></>}
            </div>
          </div>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="w-full mt-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-3 text-sm">Show answer</button>
          ) : (
            <div className="flex gap-2 mt-4">
              <button onClick={() => rate(false)} className="flex-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-red-100 rounded-xl py-3 text-sm flex items-center justify-center gap-2"><X size={16} /> Missed</button>
              <button onClick={() => rate(true)} className="flex-1 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-100 rounded-xl py-3 text-sm flex items-center justify-center gap-2"><Check size={16} /> Got it</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
