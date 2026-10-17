// When may a store (Stripe, Apple) overwrite a couple's Plus row? Pure, so
// tests can run it; billing.ts record() is the caller.
//
// Only a grant that is giving Plus right now is protected:
//   - a forever grant (no end date) is never replaced;
//   - a grant with an end date that hasn't passed gives way only to a store
//     row that gives Plus itself, so a couple who pays during it is recorded,
//     but a canceled or expired subscription (an old one, or "Restore
//     purchases" finding nothing current) can't erase it.
// Anything else (no row, a store row, a grant that has ended or was switched
// off) may be replaced.

export type PlusRowLike = {
  source: string
  status: string
  current_period_end: string | null
}

// The statuses couple_has_plus() counts (migration 029).
const GIVES_PLUS = new Set(['active', 'trialing', 'past_due'])

export function givesPlus(row: Pick<PlusRowLike, 'status' | 'current_period_end'>, now: Date) {
  return GIVES_PLUS.has(row.status)
    && (row.current_period_end === null || new Date(row.current_period_end) > now)
}

export function storeMayReplace(existing: PlusRowLike | null, incoming: PlusRowLike, now: Date) {
  if (!existing || existing.source !== 'grant' || !givesPlus(existing, now)) return true
  if (existing.current_period_end === null) return false
  return givesPlus(incoming, now)
}
