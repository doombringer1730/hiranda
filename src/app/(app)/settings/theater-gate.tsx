'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Unlock, Film } from 'lucide-react'
import { setTheaterPasscode, unlockTheater, lockTheater } from './actions'

const inputCls = 'flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 text-sm placeholder:text-stone-600 focus:outline-none focus:border-indigo-500'

export default function TheaterGate({ hasPasscode, unlocked }: { hasPasscode: boolean; unlocked: boolean }) {
  const router = useRouter()
  const [val, setVal] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function doSet() { setBusy(true); setErr(null); const r = await setTheaterPasscode(val); setBusy(false); if (r.error) { setErr(r.error); return } setVal(''); router.refresh() }
  async function doUnlock() { setBusy(true); setErr(null); const r = await unlockTheater(val); setBusy(false); if (r.error) { setErr(r.error); return } setVal(''); router.refresh() }
  async function doLock() { await lockTheater(); router.refresh() }

  if (unlocked) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-emerald-400 text-sm inline-flex items-center gap-1.5"><Unlock size={14} /> Unlocked this session</p>
        <div className="flex gap-2">
          <Link href="/watch" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl px-4 py-2.5 inline-flex items-center gap-2 transition-colors"><Film size={15} /> Open Theater</Link>
          <button onClick={doLock} className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm rounded-xl px-4 py-2.5 inline-flex items-center gap-2 transition-colors"><Lock size={14} /> Lock</button>
        </div>
        <details className="text-stone-500 text-xs">
          <summary className="cursor-pointer hover:text-stone-300">Change passcode</summary>
          <div className="flex gap-2 mt-2">
            <input value={val} onChange={e => setVal(e.target.value)} type="password" placeholder="New passcode (4+ chars)" className={inputCls} />
            <button onClick={doSet} disabled={busy || val.length < 4} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl px-4">Save</button>
          </div>
        </details>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={val} onChange={e => setVal(e.target.value)} type="password"
          placeholder={hasPasscode ? 'Enter passcode' : 'Choose a passcode (4+ chars)'}
          onKeyDown={e => { if (e.key === 'Enter') (hasPasscode ? doUnlock() : doSet()) }}
          className={inputCls}
        />
        <button onClick={hasPasscode ? doUnlock : doSet} disabled={busy || val.length < 4}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl px-4 py-2.5 inline-flex items-center gap-2 transition-colors">
          {hasPasscode ? <><Unlock size={14} /> Unlock</> : <><Lock size={14} /> Set</>}
        </button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
    </div>
  )
}
