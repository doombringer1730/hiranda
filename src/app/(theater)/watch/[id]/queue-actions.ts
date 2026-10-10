'use server'

import { createClient } from '@/theater/supabase/server'
import { ytSearch, ytTitle, type YtVideo } from '@/theater/catalog/youtube'
import { youTubeId, youTubeThumb, youTubeWatchUrl } from '@/theater/youtube'

// "Up next" for a YouTube session: search without leaving the player, line
// videos up, and move on together when one ends. RLS keeps every row inside
// the couple that owns the session.

type Picked = { id: string; title: string; thumb?: string | null; duration?: number | null }
export type NowPlaying = { videoId: string; title: string }

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? supabase : null
}

const clean = (v: Picked) => {
  const id = youTubeId(v.id)
  if (!id) return null
  return { id, title: (v.title || 'YouTube video').trim().slice(0, 200), thumb: v.thumb?.startsWith('https://') ? v.thumb.slice(0, 500) : youTubeThumb(id), duration: v.duration ?? null }
}

/** Search from inside the player. A pasted YouTube link comes back as itself. */
export async function searchYouTube(query: string): Promise<YtVideo[]> {
  if (!(await signedIn())) return []
  const id = youTubeId(query)
  if (id) return [{ id, title: (await ytTitle(id)) ?? 'YouTube video', channel: 'From your link', thumb: youTubeThumb(id), duration: null, live: false }]
  return ytSearch(query)
}

export async function addToQueue(sessionId: string, video: Picked) {
  const supabase = await signedIn()
  const v = clean(video)
  if (!supabase || !v) return { error: 'Couldn’t add that' }
  const { error } = await supabase.from('watch_queue').insert({ session_id: sessionId, video_id: v.id, title: v.title, thumb: v.thumb, duration: v.duration })
  return error ? { error: 'Couldn’t add that — try again' } : { ok: true }
}

export async function removeFromQueue(itemId: string) {
  const supabase = await signedIn()
  if (!supabase) return
  await supabase.from('watch_queue').delete().eq('id', itemId)
}

// Points the session at a new video, starting from the top, playing.
// `onlyIf` makes it conditional: when you both reach the end at once, only
// the first switch lands and the other gets the video already chosen.
async function switchTo(sessionId: string, v: { id: string; title: string; thumb: string | null }, onlyIf?: string) {
  const supabase = (await signedIn())!
  let q = supabase.from('watch_sessions').update({
    source_url: youTubeWatchUrl(v.id), title: v.title, thumbnail_url: v.thumb,
    state: 'playing', playback_position_seconds: 0, updated_at: new Date().toISOString(),
  }).eq('id', sessionId)
  if (onlyIf) q = q.eq('source_url', youTubeWatchUrl(onlyIf))
  const { data } = await q.select('id')
  return (data?.length ?? 0) > 0
}

async function current(sessionId: string): Promise<NowPlaying | null> {
  const supabase = (await signedIn())!
  const { data } = await supabase.from('watch_sessions').select('source_url, title').eq('id', sessionId).maybeSingle()
  const id = youTubeId(data?.source_url)
  return id ? { videoId: id, title: data!.title } : null
}

/** The video that just ended → the next one in line (null when the list is empty). */
export async function playNext(sessionId: string, endedVideoId: string): Promise<NowPlaying | null> {
  const supabase = await signedIn()
  if (!supabase || !youTubeId(endedVideoId)) return null
  const { data: next } = await supabase.from('watch_queue').select('id, video_id, title, thumb')
    .eq('session_id', sessionId).is('played_at', null).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!next) return null
  const won = await switchTo(sessionId, { id: next.video_id, title: next.title, thumb: next.thumb }, endedVideoId)
  if (!won) return current(sessionId) // your partner's player got there first
  await supabase.from('watch_queue').update({ played_at: new Date().toISOString() }).eq('id', next.id)
  return { videoId: next.video_id, title: next.title }
}

/** "Play now" on a queued video. */
export async function playQueued(sessionId: string, itemId: string): Promise<NowPlaying | null> {
  const supabase = await signedIn()
  if (!supabase) return null
  const { data: item } = await supabase.from('watch_queue').select('id, video_id, title, thumb').eq('id', itemId).eq('session_id', sessionId).maybeSingle()
  if (!item) return null
  if (!(await switchTo(sessionId, { id: item.video_id, title: item.title, thumb: item.thumb }))) return null
  await supabase.from('watch_queue').update({ played_at: new Date().toISOString() }).eq('id', item.id)
  return { videoId: item.video_id, title: item.title }
}

/** "Play now" on a search result, skipping the list. */
export async function playNow(sessionId: string, video: Picked): Promise<NowPlaying | null> {
  const v = clean(video)
  if (!v || !(await signedIn())) return null
  if (!(await switchTo(sessionId, v))) return null
  return { videoId: v.id, title: v.title }
}
