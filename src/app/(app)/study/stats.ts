// Shared study economy math. XP is a pure, only-grows score; coins are the
// spendable balance; health is a daily gate computed from the day's attempts.

export type Attempt = {
  user_id: string
  deck_id?: string | null
  mode: string
  correct: number
  total: number
  xp: number
  coins?: number
  created_at: string
}

export const GRADED = new Set(['quiz', 'match', 'write', 'learn'])
export const HEALTH_BASE = 10
export const HEALTH_MAX = 20

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function studyStats(attempts: Attempt[], userId: string) {
  const mine = attempts.filter(a => a.user_id === userId)
  const day = todayKey()
  const gradedToday = mine.filter(a => a.created_at.slice(0, 10) === day && GRADED.has(a.mode))
  const flawlessToday = gradedToday.filter(a => a.total > 0 && a.correct === a.total).length
  const wrongToday = gradedToday.reduce((s, a) => s + Math.max(0, a.total - a.correct), 0)
  const health = Math.max(0, Math.min(HEALTH_MAX, HEALTH_BASE + 5 * flawlessToday - wrongToday))

  const xp = mine.reduce((s, a) => s + a.xp, 0)
  const weekAgo = Date.now() - 7 * 86_400_000
  const weeklyXp = mine.filter(a => new Date(a.created_at).getTime() >= weekAgo).reduce((s, a) => s + a.xp, 0)
  const coins = mine.reduce((s, a) => s + (a.coins ?? 0), 0)

  return { xp, weeklyXp, coins, health, flawlessToday, wrongToday }
}
