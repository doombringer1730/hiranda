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
  | 'shortcuts' | 'photos' | 'partner' | 'note' | 'weather' | 'week' | 'jar' | 'grow'

// A tint washes a widget in one color, like tinted widgets on iOS.
export const TINTS = ['rose', 'peach', 'butter', 'sage', 'sky', 'lilac', 'mono'] as const
export type Tint = (typeof TINTS)[number]

// `stack`: more widgets sharing this spot (a Smart Stack); swipe between them.
export type LayoutItem = { id: WidgetId; size: WidgetSize; tint?: Tint; stack?: WidgetId[] }

export type WidgetMeta = {
  name: string
  blurb: string
  emoji: string
  sizes: readonly WidgetSize[] // smallest first
  plus?: boolean
}

// In the order the widget gallery lists them.
export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  partner:   { name: 'Partner', emoji: '🫶', blurb: 'Their photo, their status, and what they’re up to now.', sizes: ['s', 'm'] },
  note:      { name: 'Sticky note', emoji: '🗒️', blurb: 'A note you both can write on, right on Home.', sizes: ['s', 'm', 'l'] },
  weather:   { name: 'Weather', emoji: '⛅', blurb: 'The weather where each of you is.', sizes: ['s', 'm'] },
  week:      { name: 'This week', emoji: '🌿', blurb: 'The days this week you showed up for each other.', sizes: ['s', 'm'] },
  jar:       { name: 'Date jar', emoji: '🫙', blurb: 'What’s waiting in your jar, and what you last drew.', sizes: ['s', 'm'] },
  grow:      { name: 'Grow', emoji: '🌱', blurb: 'Your next lesson together, and how far you’ve come.', sizes: ['s', 'm'] },
  moves:     { name: 'Your move', emoji: '👉', blurb: 'Messages, games and answers waiting on you.', sizes: ['m', 'l'] },
  question:  { name: 'Daily question', emoji: '💬', blurb: 'Today’s question for the two of you.', sizes: ['l'] },
  talk:      { name: 'Talk time', emoji: '⏱️', blurb: 'Start a timed talk together.', sizes: ['l'] },
  clocks:    { name: 'World clock', emoji: '🕰️', blurb: 'Your time and theirs, when you’re in different time zones.', sizes: ['s', 'm'] },
  calendar:  { name: 'Calendar', emoji: '📅', blurb: 'Today, and the dates coming up for you two.', sizes: ['s', 'm', 'l'] },
  todos:     { name: 'Reminders', emoji: '☑️', blurb: 'Your shared to-dos. Tick them off right here.', sizes: ['s', 'm', 'l'] },
  journal:   { name: 'Notes', emoji: '📝', blurb: 'The latest page from your journal.', sizes: ['s', 'm'] },
  memory:    { name: 'On this day', emoji: '📸', blurb: 'A memory from this date, or one from the archive.', sizes: ['s', 'm', 'l'] },
  countdown: { name: 'Countdown', emoji: '⏳', blurb: 'Days until your next important date.', sizes: ['s', 'm'] },
  heart:     { name: 'Thinking of you', emoji: '💗', blurb: 'One tap sends a heart.', sizes: ['s', 'm'] },
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

/** Clean up a saved layout: known widgets only, each once (stacks
 * included), at a size it has, with a known tint. */
export function normalizeLayout(raw: unknown): LayoutItem[] {
  if (!Array.isArray(raw)) return DEFAULT_LAYOUT.map(i => ({ ...i }))
  const seen = new Set<WidgetId>()
  const known = (id: unknown): id is WidgetId => typeof id === 'string' && id in WIDGETS && !seen.has(id as WidgetId)
  const out: LayoutItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, size, tint, stack } = item as { id?: unknown; size?: unknown; tint?: unknown; stack?: unknown }
    if (!known(id)) continue
    seen.add(id)
    const next: LayoutItem = { id, size: WIDGETS[id].sizes.includes(size as WidgetSize) ? size as WidgetSize : WIDGETS[id].sizes[0] }
    if (TINTS.includes(tint as Tint)) next.tint = tint as Tint
    if (Array.isArray(stack)) {
      const more = stack.filter((s): s is WidgetId => known(s) && WIDGETS[s].sizes.includes(next.size)).slice(0, 9)
      for (const s of more) seen.add(s)
      if (more.length) next.stack = more
    }
    out.push(next)
  }
  return out
}

/** Every widget in a spot: the top one, then the rest of its stack. */
export const idsOf = (i: LayoutItem): WidgetId[] => [i.id, ...(i.stack ?? [])]

/** Sizes every widget in a spot shares (a stack resizes as one). */
export function sizesOf(i: LayoutItem): WidgetSize[] {
  return WIDGETS[i.id].sizes.filter(s => (i.stack ?? []).every(o => WIDGETS[o].sizes.includes(s)))
}

/** The next size up, wrapping back to the smallest (the size button cycles). */
export function nextSize(id: WidgetId, size: WidgetSize, stack: WidgetId[] = []): WidgetSize {
  const sizes = sizesOf({ id, size, stack })
  return sizes[(sizes.indexOf(size) + 1) % sizes.length] ?? size
}

/** Move the widget at `from` so it sits at `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice()
  if (from < 0 || from >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}
