'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, Pencil, Check } from 'lucide-react'
import { setXpGoal } from './actions'

function Ring({ pct, children }: { pct: number; children: React.ReactNode }) {
  const r = 30, c = 2 * Math.PI * r
  return (
    <div className="relative w-[74px] h-[74px]">
      <svg viewBox="0 0 74 74" className="w-full h-full -rotate-90">
        <circle cx="37" cy="37" r={r} fill="none" stroke="#292524" strokeWidth="6" />
        <circle cx="37" cy="37" r={r} fill="none" stroke="#6366f1" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export default function GoalWidget({ name, status, weeklyXp, goal, editable }: {
  name: string; status: string | null; weeklyXp: number; goal: number; editable: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(goal))
  const pct = goal > 0 ? Math.round((weeklyXp / goal) * 100) : 0
  const remaining = Math.max(0, goal - weeklyXp)
  const hit = weeklyXp >= goal

  async function save() {
    const g = parseInt(val, 10)
    if (g > 0) await setXpGoal(g)
    setEditing(false); router.refresh()
  }

  return (
    <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4 flex flex-col items-center text-center">
      <div className="flex items-center gap-1.5 self-start w-full">
        <Target size={12} className="text-indigo-400" />
        <span className="text-stone-400 text-xs truncate flex-1 text-left">{name}</span>
        {editable && !editing && <button onClick={() => setEditing(true)} className="text-stone-600 hover:text-indigo-300"><Pencil size={11} /></button>}
      </div>

      <div className="my-2">
        <Ring pct={pct}>
          <div>
            <p className="text-amber-100 font-semibold leading-none">{pct}%</p>
          </div>
        </Ring>
      </div>

      {editing ? (
        <div className="flex items-center gap-1 w-full">
          <input type="number" value={val} onChange={e => setVal(e.target.value)} min={50}
            className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2 py-1.5 text-amber-50 text-sm text-center focus:outline-none focus:border-indigo-500" />
          <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-1.5"><Check size={14} /></button>
        </div>
      ) : (
        <>
          <p className="text-amber-100 text-sm">{weeklyXp.toLocaleString()} <span className="text-stone-500">/ {goal.toLocaleString()} XP</span></p>
          <p className="text-xs mt-0.5 truncate w-full">{hit ? <span className="text-emerald-400">Goal hit! 🎉</span> : <span className="text-stone-500">{remaining} XP to go this week</span>}</p>
          {status && <p className="text-stone-600 text-xs italic mt-1.5 truncate w-full">“{status}”</p>}
        </>
      )}
    </div>
  )
}
