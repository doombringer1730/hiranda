'use client'

import { useActionState } from 'react'
import { updatePassword } from '@/app/(auth)/actions'

// Reached from the emailed link (via /api/auth/callback, which signs you in).
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, null)
  const input = 'bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-page-in">
        <h1 className="font-serif text-4xl text-amber-50 text-center mb-2">New password</h1>
        <p className="text-stone-400 text-center text-sm mb-10">Pick something you’ll remember this time.</p>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-lg px-4 py-3">{state.error}</p>}
          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="password">New password</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={input} placeholder="At least 8 characters" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400 text-xs uppercase tracking-widest" htmlFor="confirm">Confirm</label>
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} placeholder="Same again" />
          </div>
          <button type="submit" disabled={pending} className="mt-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
            {pending ? 'Saving…' : 'Save and sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
