'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/app/(auth)/actions'

function Verify() {
  const router = useRouter()
  const next = useSearchParams().get('next') ?? '/'
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp?.[0]
    if (!factor) { router.replace('/'); return }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
    if (error) { setError('That code didn’t work — try the newest one.'); setBusy(false); return }
    router.replace(next.startsWith('/') && !next.startsWith('//') ? next : '/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-page-in text-center">
        <ShieldCheck size={32} className="mx-auto text-amber-400 mb-4" />
        <h1 className="font-serif text-4xl text-amber-50 mb-2">One more step</h1>
        <p className="text-stone-400 text-sm mb-8">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" autoFocus required
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-amber-50 focus:outline-none focus:border-amber-700"
            placeholder="••••••"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </form>
        <form action={logout} className="mt-6">
          <button type="submit" className="text-stone-500 hover:text-stone-300 text-sm">Use a different account</button>
        </form>
      </div>
    </main>
  )
}

export default function VerifyPage() {
  return <Suspense><Verify /></Suspense>
}
