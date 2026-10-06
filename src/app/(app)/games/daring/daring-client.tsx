'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Shuffle } from 'lucide-react'
import { CARDS, CATEGORIES, type Category } from './cards'

type Drawn = { category: Category; text: string }

const ALL = Object.keys(CATEGORIES) as Category[]

export default function DaringClient() {
  const [enabled, setEnabled] = useState<Category[]>(ALL)
  const [card, setCard] = useState<Drawn | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(0)

  function toggle(c: Category) {
    setEnabled(prev => prev.includes(c) ? (prev.length > 1 ? prev.filter(x => x !== c) : prev) : [...prev, c])
  }

  function draw() {
    const pool = enabled.flatMap(category => CARDS[category].map(text => ({ category, text })))
    let fresh = pool.filter(c => !seen.has(c.text) && c.text !== card?.text)
    // Whole deck played — reshuffle.
    if (!fresh.length) { fresh = pool.filter(c => c.text !== card?.text); setSeen(new Set()) }
    const next = fresh[Math.floor(Math.random() * fresh.length)]
    setSeen(s => new Set(s).add(next.text))
    setCard(next)
    setCount(n => n + 1)
  }

  const meta = card ? CATEGORIES[card.category] : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/games" className="text-stone-500 hover:text-amber-300 transition-colors -ml-2 p-2 flex items-center" aria-label="Back to games">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-serif text-3xl text-amber-50">Daring Questions</h1>
      </div>

      <p className="text-stone-400 text-sm -mt-2">Take turns drawing. Answer honestly, or take the dare. Best played together — in person or on a call.</p>

      <div className="flex flex-wrap gap-2">
        {ALL.map(c => {
          const on = enabled.includes(c)
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              aria-pressed={on}
              style={{ minHeight: 0 }}
              className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                on ? 'border-amber-700 bg-amber-900/30 text-amber-100' : 'border-stone-800 text-stone-500 hover:text-stone-300'
              }`}
            >
              {CATEGORIES[c].emoji} {CATEGORIES[c].label}
            </button>
          )
        })}
      </div>

      {/* The card */}
      <button
        onClick={draw}
        className="relative w-full aspect-[3/4] max-h-[28rem] [perspective:1200px] text-left"
        aria-label={card ? 'Draw the next card' : 'Draw a card'}
      >
        <div key={count} className={`absolute inset-0 rounded-3xl ${count ? 'animate-card-flip' : ''}`}>
          {card && meta ? (
            <div className={`absolute inset-0 rounded-3xl border p-7 flex flex-col shadow-2xl ${
              card.category === 'dare'
                ? 'bg-gradient-to-br from-rose-950 to-stone-900 border-rose-900/60'
                : 'bg-gradient-to-br from-amber-950/70 to-stone-900 border-amber-900/40'
            }`}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400">{meta.emoji} {meta.label} · {meta.hint}</p>
              <p className="font-serif text-3xl sm:text-4xl text-amber-50 leading-tight my-auto">{card.text}</p>
              <p className="text-stone-500 text-xs">Tap for the next card</p>
            </div>
          ) : (
            <div className="absolute inset-0 rounded-3xl border border-stone-800 bg-stone-900 p-7 flex flex-col items-center justify-center gap-4 shadow-2xl bg-[repeating-linear-gradient(45deg,transparent_0_10px,rgb(255_255_255/0.025)_10px_20px)]">
              <p className="font-serif text-5xl text-amber-50">Daring<br /><span className="italic text-amber-400">Questions</span></p>
              <p className="text-stone-500 text-sm flex items-center gap-2"><Shuffle size={14} /> Tap to draw</p>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
