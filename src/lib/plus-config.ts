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
  { emoji: '📔', title: 'Our Month', text: 'Every month becomes a keepsake: your photos, good news, questions and songs.' },
  { emoji: '⏳', title: 'Hours together', text: 'Every movie night a ticket stub, every talk a pressed flower.' },
  { emoji: '🥾', title: 'Every Trail', text: 'Five-day courses on money, love, distance, moving in, family and after a fight.' },
  { emoji: '🕯️', title: 'After Dark', text: 'An intimacy deck for desire and touch. Opens only when you both say yes.' },
  { emoji: '✨', title: 'What you’re good at', text: 'Each month, the strengths you two showed, and one idea to try next.' },
  { emoji: '🌤️', title: 'Your seasons', text: 'Your private closeness check-ins, kept as weather across the months.' },
  { emoji: '🎟️', title: 'Coupons give back', text: 'Each coupon you finish together takes $0.50 off your renewal, up to $2.' },
  { emoji: '🌙', title: 'No ads, ever', text: 'Just the two of you — no sponsored cards anywhere.' },
  { emoji: '🗝️', title: 'The Deepest deck', text: 'The questions couples remember — unlocked for both of you.' },
  { emoji: '🌱', title: 'The whole Grow path', text: 'Every unit and lesson, each one earning you coupons.' },
  { emoji: '🎨', title: 'Your own theme', text: 'Pick any background and accent, light or dark, for the two of you.' },
  { emoji: '📖', title: 'Your Memory Book, printed', text: 'Export the book as a PDF to print or gift.' },
] as const

// Grow: units 1–2 are free; later units need Plus.
export const FREE_GROW_UNITS = 2

// The Deepest question deck (depth 3) needs Plus.
export const PLUS_DEPTH = 3

// After Dark, the intimacy deck (prompts.depth 4): Plus, and its own opt-in.
export const AFTER_DARK = 4

/** Is this Grow unit (by its position in PATH) a Plus unit? */
export const isPlusUnit = (unitIndex: number) => unitIndex >= FREE_GROW_UNITS
