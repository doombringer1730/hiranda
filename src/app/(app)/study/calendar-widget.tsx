'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Undo2 } from 'lucide-react'
import { createAssignment, turnInAssignment, deleteAssignment } from './actions'
import type { Assignment } from './assignments-panel'

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = key(new Date())

export default function CalendarWidget({ assignments, onXp }: { assignments: Assignment[]; onXp?: () => void }) {
  const router = useRouter()
  const now = new Date()
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState<string>(todayStr)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const byDay = new Map<string, Assignment[]>()
  for (const a of assignments) { const k = a.due_date.slice(0, 10); (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(a) }

  const y = month.getFullYear(), m = month.getMonth()
  const firstDow = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function dotFor(k: string): string | null {
    const list = byDay.get(k)
    if (!list?.length) return null
    if (list.every(a => a.turned_in)) return 'bg-emerald-500'
    if (list.some(a => !a.turned_in && k < todayStr)) return 'bg-red-500'
    if (list.some(a => !a.turned_in && k === todayStr)) return 'bg-amber-400'
    return 'bg-indigo-400'
  }

  const selList = byDay.get(selected) ?? []
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  async function turnIn(a: Assignment) {
    await turnInAssignment(a.id, a.turned_in)
    if (!a.turned_in) onXp?.()
    router.refresh()
  }
  async function add() {
    if (!title.trim()) return
    const fd = new FormData(); fd.set('title', title.trim()); fd.set('due_date', selected)
    await createAssignment(fd)
    setTitle(''); setAdding(false); router.refresh()
  }

  return (
    <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-amber-50 font-medium">{monthName}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(new Date(y, m - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-stone-800 text-stone-400 flex items-center justify-center"><ChevronLeft size={16} /></button>
          <button onClick={() => { const t = new Date(); setMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(todayStr) }} className="text-xs text-indigo-400 px-2">Today</button>
          <button onClick={() => setMonth(new Date(y, m + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-stone-800 text-stone-400 flex items-center justify-center"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 mb-1">
        {WD.map((d, i) => <div key={i} className="text-center text-[10px] text-stone-600 uppercase tracking-wider py-1">{d}</div>)}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const k = key(new Date(y, m, day))
          const isToday = k === todayStr
          const isSel = k === selected
          const dot = dotFor(k)
          return (
            <button key={i} onClick={() => setSelected(k)} className="flex flex-col items-center gap-0.5 py-1">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                isSel ? 'bg-indigo-600 text-white font-medium'
                : isToday ? 'text-indigo-300 ring-1 ring-indigo-500/60'
                : 'text-stone-300 hover:bg-stone-800'}`}>{day}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${dot ?? 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      {/* Selected day agenda */}
      <div className="mt-3 pt-3 border-t border-stone-800">
        <div className="flex items-center justify-between mb-2">
          <p className="text-stone-400 text-xs">{new Date(selected + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <button onClick={() => setAdding(v => !v)} className="text-indigo-400 hover:text-indigo-300 text-xs inline-flex items-center gap-1"><Plus size={12} /> Add</button>
        </div>

        {adding && (
          <div className="flex gap-2 mb-2">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="Assignment…" className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-50 text-sm focus:outline-none focus:border-indigo-500" />
            <button onClick={add} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg px-3">Add</button>
          </div>
        )}

        {selList.length === 0 && !adding && <p className="text-stone-600 text-xs py-2">Nothing due.</p>}
        <div className="flex flex-col gap-1.5">
          {selList.map(a => (
            <div key={a.id} className="group flex items-center gap-2.5">
              <button onClick={() => turnIn(a)} aria-label="Turn in"
                className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors ${a.turned_in ? 'bg-emerald-600 border-emerald-600' : 'border-stone-600 hover:border-indigo-400'}`}>
                {a.turned_in && <Check size={11} className="text-white" />}
              </button>
              <span className={`text-sm flex-1 min-w-0 truncate ${a.turned_in ? 'text-stone-500 line-through' : 'text-amber-100'}`}>{a.title}</span>
              {a.turned_in
                ? <button onClick={() => turnIn(a)} className="text-stone-600 hover:text-stone-300 shrink-0" aria-label="Undo"><Undo2 size={13} /></button>
                : <button onClick={() => deleteAssignment(a.id).then(() => router.refresh())} className="text-stone-600 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100" aria-label="Delete"><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
