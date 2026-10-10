'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/theater/supabase/server'
import { archiveItem } from '@/theater/catalog/archive'
import { youTubeId, youTubeThumb, youTubeWatchUrl } from '@/theater/youtube'
import { createWatchSessionFromUrl } from './actions'

type Started = { sessionId?: string; error?: string }

// A public-domain film from the Internet Archive → Hiranda's synced player.
export async function startArchiveSession(identifier: string): Promise<Started> {
  const item = await archiveItem(identifier)
  if (!item?.url) return { error: 'That film isn’t available to play right now.' }
  return createWatchSessionFromUrl(item.title, item.url, [], item.poster ?? undefined)
}

// Any YouTube link → the synced YouTube player. Title and thumbnail come from
// YouTube's public oEmbed endpoint when the caller doesn't supply them.
export async function startYouTubeSession(link: string, title?: string, poster?: string): Promise<Started> {
  const id = youTubeId(link)
  if (!id) return { error: 'That doesn’t look like a YouTube link.' }
  let name = title?.trim()
  if (!name) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youTubeWatchUrl(id))}`)
      if (res.ok) name = ((await res.json()) as { title?: string }).title
      else if (res.status === 401 || res.status === 403) return { error: 'That video can’t be played outside YouTube.' }
    } catch { /* fall through to a generic title */ }
  }
  return createWatchSessionFromUrl((name || 'YouTube video').slice(0, 200), youTubeWatchUrl(id), [], poster || youTubeThumb(id))
}

// A streaming service → a party session (extension sync or countdown start).
export async function startPartySession(input: { platform: string; title: string; poster: string | null; url: string }): Promise<Started> {
  let url: URL
  try { url = new URL(input.url) } catch { return { error: 'Bad link' } }
  if (url.protocol !== 'https:') return { error: 'Bad link' }
  const platform = input.platform.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32)
  const title = input.title.trim().slice(0, 200)
  if (!platform || !title) return { error: 'Missing details' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('watch_sessions')
    .insert({
      title, storage_path: '', source_type: 'party', platform,
      party_url: url.toString(), thumbnail_url: input.poster, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { error: 'Couldn’t start the party — try again' }
  revalidatePath('/watch')
  return { sessionId: data.id }
}

// A video card on the Theater page or in search (a plain form, so it works
// before JS loads) → straight into the synced player.
export async function playYouTube(videoId: string, title: string, thumb: string) {
  const res = await startYouTubeSession(videoId, title, thumb)
  if (!res.sessionId) redirect(`/watch?error=${encodeURIComponent(res.error ?? 'Couldn’t start that video')}`)
  redirect(`/watch/${res.sessionId}`)
}
