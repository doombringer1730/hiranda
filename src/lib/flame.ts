// Flame 2.0: the shared flame forgives. A busy day never puts it out.
//
// - Today doesn't count against you until it's over.
// - Two cozy days a month cover missed days automatically.
// - A single missed day between two days together mends itself.
// - Only two uncovered misses in a row let the flame rest; anything you do
//   together relights it.
// The number is the days you two showed up for each other in this run, not a
// count of consecutive calendar days. (Built on Silverman & Barasch 2023 —
// repairable streaks keep people going — and Lally et al. 2010 — one missed day
// doesn't undo a habit.) Pure, so tests can run it with a fixed `today`.

export const COZY_DAYS_PER_MONTH = 2

export type FlameState = {
  days: number          // days fed in the current run
  fedToday: boolean
  resting: boolean      // no current run
  cozyLeft: number      // cozy days left this month
  cozyUsed: string[]    // the run's covered days, newest first
}

const key = (d: Date) => d.toISOString().slice(0, 10)
const back = (d: Date) => { const n = new Date(d); n.setUTCDate(n.getUTCDate() - 1); return n }

/** `fed` holds YYYY-MM-DD days on which both of you did something together. */
export function flameState(fed: Set<string>, today: Date = new Date(), lookbackDays = 400): FlameState {
  const todayKey = key(today)
  const fedToday = fed.has(todayKey)
  const cozy: string[] = []
  const cozyByMonth = new Map<string, number>()
  let days = 0
  let oldestFed: string | null = null
  let newerWasFed = fedToday
  let missesInARow = 0
  let d = fedToday ? today : back(today) // grace: today isn't over yet

  for (let i = 0; i < lookbackDays; i++, d = back(d)) {
    const k = key(d)
    if (fed.has(k)) { days++; oldestFed = k; newerWasFed = true; missesInARow = 0; continue }
    // A single missed day with a day together on both sides mends itself.
    if (newerWasFed && fed.has(key(back(d)))) { newerWasFed = false; continue }
    newerWasFed = false
    const month = k.slice(0, 7)
    const used = cozyByMonth.get(month) ?? 0
    if (used < COZY_DAYS_PER_MONTH) { cozyByMonth.set(month, used + 1); cozy.push(k); missesInARow = 0; continue }
    if (++missesInARow >= 2) break
  }

  // Cozy days only count when they sit inside the run, after its first day.
  const inRun = oldestFed ? cozy.filter(c => c > oldestFed!) : []
  const thisMonth = todayKey.slice(0, 7)
  return {
    days,
    fedToday,
    resting: days === 0,
    cozyLeft: COZY_DAYS_PER_MONTH - inRun.filter(c => c.startsWith(thisMonth)).length,
    cozyUsed: inRun,
  }
}
