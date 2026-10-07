'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setApplicationStatus } from '../../actions'

const NEXT = [
  { status: 'contacted', label: 'Contacted' },
  { status: 'approved', label: 'Approve' },
  { status: 'declined', label: 'Decline' },
] as const

export function StatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap gap-2">
      {NEXT.filter(n => n.status !== status).map(n => (
        <button key={n.status} disabled={pending}
          onClick={() => start(async () => { await setApplicationStatus(id, n.status); router.refresh() })}
          className={`h-9 px-3 rounded-full text-xs font-medium disabled:opacity-50 ${n.status === 'approved' ? 'bg-amber-700 text-amber-50' : n.status === 'declined' ? 'text-stone-500 hover:text-red-400' : 'bg-stone-800 text-stone-200'}`}>
          {n.label}
        </button>
      ))}
    </div>
  )
}
