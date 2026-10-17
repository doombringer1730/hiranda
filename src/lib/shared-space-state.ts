// Pure helpers for the shared-space hooks (shared-space.tsx), kept apart so
// tests can run them. Everything here handles what the partner's devices send,
// so it's checked and trimmed before the UI sees it.

/** Where someone is: a room (the app section), maybe an item in it. */
export type Place = { room: string; item?: string; label?: string }

/** One device's presence: where it is, whether it's on screen, and when. */
export type Meta = { place: Place | null; visible: boolean; at: number; name?: string }

const ROOM = /^[a-z0-9-]{1,40}$/
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined)

export function cleanPlace(v: unknown): Place | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.room !== 'string' || !ROOM.test(o.room)) return null
  const item = str(o.item, 80), label = str(o.label, 120)
  return { room: o.room, ...(item ? { item } : {}), ...(label ? { label } : {}) }
}

function cleanMeta(v: unknown): Meta | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  return {
    place: cleanPlace(o.place),
    visible: o.visible === true,
    at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0,
    ...(str(o.name, 40) ? { name: str(o.name, 40) } : {}),
  }
}

/**
 * The partner may be on two devices (phone and laptop, or two tabs). Their
 * "where" is the device they're looking at; failing that, the latest one.
 */
export function pickMeta(metas: readonly unknown[] | undefined): Meta | null {
  let best: Meta | null = null
  for (const m of metas ?? []) {
    const c = cleanMeta(m)
    if (!c) continue
    if (!best || (c.visible && !best.visible) || (c.visible === best.visible && c.at > best.at)) best = c
  }
  return best
}

export function samePlace(a: Place | null, b: Place | null) {
  return a === b || (!!a && !!b && a.room === b.room && a.item === b.item && a.label === b.label)
}

/** The room a path belongs to: /memories/123 → memories, / → home. */
export function roomFromPath(path: string) {
  const seg = path.split('/').find(Boolean)?.toLowerCase() ?? 'home'
  return ROOM.test(seg) ? seg : 'home'
}

/** A heart from the partner: just the moment they sent it. */
export function cleanLove(v: unknown): { at: number } | null {
  if (!v || typeof v !== 'object') return null
  const at = (v as Record<string, unknown>).at
  return typeof at === 'number' && Number.isFinite(at) ? { at } : null
}

/** A typing ping from the partner: which item, and started or stopped. */
export function cleanTyping(v: unknown): { item: string; on: boolean } | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const item = str(o.item, 80)
  return item && typeof o.on === 'boolean' ? { item, on: o.on } : null
}

const ROOMS: Record<string, string> = {
  home: 'on Home', chat: 'in the chat', memories: 'in Memories', journal: 'in the journal', letters: 'in Letters',
  music: 'in Music', watchlist: 'in the watchlist', games: 'playing games', grow: 'in Grow', trails: 'on a trail',
  library: 'in the library', study: 'studying', todos: 'in To-dos', dates: 'in Dates', store: 'in the store',
  together: 'in Together', month: 'looking back at the month', settings: 'in Settings', plus: 'looking at Plus',
  'bucket-list': 'on the bucket list', closeness: 'checking in',
}

/** "in Memories", or "looking at “Lisbon”" when they have something open. */
export function describePlace(p: Place | null): string | null {
  if (!p) return null
  if (p.label) return `looking at “${p.label}”`
  return ROOMS[p.room] ?? `in ${p.room.replace(/-/g, ' ')}`
}
