'use client'

import { useActionState, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { deleteAccount } from './account-actions'

export default function AccountSection({ partnerName }: { partnerName: string | null }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(deleteAccount, null)

  return (
    <div className="flex flex-col gap-4">
      <a
        href="/api/account/export"
        className="self-start flex items-center gap-2 rounded-xl bg-stone-800 hover:bg-stone-700 px-4 py-2.5 text-sm text-stone-200 transition-colors"
      >
        <Download size={15} /> Download our data
      </a>

      {!open ? (
        <button onClick={() => setOpen(true)} className="self-start flex items-center gap-2 text-sm text-stone-500 hover:text-red-400 transition-colors">
          <Trash2 size={14} /> Delete my account…
        </button>
      ) : (
        <form action={formAction} className="rounded-2xl border border-red-900/50 bg-red-950/20 p-4 flex flex-col gap-3">
          <p className="text-red-200 text-sm font-medium">Delete your account for good?</p>
          <ul className="text-stone-400 text-xs leading-relaxed list-disc pl-4">
            <li>Everything you created — memories, journal entries, photos, lists, answers — is permanently deleted.</li>
            <li>Your shared space closes{partnerName ? `; ${partnerName} keeps everything they made and can start a new one` : ''}.</li>
            <li>This can’t be undone. Download your data first if you want a copy.</li>
          </ul>
          <label className="text-stone-400 text-xs" htmlFor="confirm">Type <b className="text-red-300">DELETE</b> to confirm</label>
          <input id="confirm" name="confirm" autoComplete="off" className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 focus:outline-none focus:border-red-700" />
          {state?.error && <p className="text-red-400 text-sm">{state.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors">
              {pending ? 'Deleting…' : 'Delete my account'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
