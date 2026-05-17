import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import WatchPlayer from './watch-player'
import { deleteWatchSession } from '../actions'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default async function WatchSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('watch_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) notFound()

  const { data: signedData } = await supabase.storage
    .from('videos')
    .createSignedUrl(session.storage_path, 7200)

  if (!signedData?.signedUrl) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="px-4 pt-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/watch" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-serif text-xl text-amber-100 truncate mx-4">{session.title}</h1>
        <form action={deleteWatchSession.bind(null, id, session.storage_path)}>
          <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-2">
            <Trash2 size={18} />
          </button>
        </form>
      </div>

      <WatchPlayer
        sessionId={id}
        videoUrl={signedData.signedUrl}
        userId={user!.id}
        initialState={session.state}
        initialPosition={session.playback_position_seconds}
      />
    </div>
  )
}
