import { createClient } from '@/lib/supabase/server'
import { getProfileMap } from '@/lib/profiles'
import { addBucketItem, completeBucketItem, deleteBucketItem } from './actions'
import { Plus, Trash2, Star, CheckCircle2 } from 'lucide-react'

const CATEGORIES = ['travel', 'food', 'experience', 'other'] as const
type Category = typeof CATEGORIES[number]

const categoryLabel: Record<Category, string> = {
  travel: 'Travel',
  food: 'Food',
  experience: 'Experience',
  other: 'Other',
}

const categoryColour: Record<Category, string> = {
  travel:     'bg-blue-950/50 text-blue-400 border-blue-900',
  food:       'bg-orange-950/50 text-orange-400 border-orange-900',
  experience: 'bg-purple-950/50 text-purple-400 border-purple-900',
  other:      'bg-stone-800 text-stone-400 border-stone-700',
}

export default async function BucketListPage() {
  const supabase = await createClient()
  const [{ data: items }, profiles] = await Promise.all([
    supabase.from('bucket_list').select('*').order('created_at', { ascending: false }),
    getProfileMap(),
  ])

  const open = items?.filter(i => !i.completed) ?? []
  const done = items?.filter(i => i.completed) ?? []

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      <h2 className="font-serif text-3xl text-amber-100 mb-8">Bucket List</h2>

      <form action={addBucketItem} className="bg-stone-900 border border-stone-800 rounded-2xl p-4 mb-8 flex flex-col gap-3">
        <input
          name="title"
          type="text"
          required
          className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
          placeholder="Something to do together…"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            name="category"
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 focus:outline-none focus:border-amber-700 transition-colors"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{categoryLabel[c]}</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl px-5 py-3 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </form>

      {!items?.length && (
        <div className="text-center py-24">
          <Star size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No dreams on the list yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {open.map((item) => (
          <BucketRow key={item.id} item={item} name={profiles.get(item.created_by)} />
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-10">
          <p className="text-stone-600 text-xs uppercase tracking-widest mb-3">Done ✓</p>
          <div className="flex flex-col gap-3 opacity-50">
            {done.map((item) => (
              <BucketRow key={item.id} item={item} done name={profiles.get(item.created_by)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BucketRow({ item, done = false, name }: { item: { id: string; title: string; category: Category }; done?: boolean; name?: string }) {
  const colour = categoryColour[item.category] ?? categoryColour.other
  return (
    <div className="flex items-center gap-3 bg-stone-900/80 border border-stone-800/80 rounded-xl px-4 py-3.5 group card-glow">
      {!done ? (
        <form action={completeBucketItem.bind(null, item.id)}>
          <button type="submit" className="text-stone-600 hover:text-amber-400 transition-colors flex-shrink-0">
            <CheckCircle2 size={22} />
          </button>
        </form>
      ) : (
        <CheckCircle2 size={22} className="text-amber-700 flex-shrink-0" />
      )}
      <span className={`flex-1 text-sm ${done ? 'line-through text-stone-600' : 'text-amber-50'}`}>
        {item.title}
      </span>
      {name && <span className="text-stone-600 text-xs flex-shrink-0">{name}</span>}
      <span className={`text-xs border px-2 py-0.5 rounded-full flex-shrink-0 ${colour}`}>
        {categoryLabel[item.category] ?? item.category}
      </span>
      <form action={deleteBucketItem.bind(null, item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={15} />
        </button>
      </form>
    </div>
  )
}
