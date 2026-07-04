import { createClient } from '@/lib/supabase/server'
import { getProfileMap } from '@/lib/profiles'
import Link from 'next/link'
import { Plus, Camera, Map, History } from 'lucide-react'

type Flashback = {
  id: string
  title: string
  happened_at: string
  photos: { id: string; storage_path: string }[] | null
}

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: memories }, { data: pastMemories }, profiles] = await Promise.all([
    supabase
      .from('memories')
      .select('*, photos(id, storage_path)')
      .order('happened_at', { ascending: false })
      .limit(20),
    supabase
      .from('memories')
      .select('id, title, happened_at, photos(id, storage_path)')
      .lt('happened_at', new Date().toISOString().slice(0, 10)),
    getProfileMap(),
  ])

  // "On this day" — memories from the same month/day in a past year.
  // happened_at is a plain YYYY-MM-DD date; compare parts to avoid TZ shifts.
  const now = new Date()
  const flashbacks: Flashback[] = ((pastMemories ?? []) as Flashback[]).filter(m => {
    const [y, mo, da] = m.happened_at.split('-').map(Number)
    return mo === now.getMonth() + 1 && da === now.getDate() && y < now.getFullYear()
  })

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto">
      {flashbacks.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
          {flashbacks.map(fb => {
            const yearsAgo = now.getFullYear() - Number(fb.happened_at.slice(0, 4))
            const coverPhoto = fb.photos?.[0]
            return (
              <Link
                key={fb.id}
                href={`/memories/${fb.id}`}
                className="group bg-amber-900/20 border border-amber-800/40 rounded-2xl p-5 hover:border-amber-700/60 card-glow flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-1.5 text-amber-500 text-xs uppercase tracking-widest mb-1.5">
                    <History size={12} />
                    On this day · {yearsAgo} year{yearsAgo !== 1 ? 's' : ''} ago
                  </p>
                  <h3 className="font-serif text-xl text-amber-100 group-hover:text-amber-300 transition-colors truncate">
                    {fb.title}
                  </h3>
                </div>
                {coverPhoto && (
                  <PhotoThumb path={coverPhoto.storage_path} supabase={supabase} />
                )}
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Memories</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/memories/map"
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors"
          >
            <Map size={16} />
          </Link>
          <Link
            href="/memories/new"
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={16} />
            New
          </Link>
        </div>
      </div>

      {!memories?.length && (
        <div className="text-center py-24">
          <Camera size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No memories yet. Add your first one.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {memories?.map((memory) => {
          const coverPhoto = memory.photos?.[0]
          return (
            <Link
              key={memory.id}
              href={`/memories/${memory.id}`}
              className="group bg-stone-900/80 border border-stone-800/80 rounded-2xl overflow-hidden hover:border-amber-800/50 card-glow"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-xl text-amber-100 group-hover:text-amber-300 transition-colors truncate">
                      {memory.title}
                    </h3>
                    <p className="text-stone-500 text-sm mt-1">
                      {new Date(memory.happened_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                      {profiles.get(memory.created_by) && (
                        <span className="text-stone-600"> · {profiles.get(memory.created_by)}</span>
                      )}
                    </p>
                    {memory.body && (
                      <p className="text-stone-400 text-sm mt-2 line-clamp-2">{memory.body}</p>
                    )}
                  </div>
                  {coverPhoto && (
                    <PhotoThumb path={coverPhoto.storage_path} supabase={supabase} />
                  )}
                </div>

                {memory.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {memory.tags.map((tag: string) => (
                      <span key={tag} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {memory.photos?.length > 0 && (
                  <p className="text-stone-600 text-xs mt-3 flex items-center gap-1">
                    <Camera size={12} /> {memory.photos.length} photo{memory.photos.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

async function PhotoThumb({ path, supabase }: { path: string; supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
  if (!data?.signedUrl) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data.signedUrl} alt="" width={64} height={64} loading="lazy" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
}
