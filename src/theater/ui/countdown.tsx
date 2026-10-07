'use client'

import { useEffect, useRef, useState } from 'react'
import { Timer } from 'lucide-react'
import { createClient } from '@/theater/supabase/client'

// "Start together" for services Hiranda can't sync (Tubi, Peacock, …): either
// of you taps it and both screens count 3-2-1 to the same instant, corrected
// for clock differences via /api/time. Its own channel — it never touches the
// watch:<id> sync channel the extension uses.
const LEAD_MS = 4000

export function CountdownStart({ sessionId, userId, names }: { sessionId: string; userId: string; names: Record<string, string> }) {
  const [supabase] = useState(createClient)
  const offset = useRef(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const [goAt, setGoAt] = useState<{ at: number; by: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const sent = Date.now()
    fetch('/api/time').then(r => r.json()).then(({ t }: { t: number }) => {
      const got = Date.now()
      offset.current = got - Math.round((got - sent) / 2) - t
    }).catch(() => {})

    const channel = supabase
      .channel(`countdown:${sessionId}`)
      .on('broadcast', { event: 'go' }, ({ payload }: { payload: { at: number; by: string } }) => {
        setGoAt({ at: payload.at + offset.current, by: payload.by })
      })
      .subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, supabase])

  useEffect(() => {
    if (!goAt) return
    const id = setInterval(() => setNow(Date.now()), 100)
    const done = setTimeout(() => setGoAt(null), goAt.at - Date.now() + 2500)
    return () => { clearInterval(id); clearTimeout(done) }
  }, [goAt])

  function start() {
    const at = Date.now() - offset.current + LEAD_MS // in server time
    channelRef.current?.send({ type: 'broadcast', event: 'go', payload: { at, by: userId } })
    setGoAt({ at: at + offset.current, by: userId })
  }

  const left = goAt ? Math.ceil((goAt.at - now) / 1000) : null
  return (
    <div className="flex items-center gap-3">
      <button onClick={start} disabled={!!goAt}
        className="inline-flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-60 text-stone-100 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
        <Timer size={12} /> Start together
      </button>
      {left !== null && (
        <span className="text-sm" aria-live="assertive">
          {left > 0
            ? <span className="font-mono text-amber-300 text-lg">{left}</span>
            : <span className="text-green-400 font-medium">Play now! ▶</span>}
          {left > 0 && goAt?.by !== userId && <span className="text-stone-500 text-xs ml-2">{names[goAt!.by] ?? 'Partner'} started a countdown</span>}
        </span>
      )}
    </div>
  )
}
