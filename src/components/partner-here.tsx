'use client'

import { useHere, usePartnerAt, usePartnerHere } from '@/lib/shared-space'
import { describePlace } from '@/lib/shared-space-state'

// Small pieces of the shared space (lib/shared-space.tsx). Each subscribes to
// just what it shows, so the page around it doesn't re-render.

/**
 * Put on a page that shows one thing (a memory, a letter): tells your partner
 * you have it open, and shows a hint when they have it open too.
 */
export function HereTogether({ room, item, label }: { room: string; item: string; label?: string }) {
  useHere({ room, item, label })
  const together = usePartnerAt(room, item)
  const { name } = usePartnerHere()
  if (!together) return null
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/30 px-2.5 py-1 text-xs text-emerald-200 animate-pop" role="status">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {name ?? 'Your partner'} is looking at this too
    </p>
  )
}

/** "in Memories" / "looking at “Lisbon”" while your partner is online. */
export function PartnerWhere({ prefix = ' · ' }: { prefix?: string }) {
  const p = usePartnerHere()
  const where = p.online && p.visible ? describePlace(p.place) : null
  return where ? <>{prefix}{where}</> : null
}
