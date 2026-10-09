'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Heart, ListChecks } from 'lucide-react'
import { sendLove } from './love-actions'
import { toggleTodo } from './todos/actions'
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

// Photo frame (Plus): your photos drift by, one every few seconds.
export function PhotoFrame({ photos, large }: { photos: { url: string; caption: string | null; href: string }[]; large: boolean }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI(n => (n + 1) % photos.length), 6000)
    return () => clearInterval(t)
  }, [photos.length])

  if (!photos.length) {
    return (
      <Link href="/memories/new" className="tile h-full w-full p-4 flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-2xl" aria-hidden>🖼️</span>
        <span className="text-stone-300 text-sm">Add a memory with a photo to fill your frame</span>
      </Link>
    )
  }
  const now = photos[i % photos.length]
  return (
    <Link href={now.href} className="relative block h-full w-full overflow-hidden rounded-[22px] bg-stone-900">
      {photos.map((p, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.url}
          src={p.url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,scale] duration-[1400ms] ease-out ${n === i ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04]'}`}
          loading={n === 0 ? 'eager' : 'lazy'}
        />
      ))}
      {now.caption && (
        <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3.5 pt-10 font-semibold leading-tight text-white truncate ${large ? 'text-lg' : 'text-[14px]'}`}>{now.caption}</span>
      )}
    </Link>
  )
}

// Reminders: your shared to-dos, ticked off right on Home.
export function TodosWidget({ todos, size }: { todos: { id: string; text: string }[]; size: 's' | 'm' | 'l' }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const open = todos.length - done.size
  function tick(id: string) {
    haptic()
    const on = !done.has(id)
    setDone(d => { const n = new Set(d); if (on) n.add(id); else n.delete(id); return n })
    startTransition(async () => { await toggleTodo(id, on) })
  }
  const show = todos.slice(0, size === 'l' ? 9 : size === 'm' ? 4 : 2)
  return (
    <div className="tile h-full w-full p-4 md:p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <Link href="/todos" className="flex items-center gap-1.5 text-[13px] font-semibold text-sky-400"><ListChecks size={14} strokeWidth={2.5} /> Reminders</Link>
        <span className="text-[26px] font-semibold leading-none text-sky-400 tabular-nums">{open}</span>
      </div>
      {todos.length === 0 ? (
        <Link href="/todos" className="text-[13px] text-stone-400">All done. Add one for the two of you.</Link>
      ) : (
        <ul className={`flex-1 min-h-0 ${size === 'm' ? 'grid grid-cols-2 gap-x-4 content-start' : 'flex flex-col'}`}>
          {show.map(t => {
            const checked = done.has(t.id)
            return (
              <li key={t.id} className="flex items-center gap-2.5 py-1.5 border-b border-stone-800/70 min-w-0">
                <button
                  onClick={() => tick(t.id)}
                  aria-label={checked ? `Mark “${t.text}” not done` : `Mark “${t.text}” done`}
                  className={`grid place-items-center h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] transition-colors ${checked ? 'border-sky-400 bg-sky-400' : 'border-stone-500'}`}
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-stone-950" />}
                </button>
                <span className={`text-[13px] truncate ${checked ? 'text-stone-500 line-through' : 'text-amber-50'}`}>{t.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
