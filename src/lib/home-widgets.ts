// The Home screen, iPhone-style: widgets the two of you add, remove, resize
// and drag around. One layout per couple, shared by both of you.
// (Safe to import anywhere: no server code here.)

export type WidgetSize = 's' | 'm' | 'l'
export type WidgetId =
  | 'moves' | 'question' | 'talk' | 'memory' | 'countdown' | 'heart' | 'flame' | 'watching'
  | 'days' | 'letters' | 'bucket' | 'watchlist' | 'song' | 'shortcuts' | 'photos'

export type LayoutItem = { id: WidgetId; size: WidgetSize }

export type WidgetMeta = {
  name: string
  blurb: string
  emoji: string
  sizes: readonly WidgetSize[] // smallest first
  plus?: boolean
}

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  moves:     { name: 'Your move', emoji: '👉', blurb: 'Messages, games and answers waiting on you.', sizes: ['m', 'l'] },
  question:  { name: 'Daily question', emoji: '💬', blurb: 'Today’s question for the two of you.', sizes: ['m', 'l'] },
  talk:      { name: 'Talk time', emoji: '⏱️', blurb: 'Start a timed talk together.', sizes: ['m', 'l'] },
  memory:    { name: 'On this day', emoji: '📸', blurb: 'A memory from this date, or one from the archive.', sizes: ['s', 'm'] },
  countdown: { name: 'Countdown', emoji: '🗓️', blurb: 'Days until your next important date.', sizes: ['s', 'm'] },
  heart:     { name: 'Thinking of you', emoji: '💗', blurb: 'One tap sends a heart.', sizes: ['s', 'm'] },
  flame:     { name: 'Flame', emoji: '🔥', blurb: 'How many days you’ve kept it lit.', sizes: ['s', 'm'] },
  watching:  { name: 'Continue watching', emoji: '🍿', blurb: 'Jump back into your movie night.', sizes: ['m'] },
  days:      { name: 'Days together', emoji: '💞', blurb: 'Every day since you got together.', sizes: ['s', 'm'] },
  letters:   { name: 'Letters', emoji: '💌', blurb: 'Letters waiting for you to open.', sizes: ['s', 'm'] },
  bucket:    { name: 'Bucket list', emoji: '🌍', blurb: 'A dream for today, and how many you’ve done.', sizes: ['s', 'm'] },
  watchlist: { name: 'Up next', emoji: '🎬', blurb: 'The next thing on your watchlist.', sizes: ['s', 'm'] },
  song:      { name: 'Our song', emoji: '🎵', blurb: 'The latest song you saved together.', sizes: ['s', 'm'] },
  shortcuts: { name: 'Shortcuts', emoji: '✨', blurb: 'Your favorite places in Hiranda, one tap away.', sizes: ['m', 'l'] },
  photos:    { name: 'Photo frame', emoji: '🖼️', blurb: 'Your photos, drifting by like a frame on the shelf.', sizes: ['m', 'l'], plus: true },
}

export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[]

export const SIZE_NAMES: Record<WidgetSize, string> = { s: 'Small', m: 'Medium', l: 'Large' }

// What Home looked like before it was customizable, so nothing moves until you move it.
export const DEFAULT_LAYOUT: readonly LayoutItem[] = [
  { id: 'moves', size: 'm' },
  { id: 'question', size: 'm' },
  { id: 'talk', size: 'm' },
  { id: 'memory', size: 's' },
  { id: 'countdown', size: 's' },
  { id: 'heart', size: 's' },
  { id: 'letters', size: 's' },
  { id: 'flame', size: 'm' },
  { id: 'watching', size: 'm' },
]

/** Clean up a saved layout: known widgets only, each once, at a size it has. */
export function normalizeLayout(raw: unknown): LayoutItem[] {
  if (!Array.isArray(raw)) return DEFAULT_LAYOUT.map(i => ({ ...i }))
  const seen = new Set<WidgetId>()
  const out: LayoutItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, size } = item as { id?: unknown; size?: unknown }
    if (typeof id !== 'string' || !(id in WIDGETS) || seen.has(id as WidgetId)) continue
    const meta = WIDGETS[id as WidgetId]
    seen.add(id as WidgetId)
    out.push({ id: id as WidgetId, size: meta.sizes.includes(size as WidgetSize) ? size as WidgetSize : meta.sizes[0] })
  }
  return out
}

/** The next size up, wrapping back to the smallest (the size button cycles). */
export function nextSize(id: WidgetId, size: WidgetSize): WidgetSize {
  const sizes = WIDGETS[id].sizes
  return sizes[(sizes.indexOf(size) + 1) % sizes.length]
}

/** Move the widget at `from` so it sits at `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice()
  if (from < 0 || from >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}
