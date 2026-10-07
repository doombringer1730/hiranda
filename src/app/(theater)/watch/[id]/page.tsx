import { createClient } from '@/theater/supabase/server'
import { notFound, redirect } from 'next/navigation'
import WatchPlayer from './watch-player'
import YouTubePlayer from './youtube-player'
import { youTubeId } from '@/theater/youtube'
import { deleteWatchSession } from '../actions'

export default async function WatchSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('watch_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) notFound()
  if (session.source_type === 'party') redirect(`/party/${id}`)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profiles } = await supabase.from('profiles').select('id, display_name')
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name]))

  const sourceType = session.source_type ?? 'upload'
  let videoUrl: string | null = null

  if (sourceType === 'upload') {
    const { data: signed } = await supabase.storage
      .from('videos')
      .createSignedUrl(session.storage_path, 7200)
    if (!signed?.signedUrl) notFound()
    videoUrl = signed.signedUrl
  } else if (sourceType === 'url') {
    videoUrl = session.source_url ?? null
  }
  // local: videoUrl stays null — player shows file picker

  // YouTube links get YouTube's own embedded player, synced the same way.
  const ytId = sourceType === 'url' ? youTubeId(videoUrl) : null
  if (ytId) {
    return (
      <YouTubePlayer
        sessionId={id}
        title={session.title}
        videoId={ytId}
        userId={user!.id}
        profileMap={profileMap}
        initialState={session.state ?? 'paused'}
        initialPosition={session.playback_position_seconds ?? 0}
        deleteAction={deleteWatchSession.bind(null, id, null)}
      />
    )
  }

  return (
    <WatchPlayer
      sessionId={id}
      title={session.title}
      sourceType={sourceType}
      videoUrl={videoUrl}
      sourceHint={session.source_hint ?? null}
      storagePath={sourceType === 'upload' ? session.storage_path : null}
      userId={user!.id}
      profileMap={profileMap}
      initialState={session.state ?? 'paused'}
      initialPosition={session.playback_position_seconds ?? 0}
      fallbackUrls={session.fallback_urls ?? []}
      deleteAction={deleteWatchSession.bind(null, id, sourceType === 'upload' ? session.storage_path : null)}
    />
  )
}
