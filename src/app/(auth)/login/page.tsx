'use client'

import { useActionState, useState, useEffect, Suspense } from 'react'
import { useRememberedAccount, forgetAccount } from '@/components/remember-account'
import { login } from '../actions'
import GoogleButton from '@/components/google-button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Heart, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Scribble } from '@/components/handmade'
import { useIsNativeApp } from '@/lib/native'
import { Jar, SLIP_ME, SLIP_PARTNER } from '@/components/jar'

// The tour tells the same story as the ads: Sam & Riley, a few of the
// small rituals that keep them close, one scene per idea.
type Slide = { eyebrow: string; title: string; hand: string; scene: React.ReactNode; span?: 2 | 3 }

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-stone-950/70 border border-stone-800/80 p-3.5 ${className}`}>{children}</div>
)

const slides: Slide[] = [
  {
    eyebrow: 'Every morning',
    title: 'One question. Two answers.',
    hand: 'hidden until you both reply.',
    span: 2,
    scene: (
      <div className="paper paper-ruled rounded-[4px] px-4 pt-3.5 pb-4 rotate-[-1.2deg]">
        <span className="tape -top-3 left-6 rotate-[-6deg]" />
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--paper-muted)]">Today&rsquo;s question</p>
        <p className="font-serif text-[22px] leading-tight mt-1">Would you rather live by the beach, or in the mountains?</p>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--paper-muted)]">
          <span className="h-5 w-5 rounded-full bg-rose-300 grid place-items-center text-[10px] font-semibold text-rose-950">R</span>
          <span className="flex-1 rounded-md bg-[rgb(43_38_32/0.06)] px-2 py-1 blur-[3px] select-none" aria-hidden="true">the mountains, obviously</span>
          <Lock size={13} />
        </div>
        <p className="font-hand text-[19px] mt-1.5 text-[#9a4a2f]">Riley answered — your turn</p>
      </div>
    ),
  },
  {
    eyebrow: 'The little things',
    title: 'Answer the little bids.',
    hand: 'couples who last turn toward each other 86% of the time.',
    scene: (
      <Card className="flex flex-col gap-2">
        <div className="paper rounded-xl px-3 py-2 max-w-[85%] rotate-[-1deg]">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--paper-muted)]">🎉 Good news</p>
          <p className="font-hand text-[21px] leading-none mt-0.5">I GOT THE INTERNSHIP!!</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Tell me everything!', 'I’m so proud of you', 'We have to celebrate'].map(t => (
            <span key={t} className="rounded-full border border-stone-700 px-2.5 py-1 text-[11px] text-stone-300">{t}</span>
          ))}
        </div>
        <p className="self-end relative rounded-2xl rounded-br-md bg-amber-700 text-amber-50 text-sm px-3 py-1.5">
          tell me everything!!
          <span className="absolute -bottom-2.5 -left-2 rounded-full bg-stone-900 border border-stone-800 text-[11px] px-1">❤️</span>
        </p>
      </Card>
    ),
  },
  {
    eyebrow: 'Open when…',
    title: 'Letters for the hard days.',
    hand: 'sealed until they need them.',
    scene: (
      <div className="grid grid-cols-2 gap-3 px-1">
        {[['open when you miss me', -3, true], ['open on our anniversary', 2.5, false]].map(([label, tilt, heart]) => (
          <div key={label as string} style={{ rotate: `${tilt}deg` }}>
            <div className="paper relative aspect-[3/2] rounded-[4px] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[58%] bg-[#efe6d4] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
              <span className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-full bg-amber-700 text-amber-50 shadow-[0_2px_4px_rgb(0_0_0/0.3)]">
                {heart ? <Heart size={13} fill="currentColor" /> : <Lock size={12} />}
              </span>
            </div>
            <p className="font-hand text-[19px] leading-[1.05] text-amber-100 mt-1.5">{label as string}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: 'Game night',
    title: 'Write ten things. Pull one from each of you.',
    hand: 'the jar decides tonight.',
    scene: (
      <Card className="relative h-[150px] overflow-hidden">
        <div className="absolute left-1/2 top-2 -translate-x-1/2 text-stone-300">
          <Jar slips={[SLIP_ME, SLIP_PARTNER, SLIP_ME, SLIP_PARTNER, SLIP_PARTNER, SLIP_ME, SLIP_ME, SLIP_PARTNER, SLIP_ME, SLIP_PARTNER, SLIP_ME, SLIP_PARTNER]} size={100} label="A jar of plans" />
        </div>
        <p className="absolute left-2 bottom-4 font-hand text-[20px] md:text-[17px] leading-none whitespace-nowrap px-3 py-2 md:px-2.5 md:py-1.5 rounded-[3px] text-[#2b2620] rotate-[-7deg] shadow-lg" style={{ background: SLIP_ME }}>sunrise walk</p>
        <p className="absolute right-2 top-[52px] font-hand text-[20px] md:text-[17px] leading-none whitespace-nowrap px-3 py-2 md:px-2.5 md:py-1.5 rounded-[3px] text-[#2b2620] rotate-[6deg] shadow-lg" style={{ background: SLIP_PARTNER }}>karaoke night</p>
      </Card>
    ),
  },
  {
    eyebrow: 'Every night',
    title: '15 minutes. Phones down.',
    hand: 'no agenda. no fixing.',
    scene: (
      <Card className="flex flex-col items-center text-center gap-2 py-4">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" className="text-stone-800" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="0.7 1" className="text-amber-500" />
          </svg>
          <p className="absolute inset-0 grid place-items-center font-serif text-[34px] text-amber-50">10:32</p>
        </div>
        <p className="text-stone-500 text-[10px] uppercase tracking-[0.18em]">Started by Riley</p>
        <p className="text-stone-300 text-sm leading-snug max-w-[16rem]">Say one thing you appreciated about them today.</p>
      </Card>
    ),
  },
  {
    eyebrow: 'Grow together',
    title: 'A tiny lesson a day.',
    hand: 'every stamp earns you both a coupon.',
    span: 3,
    scene: (
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-6 md:items-center">
        <div className="relative grid grid-cols-3 px-1">
          <span className="absolute left-[16.6%] right-[16.6%] top-[18px] border-t-2 border-dashed border-stone-700" aria-hidden="true" />
          {['Ask deeper', 'Quiz each other', 'Turn toward'].map((t, i) => (
            <div key={t} className="relative flex flex-col items-center gap-1.5 text-center">
              <span className={`h-9 w-9 rounded-full grid place-items-center text-sm ${i < 2 ? 'bg-amber-700 text-amber-50' : 'bg-stone-950 border-2 border-dashed border-stone-600 text-stone-400'}`}>{i < 2 ? '✓' : '3'}</span>
              <span className="text-[11px] text-stone-400 leading-tight">{t}</span>
            </div>
          ))}
        </div>
        <div className="ticket coupon-common rounded-[18px] flex items-stretch min-h-[72px] [--stub:72px] shadow-[0_10px_24px_-14px_rgb(0_0_0/0.6)]">
          <div className="w-[72px] shrink-0 grid place-items-center border-r-2 border-dashed border-black/15 text-[30px]">📞</div>
          <div className="flex-1 min-w-0 px-4 py-2.5 flex flex-col justify-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] opacity-60">Good for one · Common</p>
            <p className="font-hand text-[22px] leading-[1.05] mt-0.5">FaceTime until we fall asleep</p>
          </div>
        </div>
      </div>
    ),
  },
]

function SlideHead({ slide }: { slide: Slide }) {
  return (
    <>
      <p className="text-stone-500 text-[10px] uppercase tracking-[0.24em]">{slide.eyebrow}</p>
      <h2 className="font-serif text-[28px] leading-[1.02] text-amber-50 mt-1.5">{slide.title}</h2>
      <p className="font-hand text-[21px] leading-[1.05] text-amber-400 mt-1">{slide.hand}</p>
    </>
  )
}

function Walkthrough() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const slide = slides[step]
  const go = (i: number) => setStep(((i % slides.length) + slides.length) % slides.length)

  return (
    <div
      className="rounded-3xl bg-stone-900/60 border border-stone-800 p-5 card-glow select-none"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      {/* stories-style progress bars: auto-advance, tap a bar to jump, hold anywhere to pause */}
      <div className="flex gap-1.5 -mt-2 mb-3">
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

      <div key={step} className="animate-page-in min-h-[330px] flex flex-col">
        <SlideHead slide={slide} />
        <div className="flex-1 flex flex-col justify-center pt-5">{slide.scene}</div>
      </div>

      <div className="flex items-center justify-between mt-4">
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
      {slides.map(slide => (
        <div
          key={slide.title}
          className={`rounded-3xl bg-stone-900/60 border border-stone-800 p-6 card-glow flex flex-col ${slide.span === 3 ? 'col-span-3' : slide.span === 2 ? 'col-span-2' : ''}`}
        >
          <SlideHead slide={slide} />
          <div className="flex-1 flex flex-col justify-center pt-5">{slide.scene}</div>
        </div>
      ))}
    </div>
  )
}

function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-serif text-amber-50 ${className}`}>Hiranda<span className="text-amber-500">.</span></span>
}

