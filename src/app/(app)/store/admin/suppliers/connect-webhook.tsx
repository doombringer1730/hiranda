'use client'

import { useState, useTransition } from 'react'
import { connectSupplierWebhook } from '../../actions'

export function ConnectWebhook({ vendor, label }: { vendor: string; label: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button disabled={pending} onClick={() => start(async () => {
        const res = await connectSupplierWebhook(vendor)
        setMsg(res.ok ? { ok: true, text: res.ok } : { ok: false, text: res.error ?? 'Something went wrong' })
      })} className="h-9 px-4 rounded-full bg-stone-800 text-stone-200 text-xs font-medium disabled:opacity-50">
        Turn on tracking from {label}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
    </div>
  )
}
