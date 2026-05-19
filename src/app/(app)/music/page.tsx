import { createClient } from '@/lib/supabase/server'
import { getProfileMap } from '@/lib/profiles'
import { addMusicMoment, deleteMusicMoment } from './actions'
import { Music, Plus, ExternalLink, Trash2 } from 'lucide-react'

async function fetchAlbumArt(spotifyUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, {
      next: { revalidate: 86400 }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.thumbnail_url ?? null
  } catch {
    return null
  }
}

export default async function MusicPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: moments }, profiles] = await Promise.all([
    supabase
      .from('music_moments')
      .select('*')
      .order('created_at', { ascending: false }),
    getProfileMap(),
  ])

  const albumArts = await Promise.all(
    (moments ?? []).map(m => m.spotify_url ? fetchAlbumArt(m.spotify_url) : Promise.resolve(null))
  )

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Music size={28} className="text-amber-700" />
        <h2 className="font-serif text-3xl text-amber-100">Music</h2>
      </div>

      {/* Add form */}
      <form action={addMusicMoment} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-8 flex flex-col gap-3">
        <p className="text-stone-400 text-xs uppercase tracking-widest mb-1">Add a song</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="song_name"
            type="text"
            required
            placeholder="Song name"
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors text-sm"
          />
          <input
            name="artist"
            type="text"
            required
            placeholder="Artist"
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors text-sm"
          />
        </div>
        <input
          name="spotify_url"
          type="url"
          placeholder="Spotify link (optional)"
          className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors text-sm"
        />
        <input
          name="note"
          type="text"
          placeholder="Why it matters (optional)"
          className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors text-sm"
        />
        <button
          type="submit"
          className="self-end flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} /> Add song
        </button>
      </form>

      {/* Empty state */}
      {!moments?.length && (
        <div className="text-center py-24">
          <Music size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No songs yet. Add the soundtrack of your relationship.</p>
        </div>
      )}

      {/* Song list */}
      <div className="flex flex-col gap-3">
        {moments?.map((m, i) => {
          const art = albumArts[i]

          return (
            <div key={m.id} className="flex items-center gap-4 bg-stone-900/80 border border-stone-800/80 rounded-xl overflow-hidden group card-glow">
              {art ? (
                <img src={art} alt={m.song_name} className="w-16 h-16 object-cover flex-shrink-0" />
              ) : (
                <div className={`w-16 h-16 flex items-center justify-center flex-shrink-0 ${m.spotify_url ? 'bg-green-950/40' : 'bg-stone-800'}`}>
                  <Music size={20} className={m.spotify_url ? 'text-green-500' : 'text-amber-700'} />
                </div>
              )}

              <div className="flex-1 min-w-0 py-3 pr-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-amber-100 font-medium truncate">{m.song_name}</p>
                    <p className="text-stone-400 text-sm">{m.artist}</p>
                    {m.note && <p className="text-stone-500 text-xs mt-1 italic">{m.note}</p>}
                    <p className="text-stone-600 text-xs mt-1.5">{profiles.get(m.added_by)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {m.spotify_url && (
                      <a
                        href={m.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-stone-600 hover:text-green-400 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {m.added_by === user?.id && (
                      <form action={deleteMusicMoment.bind(null, m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="submit" className="p-1.5 text-stone-600 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