function SignInForm({ next, onBack }: { next: string; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(login, null)
  // e.g. an expired reset link or a cancelled Google sign-in
  const urlError = useSearchParams().get('error')
  // Who last signed in on this device — greet them, fill in their email.
  const deleted = !!urlError?.includes('deleted')
  const known = useRememberedAccount()
  const last = deleted ? null : known
  const native = useIsNativeApp()
  useEffect(() => { if (deleted) forgetAccount() }, [deleted])

  return (
    <div className="w-full max-w-sm relative z-10 animate-page-in">
      <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">{last ? <>Welcome back, {last.name}</> : <Wordmark className="text-5xl" />}</h1>
      <p className="text-stone-400 text-center text-sm mb-10">
        {last ? <>Not you? <button type="button" onClick={forgetAccount} className="underline underline-offset-2 hover:text-stone-200" style={{ minHeight: 0 }}>Use a different account</button></> : 'welcome back'}
      </p>
      {last?.provider === 'google' && (
        <p className="text-stone-500 text-xs text-center -mt-6 mb-4">
          {native
            ? <>You signed in with Google last time. In the app, use “Forgot password?” once to set a password.</>
            : 'You signed in with Google last time.'}
        </p>
      )}

      <div className="flex flex-col gap-4 mb-4">
        <GoogleButton next={next || '/'} />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}

        {(state?.error || urlError) && (
          <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-lg px-4 py-3">
            {state?.error ?? urlError}
            {deleted && <> <a href="/support" className="underline underline-offset-2">Need support?</a></>}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="email">Email</label>
          <input
            key={last?.email ?? 'none'} defaultValue={last?.provider !== 'google' ? last?.email : undefined}
            id="email" name="email" type="email" required autoComplete="email"
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-stone-500 hover:text-amber-400 text-xs transition-colors">Forgot password?</Link>
          </div>
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

      <p className="text-stone-600 text-xs text-center mt-6">
        <Link href="/support" className="hover:text-stone-400">Help</Link> · <Link href="/privacy" className="hover:text-stone-400">Privacy</Link> · <Link href="/terms" className="hover:text-stone-400">Terms</Link>
      </p>
    </div>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''
  const [chosenView, setView] = useState<'welcome' | 'signin' | null>(null)
  // Returning to a device someone already used: skip the tour, go to sign-in.
  const returning = !!useRememberedAccount()
  const view = chosenView ?? (returning ? 'signin' : 'welcome')
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-14 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,color-mix(in_oklab,var(--color-amber-700)_16%,transparent),transparent_70%)] pointer-events-none" />

      {view === 'signin' ? (
        <SignInForm next={next} onBack={() => setView('welcome')} />
      ) : (
        <div className="w-full max-w-sm md:max-w-3xl relative z-10 animate-page-in flex flex-col gap-8">
          <div className="text-center">
            <h1><Wordmark className="text-6xl md:text-7xl" /></h1>
            <p className="font-serif text-2xl md:text-3xl text-amber-100/90 leading-tight mt-3">A private little place for the two of you.</p>
            <p className="relative inline-block font-hand text-[24px] text-amber-400 mt-2">
              quiet, warm, just yours.
              <Scribble kind="underline" className="absolute left-0 -bottom-2 w-full h-3 text-amber-500/70" />
            </p>
          </div>

          <div className="md:hidden">
            <Walkthrough />
          </div>
          <Bento />

          <p className="text-stone-500 text-xs text-center -mt-2 leading-relaxed">
            Also inside: watch in sync, memories, a shared journal, someday lists, music, and more.
            <br className="hidden md:block" />{' '}
            Built on relationship research — no streak guilt, no scores.
          </p>

          <div className="flex flex-col gap-3 w-full md:max-w-md md:mx-auto">
            <Link
              href={signupHref}
              className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors text-center"
            >
              Create your space
            </Link>
            <button
              onClick={() => setView('signin')}
              className="w-full bg-stone-900 hover:bg-stone-800 border border-stone-800 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors"
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
