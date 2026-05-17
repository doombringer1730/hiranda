import { createClient } from '@/lib/supabase/server'
import { getProfileMap } from '@/lib/profiles'
import { addTodo, toggleTodo, deleteTodo } from './actions'
import { Plus, Trash2, ClipboardList } from 'lucide-react'

export default async function TodosPage() {
  const supabase = await createClient()
  const [{ data: todos }, profiles] = await Promise.all([
    supabase.from('todos').select('*').order('created_at', { ascending: true }),
    getProfileMap(),
  ])

  const open = todos?.filter(t => !t.completed) ?? []
  const done = todos?.filter(t => t.completed) ?? []

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <h2 className="font-serif text-3xl text-amber-100 mb-8">Todos</h2>

      <form action={addTodo} className="flex gap-3 mb-8">
        <input
          name="text"
          type="text"
          required
          className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
          placeholder="Add a task…"
        />
        <button
          type="submit"
          className="bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl px-4 py-3 transition-colors"
        >
          <Plus size={20} />
        </button>
      </form>

      {!todos?.length && (
        <div className="text-center py-24">
          <ClipboardList size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">Nothing on the list yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {open.map((todo) => (
          <TodoRow key={todo.id} todo={todo} name={profiles.get(todo.created_by)} />
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-8">
          <p className="text-stone-600 text-xs uppercase tracking-widest mb-3">Done</p>
          <div className="flex flex-col gap-2 opacity-50">
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} name={profiles.get(todo.created_by)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TodoRow({ todo, name }: { todo: { id: string; text: string; completed: boolean }; name?: string }) {
  return (
    <div className="flex items-center gap-3 bg-stone-900/80 border border-stone-800/80 rounded-xl px-4 py-3 group card-glow">
      <form action={toggleTodo.bind(null, todo.id, !todo.completed)}>
        <button
          type="submit"
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
            todo.completed
              ? 'bg-amber-700 border-amber-700'
              : 'border-stone-600 hover:border-amber-600'
          }`}
        />
      </form>
      <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-stone-600' : 'text-amber-50'}`}>
        {todo.text}
      </span>
      {name && <span className="text-stone-600 text-xs flex-shrink-0">{name}</span>}
      <form action={deleteTodo.bind(null, todo.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={15} />
        </button>
      </form>
    </div>
  )
}
