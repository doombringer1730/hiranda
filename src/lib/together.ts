import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// Time the two of you actually spent together in Hiranda: watch nights and
// talk time. Shown as a keepsake, never a score (Hall 2018: closeness is built
// from hours together). Watch time is the furthest point you reached in each
// session, capped so a paused-overnight tab can't count for a day.

export type Stub = { id: string; title: string; when: string; seconds: number; kind: 'watch' | 'talk' }

const MAX_WATCH_SECONDS = 4 * 3600

/** Every watch night and finished talk, newest first. `from`/`to` are ISO bounds. */
export async function togetherStubs(supabase: SupabaseClient, from?: string, to?: string): Promise<Stub[]> {
  let watch = supabase.from('watch_sessions').select('id, title, created_at, playback_position_seconds').gt('playback_position_seconds', 60)
  let talk = supabase.from('talk_sessions').select('id, minutes, started_at, ended_at, completed')
  if (from) { watch = watch.gte('created_at', from); talk = talk.gte('started_at', from) }
  if (to) { watch = watch.lt('created_at', to); talk = talk.lt('started_at', to) }
  const [{ data: w }, { data: t }] = await Promise.all([
    watch.order('created_at', { ascending: false }).limit(1000),
    talk.order('started_at', { ascending: false }).limit(1000),
  ])
  const stubs: Stub[] = []
  for (const s of (w ?? []) as { id: string; title: string; created_at: string; playback_position_seconds: number }[]) {
    stubs.push({ id: s.id, title: s.title, when: s.created_at, seconds: Math.min(MAX_WATCH_SECONDS, Math.round(s.playback_position_seconds)), kind: 'watch' })
  }
  for (const s of (t ?? []) as { id: string; minutes: number; started_at: string; ended_at: string | null; completed: boolean }[]) {
    const over = !s.ended_at && new Date(s.started_at).getTime() + s.minutes * 60_000 <= Date.now()
    if (s.completed || over) stubs.push({ id: s.id, title: 'Talk time', when: s.started_at, seconds: s.minutes * 60, kind: 'talk' })
  }
  return stubs.sort((a, b) => b.when.localeCompare(a.when))
}

export const totalHours = (stubs: Stub[]) => stubs.reduce((n, s) => n + s.seconds, 0) / 3600

export function duration(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60)
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

// Gentle milestones to look forward to, not targets.
export const HOUR_MILESTONES = [10, 25, 50, 100, 200, 500]
