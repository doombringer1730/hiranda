'use client'

import { useActionState } from 'react'
import { signup } from '../actions'
import Link from 'next/link'

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, null)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
        <p className="text-stone-400 text-center text-sm mb-10">create your account</p>

        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-lg px-4 py-3">
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="display_name">
              Your name
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="Hudson"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors"
          >
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-stone-500 text-sm text-center mt-8">
          Already have an account?{' '}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
