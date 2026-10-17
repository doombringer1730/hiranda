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
  { emoji: '🕯️', title: 'After Dark', text: 'An intimacy deck for desire and touch. Opens only when you both say yes.' },
  { emoji: '✨', title: 'What you’re good at', text: 'Each month, the strengths you two showed, and one idea to try next.' },
  { emoji: '🌤️', title: 'Your seasons', text: 'Your private closeness check-ins, kept as weather across the months.' },
  { emoji: '🎟️', title: 'Coupons give back', text: 'Each coupon you finish together takes $0.50 off your renewal, up to $2.' },
  { emoji: '🌙', title: 'No ads, ever', text: 'Just the two of you — no sponsored cards anywhere.' },
  { emoji: '🗝️', title: 'The Deepest deck', text: 'The questions couples remember — unlocked for both of you.' },
  { emoji: '🌱', title: 'Every route on the Grow map', text: 'Money, distance, moving in, family and more. Base camp, Fighting fair and your first branch are free.' },
  { emoji: '🎨', title: 'Your own theme', text: 'Pick any background and accent, light or dark, for the two of you.' },
  { emoji: '📖', title: 'Your Memory Book, printed', text: 'Export the book as a PDF to print or gift.' },
] as const

// The Deepest question deck (depth 3) needs Plus.
export const PLUS_DEPTH = 3

// After Dark, the intimacy deck (prompts.depth 4): Plus, and its own opt-in.
export const AFTER_DARK = 4

