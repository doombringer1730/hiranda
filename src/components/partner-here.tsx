'use client'

import { useRef } from 'react'
import { useHere, useLoveFromPartner, usePartnerAt, usePartnerHere } from '@/lib/shared-space'
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

/**
 * Hearts your partner sends while you're in the app float up from the bottom
 * of the screen, with a little "thinking of you". Drawn straight into the page
 * (no React state), so nothing re-renders; one burst at a time.
 */
export function FloatingHearts() {
  const { name } = usePartnerHere()
  const live = useRef<HTMLSpanElement>(null)
  const busyUntil = useRef(0)

  useLoveFromPartner(() => {
    const who = name ?? 'Your partner'
    if (live.current) live.current.textContent = `${who} is thinking of you`
    if (Date.now() < busyUntil.current) return
    busyUntil.current = Date.now() + 1500
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    floatHearts(who, calm)
  })

  return <span ref={live} aria-live="polite" className="sr-only" />
}

function floatHearts(who: string, calm: boolean) {
  const pill = document.createElement('div')
  pill.setAttribute('aria-hidden', 'true')
  pill.textContent = `${who} is thinking of you 💗`
  pill.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 16px);z-index:9999;pointer-events:none;padding:8px 14px;border-radius:999px;background:rgb(236 72 153 / 0.18);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fbcfe8;font-size:14px;white-space:nowrap'
  document.body.appendChild(pill)
  pill.animate([
    { transform: 'translate(-50%, -8px)', opacity: 0 },
    { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.12 },
    { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.85 },
    { transform: 'translate(-50%, -8px)', opacity: 0 },
  ], { duration: calm ? 2600 : 3200, easing: 'ease-out' }).onfinish = () => pill.remove()
  if (calm) return

  const n = 12
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span')
    h.setAttribute('aria-hidden', 'true')
    h.textContent = i % 4 ? '♥' : '💗'
    const x = 50 + (Math.random() - 0.5) * 60 // vw, around the middle
    h.style.cssText = `position:fixed;left:${x}vw;bottom:calc(env(safe-area-inset-bottom) + 90px);z-index:9999;pointer-events:none;font-size:${16 + Math.random() * 18}px;color:#f472b6`
    document.body.appendChild(h)
    const drift = (Math.random() - 0.5) * 80, rise = 260 + Math.random() * 220
    h.animate([
      { transform: 'translate(-50%, 0) scale(0.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${drift * 0.3}px), -${rise * 0.25}px) scale(1.05)`, opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${drift}px), -${rise}px) scale(0.85)`, opacity: 0 },
    ], { duration: 2200 + Math.random() * 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', delay: i * 90 }).onfinish = () => h.remove()
  }
}
