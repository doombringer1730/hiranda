'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// Calls `refresh` the moment matching rows change (Supabase Realtime, which
// respects row-level security), with a slow fallback poll in case the socket
// drops. Replaces the old 3–4s polling loops, which don't scale.
export function useLive(
  { table, filter, enabled = true, fallbackMs = 20_000 }: { table: string; filter?: string; enabled?: boolean; fallbackMs?: number },
  refresh: () => void,
) {
  const cb = useRef(refresh)
  useEffect(() => { cb.current = refresh })

  useEffect(() => {
    if (!enabled) return
    const supabase = createClient()
    const channel = supabase
      .channel(`live:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => cb.current())
      .subscribe()
    const interval = setInterval(() => cb.current(), fallbackMs)
    return () => { clearInterval(interval); supabase.removeChannel(channel) }
  }, [table, filter, enabled, fallbackMs])
}
