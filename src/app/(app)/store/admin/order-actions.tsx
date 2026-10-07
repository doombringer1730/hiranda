'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { checkSupplier, sendToSupplier, setOrderStatus } from '../actions'

export default function OrderActions({ id, status, tracking, supplier, sent }: {
  id: string; status: string; tracking: string | null; supplier: string | null; sent: boolean
}) {
  const router = useRouter()
  const [url, setUrl] = useState(tracking ?? '')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const go = (next: 'fulfilling' | 'shipped' | 'delivered' | 'canceled') => start(async () => {
    const res = await setOrderStatus(id, next, url)
    if (res?.error) setMsg(res.error); else router.refresh()
  })
  const run = (fn: () => Promise<{ error?: string } | undefined>) => start(async () => {
    const res = await fn()
    if (res?.error) setMsg(res.error); else { setMsg(null); router.refresh() }
  })
  const btn = 'h-9 px-3 rounded-full text-xs font-medium disabled:opacity-50'
  return (
    <div className="flex flex-col gap-2">
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Tracking link (https://…)"
        className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-amber-50 placeholder:text-stone-600" />
      <div className="flex flex-wrap gap-2">
        {supplier && !sent && status === 'paid' && <button disabled={pending} onClick={() => run(() => sendToSupplier(id))} className={`${btn} bg-amber-700 text-amber-50`}>Send to {supplier}</button>}
        {supplier && sent && <button disabled={pending} onClick={() => run(() => checkSupplier(id))} className={`${btn} bg-stone-800 text-stone-200`}>Check with {supplier}</button>}
        {status === 'paid' && <button disabled={pending} onClick={() => go('fulfilling')} className={`${btn} bg-stone-800 text-stone-200`}>Making it</button>}
        {status !== 'shipped' && <button disabled={pending} onClick={() => go('shipped')} className={`${btn} bg-amber-700 text-amber-50`}>Mark shipped</button>}
        <button disabled={pending} onClick={() => go('delivered')} className={`${btn} bg-stone-800 text-stone-200`}>Delivered</button>
        <button disabled={pending} onClick={() => go('canceled')} className={`${btn} text-stone-500 hover:text-red-400`}>Cancel</button>
      </div>
      {msg && <p className="text-red-400 text-xs">{msg}</p>}
    </div>
  )
}
