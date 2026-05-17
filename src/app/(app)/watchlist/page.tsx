import { createClient } from '@/lib/supabase/server'
import { getProfileMap } from '@/lib/profiles'
import { addToWatchlist, markWatched, removeFromWatchlist } from './actions'
import { Plus, Clapperboard, Trash2, CheckCircle2, Tv, Film } from 'lucide-react'

type Item = {
  id: string
  title: string
  type: 'movie' | 'show'
  note: string | null
  watched: boolean
  watched_at: string | null
  added_by: string
}

export default async function WatchlistPage() {
  const supabase = await createClient()
  const [{ data: items }, profiles] = await Promise.all([
    supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false }),
    getProfileMap(),
  ])

  const unwatched = (items ?? []).filter(i => !i.watched) as Item[]
  const watched = (items ?? []).filter(i => i.watched) as Item[]

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <h2 className="font-serif text-3xl text-amber-100 mb-8">Watchlist</h2>

      {/* Add form */}
      <form action={addToWatchlist} className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-5 mb-8 flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            name="title"
            type="text"
            required
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Movie or show title…"
          />
          <select
            name="type"
            className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-3 text-stone-400 focus:outline-none focus:border-amber-700 transition-colors"
          >
            <option value="movie">Movie</option>
            <option value="show">Show</option>
          </select>
        </div>
        <div className="flex gap-3">
          <input
            name="note"
            type="text"
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Note (optional) — where it's streaming, why you want to watch it…"
          />
          <button
            type="submit"
            className="bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl px-4 py-3 transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </form>

      {/* Empty state */}
      {!items?.length && (
        <div className="text-center py-24">
          <Clapperboard size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">Nothing on the list yet.</p>
        </div>
      )}

      {/* Unwatched */}
      <div className="flex flex-col gap-3">
        {unwatched.map(item => (
          <WatchlistRow
            key={item.id}
            item={item}
            name={profiles.get(item.added_by)}
          />
        ))}
      </div>

      {/* Watched */}
      {watched.length > 0 && (
        <div className="mt-10">
          <p className="text-stone-600 text-xs uppercase tracking-widest mb-3">Watched ✓</p>
          <div className="flex flex-col gap-3 opacity-50">
            {watched.map(item => (
              <WatchlistRow
                key={item.id}
                item={item}
                name={profiles.get(item.added_by)}
                done
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WatchlistRow({ item, name, done = false }: { item: Item; name?: string; done?: boolean }) {
  const Icon = item.type === 'show' ? Tv : Film

  return (
    <div className="flex items-start gap-3 bg-stone-900/80 border border-stone-800/80 rounded-xl px-4 py-3.5 group card-glow">
      {!done ? (
        <form action={markWatched.bind(null, item.id)} className="flex-shrink-0 pt-0.5">
          <button
            type="submit"
            title="Mark as watched"
            className="text-stone-600 hover:text-amber-400 transition-colors"
          >
            <CheckCircle2 size={22} />
          </button>
        </form>
      ) : (
        <CheckCircle2 size={22} className="text-amber-700 flex-shrink-0 mt-0.5" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${done ? 'line-through text-stone-600' : 'text-amber-50'}`}>
            {item.title}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
            item.type === 'show'
              ? 'bg-blue-950/50 text-blue-400 border-blue-900'
              : 'bg-purple-950/50 text-purple-400 border-purple-900'
          }`}>
            <Icon size={11} />
            {item.type === 'show' ? 'Show' : 'Movie'}
          </span>
        </div>
        {item.note && (
          <p className="text-stone-500 text-xs mt-1 leading-relaxed">{item.note}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {name && <span className="text-stone-600 text-xs">{name}</span>}
          {done && item.watched_at && (
            <span className="text-stone-700 text-xs">
              {name && '·'} watched {new Date(item.watched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <form action={removeFromWatchlist.bind(null, item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
        <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={15} />
        </button>
      </form>
    </div>
  )
}
