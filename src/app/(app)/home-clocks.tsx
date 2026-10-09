'use client'

import { useEffect, useState } from 'react'
import { setMyTimeZone } from './home-actions'

// Your phone's time zone, saved quietly whenever it changes (a trip, a move),
// so your partner's Clocks widget shows your real time.
export function TimeZoneSync({ saved }: { saved: string | null }) {
  useEffect(() => {
    let tz: string | undefined
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch {}
    if (tz && tz !== saved) void setMyTimeZone(tz)
  }, [saved])
  return null
}

type Person = { name: string; tz: string }

// Minutes east of UTC for a zone at a moment.
function offsetMinutes(tz: string, at: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(at).map(x => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000)
}

function local(tz: string, at: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(at).map(x => [x.type, x.value]))
  return {
    h: +p.hour, m: +p.minute, weekday: p.weekday,
    day: `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at),
  }
}

const mood = (h: number) => h < 6 ? '🌙' : h < 12 ? '🌅' : h < 18 ? '☀️' : h < 22 ? '🌇' : '🌙'

/** "6h ahead", "2h 30m behind" — how far their clock is from yours. */
export function gapLabel(minutes: number) {
  const a = Math.abs(minutes), h = Math.floor(a / 60), m = a % 60
  const span = [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ')
  return minutes === 0 ? 'same time' : `${span} ${minutes > 0 ? 'ahead' : 'behind'}`
}

function Face({ h, m, size }: { h: number; m: number; size: number }) {
  const hand = (deg: number, len: number, w: number, cls: string) => {
    const r = (deg - 90) * Math.PI / 180
    return <line x1="50" y1="50" x2={50 + Math.cos(r) * len} y2={50 + Math.sin(r) * len} strokeWidth={w} strokeLinecap="round" className={cls} />
  }
  const night = h < 6 || h >= 20
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="max-h-full max-w-full h-auto w-auto aspect-square" aria-hidden>
      <circle cx="50" cy="50" r="47" className={night ? 'fill-stone-950 stroke-stone-700' : 'fill-[#efe8da] stroke-[#d8ccb4]'} strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const r = (i * 30 - 90) * Math.PI / 180
        return <circle key={i} cx={50 + Math.cos(r) * 39} cy={50 + Math.sin(r) * 39} r={i % 3 ? 1.3 : 2.2} className={night ? 'fill-stone-500' : 'fill-[#8a7f70]'} />
      })}
      {hand((h % 12) * 30 + m * 0.5, 22, 4.5, night ? 'stroke-amber-100' : 'stroke-[#2b2620]')}
      {hand(m * 6, 33, 3, night ? 'stroke-amber-100' : 'stroke-[#2b2620]')}
      <circle cx="50" cy="50" r="3.5" className="fill-amber-600" />
    </svg>
  )
}

// Like the iPhone's World Clock widget: their clock (small), or both of you
// side by side (medium).
export function ClocksWidget({ me, partner, size }: { me: Person; partner: Person; size: 's' | 'm' | 'l' }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // Times only render in the browser, so they're never a server's clock.
    const tick = () => setNow(new Date())
    tick()
    const t = setInterval(tick, 15_000)
    return () => clearInterval(t)
  }, [])

  if (!now) return <div className="tile h-full w-full" aria-hidden />

  const mine = local(me.tz, now), theirs = local(partner.tz, now)
  const gap = offsetMinutes(partner.tz, now) - offsetMinutes(me.tz, now)
  const dayNote = theirs.day > mine.day ? 'Tomorrow' : theirs.day < mine.day ? 'Yesterday' : 'Today'
  const asleep = theirs.h >= 23 || theirs.h < 7
  const short = (m: number) => m === 0 ? 'Same time' : `${m > 0 ? '+' : '−'}${gapLabel(m).replace(/ (ahead|behind)$/, '').toUpperCase()}`

  if (size === 's') {
    return (
      <div className="tile h-full w-full p-3 flex flex-col items-center justify-between">
        <div className="flex-1 min-h-0 w-full grid place-items-center"><Face h={theirs.h} m={theirs.m} size={200} /></div>
        <p className="text-[13px] font-semibold text-amber-50 leading-none mt-2 truncate max-w-full">{partner.name} {asleep ? '😴' : mood(theirs.h)}</p>
        <p className="text-[11px] text-stone-400 mt-1">{dayNote}, {short(gap)}</p>
      </div>
    )
  }

  return (
    <div className="tile h-full w-full px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {[{ p: me, t: mine, note: 'Here' }, null, { p: partner, t: theirs, note: `${dayNote}, ${short(gap)}` }].map((c, i) => c ? (
        <div key={i} className="h-full min-w-0 flex flex-col items-center justify-center gap-1.5">
          <div className="flex-1 min-h-0 w-full grid place-items-center"><Face h={c.t.h} m={c.t.m} size={200} /></div>
          <p className="text-[13px] font-semibold text-amber-50 leading-none truncate max-w-full">{c.p.name} <span className="font-normal text-stone-400 tabular-nums">{c.t.label}</span></p>
          <p className="text-[11px] text-stone-400 leading-none">{c.note}</p>
        </div>
      ) : (
        <div key={i} className="text-center text-[11px] text-stone-500 leading-snug w-16">
          {asleep ? <>{partner.name} is<br />probably asleep 😴</> : <>{gapLabel(gap)}</>}
        </div>
      ))}
    </div>
  )
}
