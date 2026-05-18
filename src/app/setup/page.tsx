'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveName } from './actions'

export default function SetupPage() {
  const [state, formAction, pending] = useActionState(saveName, {})
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.display_name) router.replace('/')
        })
    })
  }, [router])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-sm relative z-10 animate-page-in">
        <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
        <p className="text-stone-400 text-center text-sm mb-10">What should we call you?</p>

        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-xl px-4 py-3">
              {state.error}
            </p>
          )}
          <input
            name="name"
            type="text"
            required
            autoFocus
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Your name"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors"
          >
            {pending ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  )
}
