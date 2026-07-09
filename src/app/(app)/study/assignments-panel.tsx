'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Plus, Check, Trash2, Zap, Undo2 } from 'lucide-react'
import { createAssignment, turnInAssignment, deleteAssignment } from './actions'

export type Assignment = { id: string; title: string; due_date: string; turned_in: boolean }

const TURN_IN_XP = 25
const todayKey = () => new Date().toISOString().slice(0, 10)

function dueLabel(due: string): { text: string; tone: 'over' | 'today' | 'soon' | 'far' } {
  const t = new Date(todayKey()).getTime()
  const d = new Date(due).getTime()
  const days = Math.round((d - t) / 86_400_000)
  if (days < 0) return { text: `${-days}d overdue`, tone: 'over' }
  if (days === 0) return { text: 'due today', tone: 'today' }
  if (days === 1) return { text: 'due tomorrow', tone: 'soon' }
  if (days <= 6) return { text: `in ${days} days`, tone: 'soon' }
  return { text: new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tone: 'far' }
}

export default function AssignmentsPanel({ assignments }: { assignments: Assignment[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [xpPop, setXpPop] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const open = assignments.filter(a => !a.turned_in).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const done = assignments.filter(a => a.turned_in)

  async function turnIn(a: Assignment) {
    setBusyId(a.id)
    await turnInAssignment(a.id, a.turned_in)
    if (!a.turned_in) { setXpPop(true); setTimeout(() => setXpPop(false), 1400) }
    setBusyId(null)
    router.refresh()
  }

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-indigo-400" />
          <h2 className="text-stone-400 text-xs uppercase tracking-widest">Assignments</h2>
        </div>
        <button onClick={() => setAdding(v => !v)} className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs">
          <Plus size={13} /> Add
        </button>
      </div>

      {/* XP pop */}
      {xpPop && (
        <div className="absolute -top-2 right-0 z-10 flex items-center gap-1 bg-indigo-600 text-white text-sm font-semibold rounded-full px-3 py-1 shadow-lg animate-float-up">
          <Zap size={14} /> +{TURN_IN_XP} XP
        </div>
      )}

      {adding && (
        <form action={createAssignment} onSubmit={() => setTimeout(() => setAdding(false), 50)}
          className="mb-3 rounded-2xl bg-stone-900/70 border border-stone-800 p-3 flex flex-col sm:flex-row gap-2">
          <input name="title" required maxLength={200} placeholder="Assignment title"
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 placeholder:text-stone-600 text-sm focus:outline-none focus:border-indigo-500" />
          <input name="due_date" type="date" required defaultValue={todayKey()}
            className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 text-sm focus:outline-none focus:border-indigo-500 [color-scheme:dark]" />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl px-4 py-2.5">Add</button>
        </form>
      )}

      {open.length === 0 && done.length === 0 && !adding && (
        <p className="text-stone-600 text-sm text-center py-6">No assignments. Add one and earn XP when you turn it in.</p>
      )}

      <div className="flex flex-col gap-2">
        {open.map(a => {
          const dl = dueLabel(a.due_date)
          const toneCls = dl.tone === 'over' ? 'text-red-400' : dl.tone === 'today' ? 'text-amber-300' : dl.tone === 'soon' ? 'text-indigo-300' : 'text-stone-500'
          return (
            <div key={a.id} className={`group flex items-center gap-3 rounded-xl px-4 py-3 border ${dl.tone === 'over' ? 'bg-red-950/20 border-red-900/40' : 'bg-stone-900/60 border-stone-800'}`}>
              <button onClick={() => turnIn(a)} disabled={busyId === a.id} aria-label="Turn in"
                className="w-6 h-6 rounded-full border-2 border-stone-600 hover:border-indigo-400 shrink-0 transition-colors" />
              <div className="min-w-0 flex-1">
                <p className="text-amber-100 text-sm truncate">{a.title}</p>
                <p className={`text-xs ${toneCls}`}>{dl.text}</p>
              </div>
              <button onClick={() => deleteAssignment(a.id).then(() => router.refresh())} className="text-stone-600 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
            </div>
          )
        })}

        {done.map(a => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-stone-900/30 border border-stone-800/60">
            <button onClick={() => turnIn(a)} aria-label="Undo turn-in"
              className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-emerald-600 shrink-0 flex items-center justify-center group">
              <Check size={13} className="text-white group-hover:hidden" />
              <Undo2 size={12} className="text-white hidden group-hover:block" />
            </button>
            <p className="text-stone-500 text-sm truncate flex-1 line-through">{a.title}</p>
            <span className="text-emerald-500/80 text-xs shrink-0">turned in</span>
          </div>
        ))}
      </div>
    </section>
  )
}
