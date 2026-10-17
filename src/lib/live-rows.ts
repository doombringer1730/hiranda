// Applying realtime changes to a list of rows, without needless re-renders.
// Pure (no React, no Supabase), so tests can run it; use-live-rows.ts is the
// hook around it.
//
// The rules that keep renders down:
//   - nothing changed → the SAME array comes back, so setState bails out;
//   - a changed row is a new object, every other row keeps its identity, so
//     memoized row components only re-render the row that changed;
//   - a whole batch (a burst of events) is applied in one pass → one render.

export type LiveRow = { id: string }

export type RowChange<T extends LiveRow> =
  | { type: 'INSERT' | 'UPDATE'; row: T }
  | { type: 'DELETE'; id: string }

/** Same keys, same values (one level deep): an echo of what we already have. */
export function sameRow(a: object, b: object) {
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}

/**
 * Applies changes in order and returns the new rows, sorted by `compare`.
 * - INSERT adds the row in its place (usually the end), or acts as an update
 *   if the row is already there (a refetch can race the event).
 * - UPDATE replaces a row we have. One we don't have (an older page that
 *   isn't loaded) is ignored rather than pulled into the list.
 * - DELETE removes a row we have; ids we don't know are ignored. Supabase
 *   can't filter DELETE events, so other spaces' deletes (id only) arrive too.
 */
export function applyChanges<T extends LiveRow>(
  rows: readonly T[],
  changes: readonly RowChange<T>[],
  compare: (a: T, b: T) => number,
): readonly T[] {
  let out: T[] | null = null // copied on first real change
  const cur = () => out ?? rows
  const indexOf = (id: string) => cur().findIndex(r => r.id === id)

  for (const c of changes) {
    if (c.type === 'DELETE') {
      const i = indexOf(c.id)
      if (i === -1) continue
      out ??= rows.slice()
      out.splice(i, 1)
      continue
    }
    const i = indexOf(c.row.id)
    if (i !== -1) {
      if (sameRow(cur()[i], c.row)) continue
      out ??= rows.slice()
      out[i] = c.row
      // an edit can move a row (e.g. the sort key changed)
      if ((i > 0 && compare(out[i - 1], c.row) > 0) || (i < out.length - 1 && compare(c.row, out[i + 1]) > 0)) {
        out.splice(i, 1)
        out.splice(insertAt(out, c.row, compare), 0, c.row)
      }
      continue
    }
    if (c.type === 'UPDATE') continue
    out ??= rows.slice()
    out.splice(insertAt(out, c.row, compare), 0, c.row)
  }
  return out ?? rows
}

/**
 * After a refetch: keep the old object for every row that didn't change, and
 * the old array if none did, so a resync that finds nothing new is free.
 */
export function reconcile<T extends LiveRow>(prev: readonly T[] | null, next: readonly T[]): readonly T[] {
  if (!prev) return next
  const old = new Map(prev.map(r => [r.id, r]))
  let changed = prev.length !== next.length
  const out = next.map((r, i) => {
    const o = old.get(r.id)
    const keep = o && sameRow(o, r) ? o : r
    if (keep !== prev[i]) changed = true
    return keep
  })
  return changed ? out : prev
}

// Where a new row goes: after every row that sorts before or with it. New rows
// usually belong at the end, so check there first.
function insertAt<T>(rows: readonly T[], row: T, compare: (a: T, b: T) => number) {
  if (rows.length === 0 || compare(rows[rows.length - 1], row) <= 0) return rows.length
  let lo = 0, hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (compare(rows[mid], row) <= 0) lo = mid + 1
    else hi = mid
  }
  return lo
}
