import 'server-only'
import type { coupleContext } from '@/lib/couple'
import { ROUTES, stopKeyForTrailDay, routeAccess, routeByKey, stopByKey, type Access, type Agreement, type Done } from '@/lib/grow-map'

type Ctx = NonNullable<Awaited<ReturnType<typeof coupleContext>>>

// Who has finished which map stops, read from lesson_progress plus the old
// Trails table (trail_progress), so progress made before the map still counts.
export async function loadProgress(ctx: Ctx) {
  const [{ data: lessons }, { data: trails }, { data: routes }] = await Promise.all([
    ctx.supabase.from('lesson_progress').select('user_id, lesson_key, note, completed_at').eq('couple_id', ctx.couple.id),
    ctx.supabase.from('trail_progress').select('user_id, trail_key, day, note, completed_at').eq('couple_id', ctx.couple.id),
    // Suggestions to open a hard-topic route (migration 052). Before it runs, this
    // errors and every hard-topic route just shows "suggest it".
    ctx.supabase.from('grow_routes').select('route_key, proposed_by, accepted_by').eq('couple_id', ctx.couple.id),
  ])
  const agreements = new Map<string, Agreement>(((routes ?? []) as ({ route_key: string } & Agreement)[]).map(r => [r.route_key, r]))
  const done: Done = new Map()
  const notes = new Map<string, Map<string, string | null>>() // stop → user → note
  const firstDoneAt = new Map<string, number>() // route → earliest finish by either of you

  const add = (key: string | null, user: string, note: string | null, at: string) => {
    const stop = key ? stopByKey(key) : null
    if (!stop) return
    done.set(stop.key, (done.get(stop.key) ?? new Set()).add(user))
    if (!notes.get(stop.key)?.has(user) || note) notes.set(stop.key, (notes.get(stop.key) ?? new Map()).set(user, note))
    const t = new Date(at).getTime()
    const r = stop.route.key
    if (!firstDoneAt.has(r) || t < firstDoneAt.get(r)!) firstDoneAt.set(r, t)
  }
  for (const l of lessons ?? []) add(l.lesson_key, l.user_id, l.note, l.completed_at)
  for (const t of trails ?? []) add(stopKeyForTrailDay(t.trail_key, t.day), t.user_id, t.note, t.completed_at)
  return { done, notes, firstDoneAt, agreements }
}

/** Where this couple stands on a route: open, Plus, or waiting on a mutual yes. */
export function accessOf(routeKey: string, m: { firstDoneAt: Map<string, number>; agreements: Map<string, Agreement> }, plus: boolean, me: string): Access {
  const route = routeByKey(routeKey)
  if (!route) return 'plus'
  return routeAccess(route, { me, plus, firstDoneAt: m.firstDoneAt, agreement: m.agreements.get(routeKey) })
}

export { ROUTES }
