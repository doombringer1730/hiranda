'use client'

import { useActionState, Suspense } from 'react'
import { login } from '../actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null)
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-sm relative z-10 animate-page-in">
        <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
        <p className="text-stone-400 text-center text-sm mb-10">our little place</p>

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
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
