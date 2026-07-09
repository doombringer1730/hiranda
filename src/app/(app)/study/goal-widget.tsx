'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, Pencil, Check } from 'lucide-react'
import { setXpGoal } from './actions'

export type GoalPerson = { id: string; name: string; status: string | null; weeklyXp: number; goal: number; editable: boolean }

function Ring({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#292524" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#6366f1" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-amber-100">{Math.min(100, pct)}%</div>
    </div>
  )
}

function GoalRow({ p }: { p: GoalPerson }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(p.goal))
  const pct = p.goal > 0 ? Math.round((p.weeklyXp / p.goal) * 100) : 0
  const remaining = Math.max(0, p.goal - p.weeklyXp)
  const hit = p.weeklyXp >= p.goal

  async function save() {
    const g = parseInt(val, 10); if (g > 0) await setXpGoal(g)
    setEditing(false); router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <Ring pct={pct} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-100 text-sm font-medium truncate">{p.name}</span>
          {p.editable && !editing && <button onClick={() => setEditing(true)} className="text-stone-600 hover:text-indigo-300"><Pencil size={11} /></button>}
        </div>
        {editing ? (
          <div className="flex items-center gap-1 mt-1">
            <input type="number" value={val} onChange={e => setVal(e.target.value)} min={50}
              className="w-24 bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-amber-50 text-sm focus:outline-none focus:border-indigo-500" />
            <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-1.5"><Check size={13} /></button>
          </div>
        ) : (
          <>
            <p className="text-stone-400 text-xs">{p.weeklyXp.toLocaleString()} / {p.goal.toLocaleString()} XP</p>
            <p className="text-[11px] truncate">{hit ? <span className="text-emerald-400">Goal hit! 🎉</span> : <span className="text-stone-500">{remaining} to go{p.status ? ` · “${p.status}”` : ''}</span>}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function GoalsWidget({ people }: { people: GoalPerson[] }) {
  return (
    <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4">
      <div className="flex items-center gap-1.5 mb-3"><Target size={13} className="text-indigo-400" /><h2 className="text-stone-400 text-xs uppercase tracking-widest">Weekly goals</h2></div>
      <div className="flex flex-col gap-3">
        {people.map(p => <GoalRow key={p.id} p={p} />)}
      </div>
    </div>
  )
}
