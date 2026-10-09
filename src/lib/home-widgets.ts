// The Home screen, iPhone-style: widgets the two of you add, remove, resize
// and drag around. One layout per couple, shared by both of you. Arranging it
// is part of Plus; without Plus, Home is DEFAULT_LAYOUT.
// (Safe to import anywhere: no server code here.)

// Sizes work like iPhone widgets: small is one square, medium is two squares
// side by side, large is a two-by-two square.
export type WidgetSize = 's' | 'm' | 'l'
export type WidgetId =
  | 'moves' | 'question' | 'talk' | 'memory' | 'countdown' | 'heart' | 'flame' | 'watching'
  | 'clocks' | 'calendar' | 'todos' | 'journal' | 'days' | 'letters' | 'bucket' | 'watchlist' | 'song'
  | 'shortcuts' | 'photos'

export type LayoutItem = { id: WidgetId; size: WidgetSize }

export type WidgetMeta = {
  name: string
  blurb: string
  emoji: string
  sizes: readonly WidgetSize[] // smallest first
  plus?: boolean
}

// In the order the widget gallery lists them.
export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  moves:     { name: 'Your move', emoji: '👉', blurb: 'Messages, games and answers waiting on you.', sizes: ['m', 'l'] },
  question:  { name: 'Daily question', emoji: '💬', blurb: 'Today’s question for the two of you.', sizes: ['l'] },
  talk:      { name: 'Talk time', emoji: '⏱️', blurb: 'Start a timed talk together.', sizes: ['l'] },
  clocks:    { name: 'World clock', emoji: '🕰️', blurb: 'Your time and theirs, when you’re in different time zones.', sizes: ['s', 'm'] },
  calendar:  { name: 'Calendar', emoji: '📅', blurb: 'Today, and the dates coming up for you two.', sizes: ['s', 'm', 'l'] },
  todos:     { name: 'Reminders', emoji: '☑️', blurb: 'Your shared to-dos. Tick them off right here.', sizes: ['s', 'm', 'l'] },
  journal:   { name: 'Notes', emoji: '📝', blurb: 'The latest page from your journal.', sizes: ['s', 'm'] },
  memory:    { name: 'On this day', emoji: '📸', blurb: 'A memory from this date, or one from the archive.', sizes: ['s', 'm', 'l'] },
  countdown: { name: 'Countdown', emoji: '⏳', blurb: 'Days until your next important date.', sizes: ['s', 'm'] },
  heart:     { name: 'Thinking of you', emoji: '💗', blurb: 'One tap sends a heart.', sizes: ['s'] },
  flame:     { name: 'Flame', emoji: '🔥', blurb: 'How many days you’ve kept it lit.', sizes: ['s', 'm'] },
  watching:  { name: 'Continue watching', emoji: '🍿', blurb: 'Jump back into your movie night.', sizes: ['m'] },
  days:      { name: 'Days together', emoji: '💞', blurb: 'Every day since you got together.', sizes: ['s', 'm'] },
  letters:   { name: 'Letters', emoji: '💌', blurb: 'Letters waiting for you to open.', sizes: ['s', 'm'] },
  bucket:    { name: 'Bucket list', emoji: '🌍', blurb: 'A dream for today, and how many you’ve done.', sizes: ['s', 'm'] },
  watchlist: { name: 'Up next', emoji: '🎬', blurb: 'The next thing on your watchlist.', sizes: ['s', 'm'] },
  song:      { name: 'Our song', emoji: '🎵', blurb: 'The latest song you saved together.', sizes: ['s', 'm'] },
  shortcuts: { name: 'Shortcuts', emoji: '✨', blurb: 'Your favorite places in Hiranda, one tap away.', sizes: ['s', 'm', 'l'] },
  photos:    { name: 'Photos', emoji: '🖼️', blurb: 'Your photos, drifting by like a frame on the shelf.', sizes: ['s', 'm', 'l'], plus: true },
}

export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[]

export const SIZE_NAMES: Record<WidgetSize, string> = { s: 'Small', m: 'Medium', l: 'Large' }

// Everyone's Home until they arrange it: the old page's sections, plus the
// world clock (which only shows when you're in different time zones).
export const DEFAULT_LAYOUT: readonly LayoutItem[] = [
  { id: 'moves', size: 'm' },
  { id: 'question', size: 'l' },
  { id: 'talk', size: 'l' },
  { id: 'clocks', size: 'm' },
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
