'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { SIZE_KINDS } from '@/lib/store/catalog'
import { saveSizes } from '../actions'

type Sizes = { top: string | null; bottom: string | null; shoe: string | null }

// Your sizes, so gifts fit. Private — your partner only learns that you've
// saved one, never what it is.
export default function SizesForm({ initial }: { initial: Sizes | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <form className="flex flex-col gap-3" action={form => start(async () => {
      const res = await saveSizes(form)
      setMsg(res.error ?? 'Saved ✓')
      if (!res.error) router.refresh()
    })}>
      <div className="grid grid-cols-3 gap-3">
        {SIZE_KINDS.map(k => (
          <label key={k.key} className="flex flex-col gap-1.5">
            <span className="text-stone-400 text-xs">{k.label}</span>
            <select name={k.key} defaultValue={initial?.[k.key] ?? ''}
              className="h-12 bg-stone-900 border border-stone-800 rounded-xl px-3 text-amber-50 focus:outline-none focus:border-amber-700">
              <option value="">—</option>
              {k.choices.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ))}
      </div>
      <button disabled={pending} className="self-start inline-flex items-center gap-2 h-11 px-5 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium disabled:opacity-50">
        {pending && <Loader2 size={16} className="animate-spin" />} Save sizes
      </button>
      {msg && <p className="text-sm text-stone-300" role="status">{msg}</p>}
    </form>
  )
}
