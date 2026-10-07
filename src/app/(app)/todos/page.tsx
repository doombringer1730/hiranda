import { createClient } from '@/lib/supabase/server'
import { getPeople, type Person } from '@/lib/profiles'
import { addTodo, toggleTodo, deleteTodo } from './actions'
import { Plus, X } from 'lucide-react'
import PageHeader from '@/components/page-header'
import CheckButton from '@/components/check-button'
import { PersonChip } from '@/components/ui'

// The fridge list, literally: one sticky note, written by hand, that you
// both add to and tick off.
export default async function TodosPage() {
  const supabase = await createClient()
  const [{ data: todos }, people] = await Promise.all([
    supabase.from('todos').select('*').order('created_at', { ascending: true }),
    getPeople(),
  ])

  const open = todos?.filter(t => !t.completed) ?? []
  const done = (todos?.filter(t => t.completed) ?? []).slice(-12)

  return (
    <div className="px-4 pt-6 pb-12 max-w-xl mx-auto">
      <PageHeader eyebrow="The fridge list" title="Todos" />
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-8">
        {open.length ? `${open.length} thing${open.length === 1 ? '' : 's'} left — you’ve got this.` : 'all clear. go do something fun.'}
      </p>

      <div className="paper paper-ruled rounded-[4px] px-5 pt-9 pb-5 -rotate-[0.5deg]" style={{ background: undefined }}>
        <span aria-hidden className="absolute -top-3 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-amber-600 shadow-[0_3px_6px_rgb(0_0_0/0.35),inset_0_2px_0_rgb(255_255_255/0.3)]" />

        <ul className="flex flex-col">
          {open.map(todo => <TodoRow key={todo.id} todo={todo} person={people.get(todo.created_by)} />)}
        </ul>

        <form action={addTodo} className="flex items-center gap-3 mt-1">
          <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-[rgb(43_38_32/0.25)]" />
          <input
            name="text"
            type="text"
            required
            maxLength={200}
            className="flex-1 min-w-0 bg-transparent font-hand text-[23px] leading-[30px] py-1 text-[var(--paper-ink)] placeholder:text-[rgb(43_38_32/0.35)] focus:outline-none"
            placeholder="write it down…"
          />
          <button type="submit" aria-label="Add" className="grid place-items-center h-9 w-9 rounded-full bg-[var(--paper-ink)] text-[var(--paper)]">
            <Plus size={17} />
          </button>
        </form>

        {done.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--paper-muted)] mt-6 mb-1">done</p>
            <ul className="flex flex-col opacity-60">
              {done.map(todo => <TodoRow key={todo.id} todo={todo} person={people.get(todo.created_by)} />)}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function TodoRow({ todo, person }: { todo: { id: string; text: string; completed: boolean }; person?: Person }) {
  return (
    <li className="group flex items-center gap-3 min-h-[44px]">
      <form action={toggleTodo.bind(null, todo.id, !todo.completed)}>
        <CheckButton done={todo.completed} label={todo.text} />
      </form>
      <span className={`flex-1 min-w-0 font-hand text-[23px] leading-[1.15] text-[var(--paper-ink)] ${todo.completed ? 'line-through decoration-2 decoration-amber-700/60' : ''}`}>
        {todo.text}
      </span>
      <PersonChip person={person} size={18} />
      <form action={deleteTodo.bind(null, todo.id)} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button type="submit" aria-label={`Remove “${todo.text}”`} className="grid place-items-center h-9 w-9 rounded-full text-[var(--paper-muted)] hover:text-red-600">
          <X size={15} />
        </button>
      </form>
    </li>
  )
}
