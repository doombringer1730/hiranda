'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sun, Mail, Sparkles, Timer, Play, Pause, BookOpen, Heart, Lock, Star, CheckSquare, Shuffle,
} from 'lucide-react'
import { Jar, SLIP_ME, SLIP_PARTNER } from '@/components/jar'

// Sam & Riley's space — the same couple as the welcome tour and the ads.
// Everything is example data held in local state; nothing is saved.

const tabs = [
  { label: 'Today', icon: Sun },
  { label: 'Letters', icon: Mail },
  { label: 'Date jar', icon: Sparkles },
  { label: 'Talk time', icon: Timer },
  { label: 'Watch', icon: Play },
  { label: 'Memories', icon: BookOpen },
] as const

const bidReplies = ['Tell me everything!', 'I’m so proud of you', 'We have to celebrate']

const letters = [
  {
    label: 'open when you miss me', tilt: -3, locked: false,
    body: 'Hi you. Right now I’m probably thinking about the bookstore and how you read the first page of every book out loud. Call me. Or don’t, and just know I miss you too.',
  },
  { label: 'open on our anniversary', tilt: 2.5, locked: true, body: '' },
]

const jarIdeas = [
  'sunrise walk', 'karaoke night', 'build a blanket fort', 'cook something neither of us can pronounce',
  'thrift each other an outfit', 'stargazing with hot chocolate', 'bookstore, round two', 'paint each other badly',
]

const talkPrompts = [
  'Say one thing you appreciated about them today.',
  'What’s something small you’re looking forward to?',
  'What’s been on your mind that you haven’t said yet?',
  'Tell them about a moment today you wished they were there.',
]

const memories = [
  { title: 'First snow of the year', sub: 'Dec 14 · 6 photos', tilt: -2, tone: 'from-sky-200 to-stone-300' },
  { title: 'Pancake Sunday (again)', sub: 'Nov 30 · 3 photos', tilt: 1.5, tone: 'from-amber-200 to-orange-300' },
]

