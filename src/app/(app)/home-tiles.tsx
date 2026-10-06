'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { sendLove } from './love-actions'
import { haptic } from '@/lib/feel'

const EASE = (t: number) => 1 - Math.pow(1 - t, 4)

// A number that rolls up to its value — big serif numerals on the tiles.
export function CountUp({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900
    const start = performance.now(), a = from.current
    let raf = requestAnimationFrame(function tick(now) {
      const t = dur ? Math.min(1, (now - start) / dur) : 1
      setShown(Math.round(a + (value - a) * EASE(t)))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    })
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={`tabular-nums ${className}`}>{shown.toLocaleString()}</span>
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Floating hearts from the button — the "satisfying" part.
function burst(from: Element) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = from.getBoundingClientRect()
  // Every so often a guest sneaks in: HIMYM's blue French horn, or Friends'
  // lobster.
  const guest = Math.random() < 0.25 ? Math.floor(Math.random() * 9) : -1
  const guestEmoji = Math.random() < 0.5 ? '🎺' : '🦞'
  for (let i = 0; i < 9; i++) {
    const h = document.createElement('span')
    h.textContent = i === guest ? guestEmoji : i % 3 ? '♥' : '💗'
    h.setAttribute('aria-hidden', 'true')
    h.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;z-index:9999;pointer-events:none;font-size:${14 + Math.random() * 14}px;color:#f472b6`
    document.body.appendChild(h)
    const dx = (Math.random() - 0.5) * 120, dy = -90 - Math.random() * 110
    h.animate([
      { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${dy * 0.4}px)) scale(1.1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', delay: i * 30 }).onfinish = () => h.remove()
  }
}

export function ThinkingOfYou({ partnerName, lastFromPartner }: { partnerName: string; lastFromPartner: string | null }) {
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [lobster, setLobster] = useState(false)
  const [, startTransition] = useTransition()

  function send(e: React.MouseEvent<HTMLButtonElement>) {
    haptic()
    burst(e.currentTarget)
    setSentAt(Date.now())
    setLobster(Math.random() < 0.3) // Friends: "he's her lobster"
    startTransition(async () => { await sendLove() })
  }

  return (
    <div className="tile h-full p-4 flex flex-col items-center justify-center gap-2 text-center">
      <button
        onClick={send}
        aria-label={`Send ${partnerName} a heart`}
        className="grid place-items-center h-14 w-14 rounded-full bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 transition-colors"
      >
        <Heart key={sentAt ?? 0} size={26} fill="currentColor" className={sentAt ? 'animate-pop' : ''} />
      </button>
      <p className="text-stone-400 text-xs leading-snug">
        {sentAt
          ? lobster ? <>Sent — you’re their lobster 🦞</> : <>Sent to {partnerName} 💗</>
          : lastFromPartner
            ? <>{partnerName} thought of you · {ago(lastFromPartner)}</>
            : <>Tap to send {partnerName} a heart</>}
      </p>
    </div>
  )
}
