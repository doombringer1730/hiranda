'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { applyChanges, reconcile, type LiveRow, type RowChange } from '@/lib/live-rows'

// A list of rows kept in sync with a table through Supabase Realtime: new
// rows are added, edited rows replaced and deleted rows removed in place, with
// no refetch per change (useLive refetches instead; fine for counts and tiles).
//
// Fewer renders: events arriving together are applied in one batch (one
// render per frame at most), and unchanged rows keep their object identity,
// so wrap row components in React.memo and only the changed row re-renders.
// An event that changes nothing (an echo, another space's delete) doesn't
// render at all.
//
// Nothing is missed: the list loads after the channel is listening, events
// that land mid-load are applied on top, and it reloads when the socket
// reconnects or the tab comes back (a reload that finds nothing new is free).
// Realtime respects row-level security, so only rows you can read arrive.

type Options<T extends LiveRow> = {
  table: string
  /** e.g. `couple_id=eq.${id}`. Supabase can't filter DELETE events; unknown ids are ignored. */
  filter?: string
  /** The rows as they are now, sorted by `compare` (the first page, for paged lists). */
  load: () => Promise<readonly T[] | null>
  compare: (a: T, b: T) => number
  /** Keep only the fields the list uses, so an event's row matches a loaded one. */
  toRow?: (raw: Record<string, unknown>) => T
  enabled?: boolean
  /** Reload this often anyway, in case the socket dies quietly. */
  fallbackMs?: number
}

export function useLiveRows<T extends LiveRow>({
  table, filter, load, compare, toRow, enabled = true, fallbackMs = 60_000,
}: Options<T>) {
  const [rows, setRows] = useState<readonly T[] | null>(null)

  // Latest callbacks without re-subscribing when they change identity.
  const fns = useRef({ load, compare, toRow })
  useEffect(() => { fns.current = { load, compare, toRow } })

  const queue = useRef<RowChange<T>[]>([])
  const loading = useRef(0) // > 0 while a load is in flight
  const loadId = useRef(0) // only the newest load may land
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    timer.current = null
    if (loading.current > 0 || queue.current.length === 0) return // the load applies them
    const batch = queue.current
    queue.current = []
    setRows(prev => (prev ? applyChanges(prev, batch, fns.current.compare) : prev))
  }, [])

  const resync = useCallback(() => {
    const id = ++loadId.current
    loading.current++
    fns.current.load().then(
      fresh => {
        loading.current--
        if (id !== loadId.current || !fresh) return
        const batch = queue.current
        queue.current = []
        setRows(prev => reconcile(prev, applyChanges(fresh, batch, fns.current.compare)))
      },
      () => { loading.current-- }, // keep what we have; the next event or reload catches up
    )
  }, [])

  useEffect(() => {
    if (!enabled) return
    const supabase = createClient()
    const loads = loadId // the counter itself, not a DOM ref
    const onChange = (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (p.eventType === 'DELETE') {
        const id = (p.old as Partial<LiveRow>).id
        if (id) queue.current.push({ type: 'DELETE', id })
      } else {
        const { toRow } = fns.current
        queue.current.push({ type: p.eventType, row: toRow ? toRow(p.new) : (p.new as unknown as T) })
      }
      timer.current ??= setTimeout(flush, 16)
    }
    // Load once the channel is listening, and again after every reconnect.
    const channel = supabase
      .channel(`rows:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, onChange)
      .subscribe(status => { if (status === 'SUBSCRIBED') resync() })
    const onVisible = () => { if (document.visibilityState === 'visible') resync() }
    document.addEventListener('visibilitychange', onVisible)
    const poll = setInterval(resync, fallbackMs)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(poll)
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      queue.current = []
      loads.current++ // drop a load still in flight
      loading.current = 0
    }
  }, [table, filter, enabled, fallbackMs, flush, resync])

  return { rows, resync }
}
