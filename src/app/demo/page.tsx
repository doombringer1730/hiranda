'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Star, CalendarHeart, Play, CheckSquare, Pause,
} from 'lucide-react'

const memories = [
  { title: 'First snow of the year', date: 'Dec 14', photos: 6, tags: ['silly', 'winter'], gradient: 'from-stone-700 to-stone-900' },
  { title: 'Pancake Sunday (again)', date: 'Nov 30', photos: 3, tags: ['home'], gradient: 'from-amber-900/70 to-stone-900' },
  { title: 'The bookstore we got lost in', date: 'Nov 8', photos: 9, tags: ['date night', 'travel'], gradient: 'from-red-950/70 to-stone-900' },
]

const bucketTodo = [
  { title: 'Road trip down the coast', category: 'travel' },
  { title: 'Cook a five-course dinner at home', category: 'food' },
  { title: 'Learn to play one song as a duet', category: 'experience' },
]
const bucketDone = [
  { title: 'See the northern lights', category: 'travel' },
  { title: 'Watch every Ghibli movie', category: 'experience' },
]

const dates = [
  { title: 'Anniversary', when: 'in 23 days', note: 'three years!' },
  { title: 'Sam’s birthday', when: 'in 8 days', note: 'cake research is underway' },
  { title: 'Portland trip', when: 'in 41 days', note: 'bookstore, round two' },
]

const chat = [
  { who: 'Sam', text: 'okay this soundtrack is unreal' },
  { who: 'Riley', text: 'told you!! wait for the next scene' },
  { who: 'Sam', text: 'this part!! 😭' },
]

const tabs = [
  { label: 'Memories', icon: BookOpen },
  { label: 'Bucket list', icon: Star },
  { label: 'Dates', icon: CalendarHeart },
  { label: 'Watch', icon: Play },
] as const

export default function DemoPage() {
  const [tab, setTab] = useState(0)

  return (
    <main className="min-h-screen bg-stone-950 relative overflow-hidden pb-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(120,53,15,0.12),transparent_60%)] pointer-events-none" />

      <header className="relative z-10 max-w-2xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl text-amber-100">Hiranda</span>
          <span className="text-[10px] uppercase tracking-widest text-amber-500 border border-amber-900/60 bg-amber-950/40 rounded-full px-2.5 py-1">
            demo space
          </span>
        </div>
        <Link href="/login" className="text-stone-500 hover:text-stone-300 text-sm transition-colors flex items-center">
          ← Exit demo
        </Link>
      </header>

      <p className="relative z-10 max-w-2xl mx-auto px-6 text-stone-500 text-sm mb-6">
        This is Sam &amp; Riley&rsquo;s space — all example data. Click around; nothing here is real or saved.
      </p>

      <nav className="relative z-10 max-w-2xl mx-auto px-6 flex gap-2 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ label, icon: Icon }, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm whitespace-nowrap transition-colors border ${
              i === tab
                ? 'bg-amber-950/60 border-amber-900/60 text-amber-200'
                : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <section key={tab} className="relative z-10 max-w-2xl mx-auto px-6 animate-page-in">
        {tab === 0 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-4">
              <p className="text-stone-500 text-[10px] uppercase tracking-widest mb-1">Today&rsquo;s prompt</p>
              <p className="text-stone-300 text-sm italic">&ldquo;What made you laugh this week?&rdquo;</p>
            </div>
            {memories.map(m => (
              <div key={m.title} className="rounded-xl bg-stone-900/60 border border-stone-800 p-4 flex gap-4 items-center card-glow">
                <div className={`h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br ${m.gradient}`} />
                <div className="min-w-0">
                  <p className="text-amber-100 truncate">{m.title}</p>
                  <p className="text-stone-500 text-xs mt-0.5">{m.date} · {m.photos} photos</p>
                  <div className="flex gap-1.5 mt-2">
                    {m.tags.map(t => (
                      <span key={t} className="text-[10px] text-amber-200/70 bg-amber-950/40 border border-amber-900/40 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 1 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-4 flex flex-col gap-3">
              <p className="text-stone-500 text-[10px] uppercase tracking-widest">Someday</p>
              {bucketTodo.map(b => (
                <p key={b.title} className="flex items-center gap-2.5 text-sm text-stone-300">
                  <Star size={15} className="text-stone-600 shrink-0" />
                  {b.title}
                  <span className="ml-auto text-[10px] text-stone-500 bg-stone-900 border border-stone-800 rounded-full px-2 py-0.5">{b.category}</span>
                </p>
              ))}
            </div>
            <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-4 flex flex-col gap-3">
              <p className="text-stone-500 text-[10px] uppercase tracking-widest">Done ✨</p>
              {bucketDone.map(b => (
                <p key={b.title} className="flex items-center gap-2.5 text-sm text-stone-500">
                  <CheckSquare size={15} className="text-amber-600 shrink-0" />
                  <s>{b.title}</s>
                  <span className="ml-auto text-[10px] text-stone-600 bg-stone-900 border border-stone-800 rounded-full px-2 py-0.5">{b.category}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="flex flex-col gap-3">
            {dates.map(d => (
              <div key={d.title} className="rounded-xl bg-stone-900/60 border border-stone-800 p-4 flex items-center gap-3 card-glow">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center">
                  <CalendarHeart size={15} className="text-amber-500" />
                </span>
                <div className="min-w-0">
                  <p className="text-amber-100">{d.title}</p>
                  <p className="text-stone-500 text-xs">{d.note}</p>
                </div>
                <span className="ml-auto text-amber-200/90 text-sm whitespace-nowrap">{d.when}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 3 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-stone-950 border border-stone-800 p-3">
              <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-stone-900 to-amber-950/40 flex items-center justify-center">
                <span className="h-12 w-12 rounded-full bg-amber-700/90 flex items-center justify-center">
                  <Pause size={18} className="text-amber-50" fill="currentColor" />
                </span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-stone-800">
                <div className="h-1 w-1/3 rounded-full bg-amber-600" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                <span>42:17</span>
                <span className="ml-auto flex -space-x-1.5">
                  <span className="h-5 w-5 rounded-full bg-amber-800 border border-stone-950" />
                  <span className="h-5 w-5 rounded-full bg-stone-600 border border-stone-950" />
                </span>
                <span>2 watching · in sync</span>
              </div>
            </div>
            <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-4 flex flex-col gap-2.5">
              {chat.map((c, i) => (
                <p key={i} className="text-sm animate-chat-in" style={{ animationDelay: `${i * 120}ms` }}>
                  <span className={c.who === 'Sam' ? 'text-amber-500' : 'text-stone-400'}>{c.who}</span>
                  <span className="text-stone-300"> — {c.text}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="fixed bottom-0 inset-x-0 z-20 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pt-10 pb-6 px-6">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto sm:flex-1 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-6 py-3.5 transition-colors text-center"
          >
            Like it? Create your space
          </Link>
          <p className="text-stone-500 text-xs text-center sm:text-left">Free for two — takes about a minute.</p>
        </div>
      </div>
    </main>
  )
}
