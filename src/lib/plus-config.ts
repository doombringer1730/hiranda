// Hiranda Plus — everything you might want to tweak, in one place.
// (Safe to import anywhere: no server code here.)

export const PLUS_PRICES = {
  monthly: { label: '$4.99', per: 'month' },
  yearly: { label: '$39.99', per: 'year', note: 'about $3.33 a month' },
} as const
export type PlusPlan = keyof typeof PLUS_PRICES

export const PLUS_TRIAL_DAYS = 7

// Shown on the paywall, in this order.
export const PLUS_PERKS = [
  { emoji: '🌙', title: 'No ads, ever', text: 'Just the two of you — no sponsored cards anywhere.' },
  { emoji: '🗝️', title: 'The Deepest deck', text: 'The questions couples remember — unlocked for both of you.' },
  { emoji: '🌱', title: 'The whole Grow path', text: 'Every unit and lesson, each one earning you coupons.' },
  { emoji: '🎨', title: 'Every theme', text: 'Rose, Forest, Ocean, Glacier, Midnight and more.' },
  { emoji: '📖', title: 'Your Memory Book, printed', text: 'Export the book as a PDF to print or gift.' },
] as const

// Themes anyone can use; the rest come with Plus.
export const FREE_THEMES = new Set(['coffee', 'cloud', 'preppy'])

// Grow: units 1–2 are free; later units need Plus.
export const FREE_GROW_UNITS = 2

// The Deepest question deck (depth 3) needs Plus.
export const PLUS_DEPTH = 3

/** Is this Grow unit (by its position in PATH) a Plus unit? */
export const isPlusUnit = (unitIndex: number) => unitIndex >= FREE_GROW_UNITS