const chat = [
  { who: 'Sam', text: 'okay this soundtrack is unreal' },
  { who: 'Riley', text: 'told you!! wait for the next scene' },
  { who: 'Sam', text: 'this part!! 😭' },
]

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-stone-900/60 border border-stone-800 p-4 ${className}`}>{children}</div>
)

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-stone-500 text-[10px] uppercase tracking-[0.2em]">{children}</p>
)

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="font-hand text-[19px] leading-tight text-amber-400">{children}</p>
)

function Today({ onTry }: { onTry: () => void }) {
  const [answer, setAnswer] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [hearts, setHearts] = useState(0)

  return (
    <div className="flex flex-col gap-4">
      <div className="paper paper-ruled rounded-[4px] px-4 pt-3.5 pb-4 rotate-[-0.8deg]">
        <span className="tape -top-3 left-6 rotate-[-6deg]" />
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--paper-muted)]">Today&rsquo;s question</p>
        <p className="font-serif text-[22px] leading-tight mt-1">Would you rather live by the beach, or in the mountains?</p>
        {answer ? (
          <div className="mt-3 flex flex-col gap-1.5 text-[13px] animate-page-in">
            <p><span className="font-semibold">You:</span> {answer}</p>
            <p><span className="font-semibold">Riley:</span> the mountains, obviously</p>
            <p className="font-hand text-[19px] text-[#9a4a2f]">{answer === 'the mountains' ? 'a match! cabin trip?' : 'a beach house with a view of the mountains, then.'}</p>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--paper-muted)]">
              <span className="h-5 w-5 rounded-full bg-rose-300 grid place-items-center text-[10px] font-semibold text-rose-950">R</span>
              <span className="flex-1 rounded-md bg-[rgb(43_38_32/0.06)] px-2 py-1 blur-[3px] select-none" aria-hidden="true">the mountains, obviously</span>
              <Lock size={13} />
            </div>
            <div className="mt-3 flex gap-2">
              {['the beach', 'the mountains'].map(a => (
                <button
                  key={a}
                  onClick={() => { setAnswer(a); onTry() }}
                  className="flex-1 rounded-full border border-[#2b2620]/25 px-3 py-2 text-sm text-[#2b2620] hover:bg-[#2b2620]/5 transition-colors"
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="font-hand text-[19px] mt-2 text-[#9a4a2f]">Riley answered. Your turn, then you’ll see theirs.</p>
          </>
        )}
      </div>

      <Card className="flex flex-col gap-2.5">
        <Eyebrow>Riley shared something</Eyebrow>
        <div className="paper rounded-xl px-3 py-2 max-w-[85%] rotate-[-1deg]">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--paper-muted)]">🎉 Good news</p>
          <p className="font-hand text-[21px] leading-none mt-0.5">I GOT THE INTERNSHIP!!</p>
        </div>
        {reply ? (
          <p className="self-end rounded-2xl rounded-br-md bg-amber-700 text-amber-50 text-sm px-3 py-1.5 animate-page-in">{reply}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {bidReplies.map(t => (
              <button
                key={t}
                onClick={() => { setReply(t); onTry() }}
                className="rounded-full border border-stone-700 px-3 py-1.5 text-xs text-stone-300 hover:border-amber-700 hover:text-amber-200 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setHearts(h => h + 1); if (hearts === 0) onTry() }}
          className="rounded-2xl bg-stone-900/60 border border-stone-800 p-4 flex flex-col items-center gap-1.5 hover:border-amber-800 transition-colors"
        >
          <Heart key={hearts} size={26} className={`text-amber-500 ${hearts ? 'animate-pop' : ''}`} fill={hearts ? 'currentColor' : 'none'} />
          <span className="text-stone-300 text-sm">{hearts ? `Sent ${hearts} ${hearts === 1 ? 'heart' : 'hearts'}` : 'Send Riley a heart'}</span>
        </button>
        <Card className="flex flex-col items-center justify-center gap-0.5 text-center">
          <span className="font-serif text-3xl text-amber-100">23</span>
          <span className="text-stone-400 text-xs">days to your anniversary</span>
          <span className="font-hand text-[17px] text-amber-400 leading-none mt-1">three years!</span>
        </Card>
      </div>
    </div>
  )
}

function Letters({ onTry }: { onTry: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const letter = open === null ? null : letters[open]

  return (
    <div className="flex flex-col gap-4">
      <Hint>Write them now. They stay sealed until they’re needed.</Hint>
      <div className="grid grid-cols-2 gap-4 px-1">
        {letters.map((l, i) => (
          <button
            key={l.label}
            onClick={() => { setOpen(i); onTry() }}
            className="text-left"
            style={{ rotate: `${l.tilt}deg` }}
            aria-label={l.locked ? `${l.label} (sealed)` : `Open “${l.label}”`}
          >
            <div className="paper relative aspect-[3/2] rounded-[4px] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[58%] bg-[#efe6d4] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
              <span className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-amber-700 text-amber-50 shadow-[0_2px_4px_rgb(0_0_0/0.3)]">
                {l.locked ? <Lock size={13} /> : <Heart size={14} fill="currentColor" />}
              </span>
            </div>
            <p className="font-hand text-[20px] leading-[1.05] text-amber-100 mt-2">{l.label}</p>
          </button>
        ))}
      </div>
      {letter && (
        <div key={open} className="paper paper-ruled rounded-[4px] px-5 py-4 animate-page-in">
          {letter.locked ? (
            <p className="font-hand text-[21px] leading-snug text-[#9a4a2f]">Sealed until your anniversary, 23 days from now. No peeking.</p>
          ) : (
            <>
              <p className="font-hand text-[22px] leading-snug">{letter.body}</p>
              <p className="font-hand text-[20px] text-right mt-2 text-[#9a4a2f]">— Riley</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DateJar({ onTry }: { onTry: () => void }) {
  const [pulled, setPulled] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const slips = [SLIP_ME, SLIP_PARTNER, SLIP_ME, SLIP_PARTNER, SLIP_PARTNER, SLIP_ME, SLIP_ME, SLIP_PARTNER, SLIP_ME, SLIP_PARTNER, SLIP_ME, SLIP_PARTNER]

  const pull = () => {
    const pool = jarIdeas.filter(i => i !== pulled)
    setPulled(pool[Math.floor(Math.random() * pool.length)])
    setShake(s => s + 1)
    onTry()
  }

  return (
    <div className="flex flex-col gap-4">
      <Hint>You each write ten ideas. The jar decides tonight.</Hint>
      <Card className="flex flex-col items-center gap-4 py-6">
        <div key={shake} className="text-stone-300">
          <Jar slips={slips} size={120} shake={shake > 0} label="A jar of date ideas" />
        </div>
        {pulled && (
          <p
            key={pulled}
            className="font-hand text-[24px] leading-none px-4 py-2.5 rounded-[3px] text-[#2b2620] rotate-[-4deg] shadow-lg animate-page-in"
            style={{ background: shake % 2 ? SLIP_PARTNER : SLIP_ME }}
          >
            {pulled}
          </p>
        )}
        <button
          onClick={pull}
          className="flex items-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 px-5 py-2.5 text-sm transition-colors"
        >
          <Shuffle size={14} /> {pulled ? 'Pull another' : 'Pull one'}
        </button>
      </Card>
    </div>
  )
}

function TalkTime({ onTry }: { onTry: () => void }) {
  const total = 15 * 60
  const [left, setLeft] = useState(total)
  const [running, setRunning] = useState(false)
  const [prompt, setPrompt] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="flex flex-col gap-4">
      <Hint>Fifteen minutes. Phones down. No agenda, no fixing.</Hint>
      <Card className="flex flex-col items-center text-center gap-3 py-6">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" className="text-stone-800" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray={`${left / total} 1`} className="text-amber-500 transition-[stroke-dasharray] duration-1000 ease-linear" />
          </svg>
          <p className="absolute inset-0 grid place-items-center font-serif text-[38px] text-amber-50">{mm}:{ss}</p>
        </div>
        <p key={prompt} className="text-stone-300 text-sm leading-snug max-w-[18rem] animate-page-in">{talkPrompts[prompt]}</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setRunning(r => !r); if (!running && left === total) onTry() }}
            className="flex items-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 px-5 py-2.5 text-sm transition-colors"
          >
            {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> {left === total ? 'Start' : 'Resume'}</>}
          </button>
          <button
            onClick={() => setPrompt(p => (p + 1) % talkPrompts.length)}
            className="rounded-full border border-stone-700 text-stone-300 hover:text-amber-200 px-4 py-2.5 text-sm transition-colors"
          >
            Another prompt
          </button>
        </div>
      </Card>
    </div>
  )
}

function Watch({ onTry }: { onTry: () => void }) {
  const [playing, setPlaying] = useState(true)

  return (
    <div className="flex flex-col gap-3">
      <Hint>Miles apart, same scene. Play, pause and seek stay in sync.</Hint>
      <div className="rounded-2xl bg-stone-950 border border-stone-800 p-3">
        <button
          onClick={() => { setPlaying(p => !p); onTry() }}
          aria-label={playing ? 'Pause for both of you' : 'Play for both of you'}
          className="aspect-video w-full rounded-lg bg-gradient-to-br from-stone-900 to-amber-950/40 flex items-center justify-center"
        >
          <span className="h-12 w-12 rounded-full bg-amber-700/90 flex items-center justify-center">
            {playing ? <Pause size={18} className="text-amber-50" fill="currentColor" /> : <Play size={18} className="text-amber-50 ml-0.5" fill="currentColor" />}
          </span>
        </button>
        <div className="mt-3 h-1 rounded-full bg-stone-800">
          <div className="h-1 w-1/3 rounded-full bg-amber-600" />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
          <span>42:17</span>
          <span className="ml-auto flex -space-x-1.5">
            <span className="h-5 w-5 rounded-full bg-amber-800 border border-stone-950" />
            <span className="h-5 w-5 rounded-full bg-rose-300 border border-stone-950" />
          </span>
          <span>{playing ? '2 watching · in sync' : 'You paused it for both of you'}</span>
        </div>
      </div>
      <Card className="flex flex-col gap-2.5">
        {chat.map((c, i) => (
          <p key={i} className="text-sm animate-chat-in" style={{ animationDelay: `${i * 120}ms` }}>
            <span className={c.who === 'Sam' ? 'text-amber-500' : 'text-rose-300'}>{c.who}</span>
            <span className="text-stone-300"> — {c.text}</span>
          </p>
        ))}
      </Card>
    </div>
  )
}

function Memories({ onTry }: { onTry: () => void }) {
  const [done, setDone] = useState<string[]>(['See the northern lights'])
  const someday = ['Road trip down the coast', 'Learn to play one song as a duet', 'See the northern lights']
  const toggle = (t: string) => {
    setDone(d => d.includes(t) ? d.filter(x => x !== t) : [...d, t])
    onTry()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 px-1 pt-2">
        {memories.map(m => (
          <figure key={m.title} className="polaroid" style={{ rotate: `${m.tilt}deg` }}>
            <span className="tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
            <div className={`aspect-square rounded-[2px] bg-gradient-to-br ${m.tone}`} />
            <figcaption className="px-1 pt-1.5 pb-2.5 text-[#2b2620]">
              <p className="font-hand text-[20px] leading-[1.05] line-clamp-2">{m.title}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8a7f70] mt-0.5">{m.sub}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <Card className="flex flex-col gap-3">
        <Eyebrow>Someday list</Eyebrow>
        {someday.map(t => {
          const isDone = done.includes(t)
          return (
            <button key={t} onClick={() => toggle(t)} className="flex items-center gap-2.5 text-sm text-left">
              {isDone ? <CheckSquare size={16} className="text-amber-600 shrink-0" /> : <Star size={16} className="text-stone-600 shrink-0" />}
              <span className={isDone ? 'text-stone-500 line-through' : 'text-stone-300'}>{t}</span>
            </button>
          )
        })}
      </Card>
    </div>
  )
}

const panels = [Today, Letters, DateJar, TalkTime, Watch, Memories]

export default function DemoPage() {
  const [tab, setTab] = useState(0)
  const [tries, setTries] = useState(0)
  const Panel = panels[tab]
  const onTry = () => setTries(t => t + 1)

  return (
    <main className="min-h-screen bg-stone-950 relative overflow-hidden pb-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_oklab,var(--color-amber-700)_14%,transparent),transparent_60%)] pointer-events-none" />

      <header className="relative z-10 max-w-2xl mx-auto px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl text-amber-50">Hiranda<span className="text-amber-500">.</span></span>
          <span className="text-[10px] uppercase tracking-widest text-amber-500 border border-amber-900/60 bg-amber-950/40 rounded-full px-2.5 py-1">
            demo
          </span>
        </div>
        <Link href="/login" className="text-stone-500 hover:text-stone-300 text-sm transition-colors flex items-center">
          ← Back
        </Link>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-6 mt-6 mb-5">
        <h1 className="font-serif text-[30px] leading-[1.05] text-amber-50">You&rsquo;re Sam. This is your space with Riley.</h1>
        <p className="text-stone-500 text-sm mt-2">Tap anything and try it. It&rsquo;s all example data, and nothing is saved.</p>
      </div>

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
        <Panel onTry={onTry} />

        {tries >= 3 && (
          <div className="mt-6 rounded-2xl border border-amber-900/60 bg-amber-950/30 p-5 text-center animate-page-in">
            <p className="font-serif text-xl text-amber-50">Imagine this with your person.</p>
            <p className="text-stone-400 text-sm mt-1">Make your space, then send them one link. It&rsquo;s free for two.</p>
            <Link href="/signup" className="inline-block mt-4 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-full px-6 py-3 transition-colors">
              Make it yours
            </Link>
          </div>
        )}
      </section>

      <div className="fixed bottom-0 inset-x-0 z-20 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pt-10 pb-6 px-6">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto sm:flex-1 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-6 py-3.5 transition-colors text-center"
          >
            Create your space
          </Link>
          <p className="text-stone-500 text-xs text-center sm:text-left">Free for two. Takes about a minute.</p>
        </div>
      </div>
    </main>
  )
}
