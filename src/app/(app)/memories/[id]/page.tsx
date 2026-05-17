import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { deleteMemory, deletePhoto } from '../actions'

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: memory } = await supabase
    .from('memories')
    .select('*, photos(*)')
    .eq('id', id)
    .single()

  if (!memory) notFound()

  // Get signed URLs for all photos
  const photosWithUrls = await Promise.all(
    (memory.photos ?? []).map(async (photo: { id: string; storage_path: string; caption: string | null }) => {
      const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 3600)
      return { ...photo, url: data?.signedUrl ?? null }
    })
  )

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <form action={deleteMemory.bind(null, id)}>
          <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-2">
            <Trash2 size={18} />
          </button>
        </form>
      </div>

      <p className="text-stone-500 text-sm mb-2">
        {new Date(memory.happened_at).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })}
      </p>
      <h1 className="font-serif text-4xl text-amber-100 mb-4">{memory.title}</h1>

      {memory.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {memory.tags.map((tag: string) => (
            <span key={tag} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {memory.body && (
        <p className="text-stone-300 leading-relaxed whitespace-pre-wrap mb-8">{memory.body}</p>
      )}

      {photosWithUrls.length > 0 && (
        <div>
          <h2 className="font-serif text-xl text-amber-200 mb-4">Photos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photosWithUrls.map((photo) =>
              photo.url ? (
                <div key={photo.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? ''}
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                  <form
                    action={deletePhoto.bind(null, photo.id, photo.storage_path, id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      type="submit"
                      className="bg-black/60 text-red-400 rounded-lg p-1.5 hover:bg-black/80 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  )
}
