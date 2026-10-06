'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Enrolling = { factorId: string; qr: string; secret: string }

// Settings → Two-factor login: set up or remove an authenticator app (TOTP).
export default function MfaSettings() {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    createClient().auth.mfa.listFactors().then(({ data }) => {
      if (live) setFactorId(data?.totp?.find(f => f.status === 'verified')?.id ?? null)
    })
    return () => { live = false }
  }, [])

  async function start() {
    setBusy(true); setError(null)
    const supabase = createClient()
    // Clear any half-finished setup from before.
    const { data } = await supabase.auth.mfa.listFactors()
    for (const f of data?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data: en, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toLocaleDateString()}` })
    setBusy(false)
    if (error || !en) { setError(error?.message ?? 'Couldn’t start setup'); return }
    setEnrolling({ factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret })
  }

  async function confirm() {
    if (!enrolling) return
    setBusy(true); setError(null)
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.trim() })
    setBusy(false)
    if (error) { setError('That code didn’t work — try the newest one.'); return }
    setFactorId(enrolling.factorId); setEnrolling(null); setCode('')
  }

  async function remove() {
    if (!factorId || !confirm_('Turn off two-factor login?')) return
    setBusy(true); setError(null)
    const { error } = await createClient().auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (error) { setError(error.message); return }
    setFactorId(null)
  }

  if (factorId === undefined) return <div className="skeleton h-10 w-48" />

  if (factorId) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm text-emerald-400"><ShieldCheck size={16} /> On — you’ll enter a code when you sign in.</p>
        <button onClick={remove} disabled={busy} className="text-sm text-stone-500 hover:text-red-400 transition-colors">Turn off</button>
      </div>
    )
  }

  if (enrolling) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-stone-400 text-sm">Scan this with an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrolling.qr} alt="Two-factor QR code" className="h-44 w-44 rounded-xl bg-white p-2" />
        <p className="text-stone-500 text-xs break-all">Can’t scan? Enter this key: <span className="text-stone-300 font-mono">{enrolling.secret}</span></p>
        <div className="flex gap-2">
          <input
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
            className="w-36 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-center tracking-[0.3em] text-amber-50 focus:outline-none focus:border-amber-700"
          />
          <button onClick={confirm} disabled={busy || code.length !== 6} className="rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-4 text-sm font-medium text-amber-50 transition-colors">Turn on</button>
          <button onClick={() => setEnrolling(null)} className="px-2 text-sm text-stone-500 hover:text-stone-300">Cancel</button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={start} disabled={busy} className="self-start flex items-center gap-2 rounded-xl bg-stone-800 hover:bg-stone-700 px-4 py-2.5 text-sm text-stone-200 transition-colors">
        <ShieldPlus size={15} /> Set up authenticator app
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}

function confirm_(msg: string) {
  return typeof window !== 'undefined' && window.confirm(msg)
}
