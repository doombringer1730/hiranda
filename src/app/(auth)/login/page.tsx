'use client'

import { useActionState, useState, Suspense } from 'react'
import { login } from '../actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Play, BookOpen, Star, Library, Gamepad2, Music,
  CalendarHeart, CheckSquare, ChevronLeft, ChevronRight,
} from 'lucide-react'

const slides = [
  {
    icon: Play,
    title: 'Watch together, actually together',
    text: 'Play, pause, and seek stay in perfect sync — with live chat and emotes while you watch. It works even when you’re miles apart.',
    preview: (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-stone-950 border border-stone-800 p-3">
          <div className="aspect-video max-h-24 w-full rounded bg-gradient-to-br from-stone-900 to-amber-950/40 flex items-center justify-center">
            <span className="h-9 w-9 rounded-full bg-amber-700/90 flex items-center justify-center">
              <Play size={16} className="text-amber-50 ml-0.5" fill="currentColor" />
            </span>
          </div>
          <div className="mt-3 h-1 rounded-full bg-stone-800">
            <div className="h-1 w-2/3 rounded-full bg-amber-600" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span className="flex -space-x-1.5">
            <span className="h-5 w-5 rounded-full bg-amber-800 border border-stone-950" />
            <span className="h-5 w-5 rounded-full bg-stone-600 border border-stone-950" />
          </span>
          2 watching · in sync
          <span className="ml-auto rounded-full bg-stone-900 border border-stone-800 px-2.5 py-1 text-amber-200/80">this part!! 😭</span>
        </div>
      </div>
    ),
  },
  {
    icon: BookOpen,
    title: 'Keep every memory',
    text: 'Memories with photo albums, a shared journal, and daily prompts — a scrapbook that writes itself as you go.',
    preview: (
      <div className="flex flex-col gap-2.5">
        <div className="rounded-lg bg-stone-950 border border-stone-800 p-3 flex gap-3 items-center">
          <div className="h-12 w-12 shrink-0 rounded bg-gradient-to-br from-amber-900/60 to-stone-800" />
          <div className="min-w-0">
            <p className="text-amber-100 text-sm truncate">Beach day, finally</p>
            <p className="text-stone-500 text-xs">12 photos · tagged “travel”</p>
          </div>
        </div>
        <div className="rounded-lg bg-stone-950 border border-stone-800 p-3">
          <p className="text-stone-500 text-[10px] uppercase tracking-widest mb-1">Today&rsquo;s prompt</p>
          <p className="text-stone-300 text-sm italic">“What made you laugh this week?”</p>
        </div>
      </div>
    ),
  },
  {
    icon: Star,
    title: 'Plan what’s next',
    text: 'A bucket list for somedays, countdowns to the dates that matter, a shared watchlist, and a fridge-style to-do list.',
    preview: (
      <div className="flex flex-col gap-2.5">
        <div className="rounded-lg bg-stone-950 border border-stone-800 p-3 flex flex-col gap-2 text-sm">
          <p className="flex items-center gap-2 text-stone-400"><CheckSquare size={14} className="text-amber-600" /> <s className="text-stone-600">See the northern lights</s></p>
          <p className="flex items-center gap-2 text-stone-300"><Star size={14} className="text-stone-600" /> Road trip down the coast</p>
        </div>
        <div className="rounded-lg bg-stone-950 border border-stone-800 px-3 py-2.5 flex items-center gap-2 text-sm">
          <CalendarHeart size={14} className="text-amber-600" />
          <span className="text-stone-300">Anniversary</span>
          <span className="ml-auto text-amber-200/90 text-xs">in 23 days</span>
        </div>
      </div>
    ),
  },
  {
    icon: Library,
    title: 'A shared shelf',
    text: 'A little library of books you read together — each of you keeps your own place — plus what you’re both listening to.',
    preview: (
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <div className="h-20 w-14 rounded bg-gradient-to-b from-amber-900/70 to-stone-800 border border-stone-800" />
          <div className="h-20 w-14 rounded bg-gradient-to-b from-stone-700 to-stone-900 border border-stone-800" />
          <div className="h-20 w-14 rounded bg-gradient-to-b from-red-950/70 to-stone-900 border border-stone-800" />
        </div>
        <div className="rounded-lg bg-stone-950 border border-stone-800 px-3 py-2.5 flex items-center gap-2 text-xs">
          <Music size={13} className="text-amber-600" />
          <span className="text-stone-300 truncate">now playing · your shared soundtrack</span>
          <span className="ml-auto flex gap-0.5 items-end">
            <span className="w-0.5 h-2 bg-amber-600 rounded-full" />
            <span className="w-0.5 h-3 bg-amber-500 rounded-full" />
            <span className="w-0.5 h-1.5 bg-amber-700 rounded-full" />
          </span>
        </div>
      </div>
    ),
  },
  {
    icon: Gamepad2,
    title: 'And a game night, whenever',
    text: 'Little games to play together in the same space — no extra apps, no setup, just open Hiranda and play.',
    preview: (
      <div className="rounded-lg bg-stone-950 border border-stone-800 p-4 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-1.5">
          {['×', '', 'o', '', 'x', '', 'o', '', '×'].map((c, i) => (
            <div key={i} className="h-9 w-9 rounded bg-stone-900 border border-stone-800 flex items-center justify-center text-lg font-serif text-amber-200/90">
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

function Walkthrough() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const slide = slides[step]
  const Icon = slide.icon
  const go = (i: number) => setStep(((i % slides.length) + slides.length) % slides.length)

  return (
    <div
      className="rounded-2xl bg-stone-900/60 border border-stone-800 p-5 card-glow select-none"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      {/* stories-style progress bars: auto-advance, tap a bar to jump, hold anywhere to pause */}
      <div className="flex gap-1.5 -mt-2 mb-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Go to step ${i + 1}`}
            className="flex-1 flex items-center"
          >
            <span className="h-1 w-full rounded-full bg-stone-800 overflow-hidden">
              {i < step && <span className="block h-full w-full bg-amber-600" />}
              {i === step && (
                <span
                  key={step}
                  className="block h-full bg-amber-600 animate-story"
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                  onAnimationEnd={() => go(step + 1)}
                />
              )}
            </span>
          </button>
        ))}
      </div>

      <div key={step} className="animate-page-in">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center">
            <Icon size={15} className="text-amber-500" />
          </span>
          <h2 className="text-amber-100 font-medium">{slide.title}</h2>
        </div>
        <p className="text-stone-400 text-sm leading-relaxed mb-4">{slide.text}</p>
        {slide.preview}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => go(step - 1)}
          aria-label="Previous"
          className="h-11 w-11 rounded-full bg-stone-900 border border-stone-800 text-stone-400 hover:text-amber-200 flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-stone-600 text-xs">hold to pause · {step + 1} / {slides.length}</span>

        <button
          onClick={() => go(step + 1)}
          aria-label="Next"
          className="h-11 w-11 rounded-full bg-stone-900 border border-stone-800 text-stone-400 hover:text-amber-200 flex items-center justify-center transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function Bento() {
  return (
    <div className="hidden md:grid grid-cols-3 gap-4">
      {slides.map((slide, i) => {
        const Icon = slide.icon
        return (
          <div
            key={slide.title}
            className={`rounded-2xl bg-stone-900/60 border border-stone-800 p-5 card-glow flex flex-col ${i === 0 ? 'col-span-2' : ''}`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="h-8 w-8 shrink-0 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center">
                <Icon size={15} className="text-amber-500" />
              </span>
              <h2 className="text-amber-100 font-medium">{slide.title}</h2>
            </div>
            <p className="text-stone-400 text-sm leading-relaxed mb-4">{slide.text}</p>
            <div className="mt-auto">{slide.preview}</div>
          </div>
        )
      })}
    </div>
  )
}

function SignInForm({ next, onBack }: { next: string; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(login, null)

  return (
    <div className="w-full max-w-sm relative z-10 animate-page-in">
      <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
      <p className="text-stone-400 text-center text-sm mb-10">welcome back</p>

      <form action={formAction} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}

        {state?.error && (
          <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-lg px-4 py-3">
            {state.error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="email">Email</label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="password">Password</label>
          <input
            id="password" name="password" type="password" required autoComplete="current-password"
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={pending}
          className="mt-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-stone-500 text-sm text-center mt-8">
        No account?{' '}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
          className="text-amber-500 hover:text-amber-400 transition-colors"
        >
          Sign up
        </Link>
      </p>

      <button
        onClick={onBack}
        className="text-stone-600 hover:text-stone-400 text-sm text-center mt-4 w-full transition-colors"
      >
        ← Back to the tour
      </button>
    </div>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''
  const [view, setView] = useState<'welcome' | 'signin'>('welcome')
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-14 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />

      {view === 'signin' ? (
        <SignInForm next={next} onBack={() => setView('welcome')} />
      ) : (
        <div className="w-full max-w-sm md:max-w-3xl relative z-10 animate-page-in flex flex-col gap-8">
          <div className="text-center">
            <h1 className="font-serif text-5xl text-amber-100 mb-3">Hiranda</h1>
            <p className="text-stone-400 text-sm leading-relaxed md:max-w-lg md:mx-auto">
              A private space you share with your favorite person — watch in sync,
              keep memories, plan somedays. Quiet, warm, and just for you.
            </p>
          </div>

          <div className="md:hidden">
            <Walkthrough />
          </div>
          <Bento />

          <div className="flex flex-col gap-3 w-full md:max-w-md md:mx-auto">
            <Link
              href={signupHref}
              className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-3.5 transition-colors text-center"
            >
              Create your space
            </Link>
            <button
              onClick={() => setView('signin')}
              className="w-full bg-stone-900 hover:bg-stone-800 border border-stone-800 text-amber-50 font-medium rounded-xl px-4 py-3.5 transition-colors"
            >
              Sign in
            </button>
            <Link
              href="/demo"
              className="text-stone-500 hover:text-amber-400 text-sm text-center transition-colors flex items-center justify-center"
            >
              or look around a demo space →
            </Link>
            <p className="text-stone-600 text-xs text-center">
              Free for two. Invited by someone? Their link brings you right in.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
