'use client'

import { useActionState, useState } from 'react'
import { signup } from '../actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, null)
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get('token') ?? ''
  const [mode, setMode] = useState<'choose' | 'new' | 'join'>(
    tokenFromUrl ? 'join' : 'choose'
  )
  const [manualToken, setManualToken] = useState(tokenFromUrl)

  const inviteToken = mode === 'join' ? manualToken : ''

  if (mode === 'choose') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
          <p className="text-stone-400 text-center text-sm mb-10">create your account</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode('join')}
              className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-4 transition-colors text-left"
            >
              <p className="font-medium">Join your partner's space</p>
              <p className="text-amber-200/70 text-sm mt-0.5">You have an invite link from your partner</p>
            </button>

            <button
              onClick={() => setMode('new')}
              className="w-full bg-stone-900 hover:bg-stone-800 border border-stone-800 text-amber-50 font-medium rounded-xl px-4 py-4 transition-colors text-left"
            >
              <p className="font-medium">Start a new couple space</p>
              <p className="text-stone-500 text-sm mt-0.5">Your partner hasn't signed up yet</p>
            </button>
          </div>

          <p className="text-stone-500 text-sm text-center mt-8">
            Already have an account?{' '}
            <Link href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">Sign in</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
        <p className="text-stone-400 text-center text-sm mb-10">
          {mode === 'join' ? "joining your partner's space" : 'starting a new couple space'}
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="invite_token" value={inviteToken} />

          {state?.error && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-lg px-4 py-3">
              {state.error}
            </p>
          )}

          {mode === 'join' && !tokenFromUrl && (
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400 text-xs uppercase tracking-widest">Invite code</label>
              <input
                type="text"
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                required
                className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
                placeholder="Paste the invite code from your partner"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="display_name">Your name</label>
            <input id="display_name" name="display_name" type="text" required
              className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="Hudson" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="you@example.com" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="new-password" minLength={6}
              className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="••••••••" />
          </div>

          <button type="submit" disabled={pending}
            className="mt-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => setMode('choose')}
          className="text-stone-600 hover:text-stone-400 text-sm text-center mt-6 w-full transition-colors"
        >
          ← Back
        </button>

        <p className="text-stone-500 text-sm text-center mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">Sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
