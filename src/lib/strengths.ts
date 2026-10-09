// "What you're good at": a monthly read of what the two of you actually did,
// told as strengths. Never a score, never which of you did more, and the one
// idea to try next is an invitation, not a gap. Pure, so tests can run it.

export type Area = { key: string; good: string; tryNext: string; href: string; per30: number }

// per30: how many in a 30-day stretch reads as "you're great at this".
export const AREAS: Area[] = [
  { key: 'goodNews', good: 'celebrating each other’s good news', tryNext: 'Share one bit of good news in Chat, however small', href: '/chat', per30: 2 },
  { key: 'thanks', good: 'saying thank you', tryNext: 'Drop a thank-you in the jar', href: '/letters', per30: 3 },
  { key: 'questions', good: 'getting to know each other', tryNext: 'Answer a question together tonight', href: '/games/questions', per30: 6 },
  { key: 'talk', good: 'making time to really talk', tryNext: 'Ten minutes of Talk time, phones down', href: '/', per30: 2 },
  { key: 'watch', good: 'nights in together', tryNext: 'Pick something for Movie night', href: '/watch', per30: 2 },
  { key: 'memories', good: 'keeping your memories', tryNext: 'Pin a photo from this week', href: '/memories/new', per30: 3 },
  { key: 'taps', good: 'little signs of affection', tryNext: 'Send a heart from Home, just because', href: '/', per30: 15 },
  { key: 'letters', good: 'putting it in writing', tryNext: 'Write a short letter for later', href: '/letters', per30: 1 },
  { key: 'newThings', good: 'trying new things', tryNext: 'Draw something from the Jar', href: '/games/jar', per30: 1 },
  { key: 'grow', good: 'growing on purpose', tryNext: 'Start a Trail together', href: '/trails', per30: 2 },
]

export type Strengths = { good: string[]; next: Area | null }

/** Up to two strengths and one idea, from counts over `days` days. `seed` varies the idea month to month. */
export function readStrengths(counts: Record<string, number>, days = 30, seed = 0): Strengths {
  const scored = AREAS.map(a => ({ a, s: (counts[a.key] ?? 0) / (a.per30 * days / 30) }))
  const good = scored.filter(x => x.s >= 1).sort((x, y) => y.s - x.s).slice(0, 2).map(x => x.a.good)
  const quiet = scored.filter(x => x.s < 0.5).map(x => x.a)
  return { good, next: quiet.length ? quiet[Math.abs(seed) % quiet.length] : null }
}

export function strengthsLine(good: string[]) {
  if (!good.length) return null
  return `You two are great at ${good.join(' and ')}.`
}
