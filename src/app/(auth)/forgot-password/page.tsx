'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { requestPasswordReset } from '../actions'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-page-in">
        <h1 className="font-serif text-4xl text-amber-50 text-center mb-2">Forgot it?</h1>
        <p className="text-stone-400 text-center text-sm mb-10">It happens. We’ll email you a link to set a new one.</p>

        {state?.sent ? (
          <div className="tile p-6 flex flex-col items-center text-center gap-3">
            <MailCheck size={28} className="text-amber-400" />
            <p className="text-amber-50">Check your email</p>
            <p className="text-stone-400 text-sm">If that address has an account, a reset link is on its way. It works once and expires in an hour.</p>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            {state?.error && <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-lg px-4 py-3">{state.error}</p>}
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="email">Email</label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" disabled={pending} className="mt-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-stone-500 text-sm text-center mt-8">
          <Link href="/login" className="text-amber-500 hover:text-amber-400 transition-colors">← Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}
