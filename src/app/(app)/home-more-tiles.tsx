import { Sprout, CloudSun, Leaf, ChevronRight } from 'lucide-react'
import { Shell, Label, Ring, big, sub } from './home-widget-tiles'
import { describe, type Weather } from '@/lib/weather'
import type { WidgetSize } from '@/lib/home-widgets'

// More Home widgets: your partner, the weather where you each are, this
// week, the date jar and Grow. Same rules as home-widget-tiles.tsx.

type Size = WidgetSize
const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ── Partner ───────────────────────────────────────────────────────────────
export type PartnerCard = {
  name: string
  avatar: string | null
  accent: string | null
  status: string | null
  live: string | null // what they're doing right now, if anything
}

function Face({ p, px }: { p: PartnerCard; px: number }) {
  return (
    <span className="relative grid place-items-center rounded-full overflow-hidden shrink-0 font-serif text-amber-50 ring-2 ring-[#efe8da]/80"
      style={{ width: px, height: px, background: p.accent ?? 'var(--color-amber-800)', fontSize: px * 0.42 }}>
      {p.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.avatar} alt="" className="h-full w-full object-cover" />
        : p.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

const LIVE: Record<string, string> = { quizzing: 'quizzing 📚', studying: 'studying 📚', watching: 'watching 🍿', playing: 'playing 🎲' }

export function PartnerWidget({ p, size }: { p: PartnerCard; size: Size }) {
  const live = p.live && (
    <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-700/20 px-2 py-0.5 text-[11px] text-amber-200 max-w-full">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" /><span className="truncate">{LIVE[p.live] ?? p.live}</span>
    </p>
  )
  const status = p.status
    ? <p className={cls('font-hand leading-[1.05] text-amber-100', size === 's' ? 'text-[20px] line-clamp-2' : 'text-[26px] line-clamp-3')}>{p.status}</p>
    : <p className={sub}>No status yet</p>
  if (size === 's') {
    return (
      <Shell href="/chat" className="justify-between">
        <div className="flex items-start justify-between gap-2">
          <Face p={p} px={46} />
          {live && <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse mt-1" aria-label="Active now" />}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-amber-50 truncate mb-0.5">{p.name}</p>
          {status}
        </div>
      </Shell>
    )
  }
  return (
    <Shell href="/chat" className="!flex-row items-center gap-4">
      <Face p={p} px={92} />
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-amber-50 truncate">{p.name}</p>
        {status}
        {live}
      </div>
    </Shell>
  )
}

// ── Weather ───────────────────────────────────────────────────────────────
type Place = { who: string; w: Weather | null; city: string }

function WeatherColumn({ p, size }: { p: Place; size: Size }) {
  const d = p.w ? describe(p.w.code, p.w.day) : null
  return (
    <div className="min-w-0 flex-1 h-full flex flex-col justify-between">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-amber-50 truncate">{p.who}</p>
        <p className="text-[11px] text-stone-400 truncate">{p.city}</p>
      </div>
      {p.w && d ? (
        <div>
          <p className="text-2xl leading-none mb-1" aria-hidden>{d.emoji}</p>
          <p className={cls(big, size === 's' ? 'text-[40px]' : 'text-[36px]')}>{p.w.temp}°</p>
          <p className="text-[11px] text-stone-400 mt-1 truncate">{d.text} · H{p.w.high}° L{p.w.low}°</p>
        </div>
      ) : <p className={sub}>No weather right now</p>}
    </div>
  )
}

export function WeatherWidget({ me, partner, size }: { me: Place | null; partner: Place | null; size: Size }) {
  // Tint the widget like iOS does: day sky or night sky, from their weather.
  const sky = partner?.w?.day === false ? 'from-indigo-900/60 to-stone-900' : 'from-sky-600/35 to-stone-900'
  if (!partner) {
    return (
      <Shell className="justify-between">
        <Label icon={CloudSun} className="text-sky-300">Weather</Label>
        <p className={sub}>Shows up once you’ve both opened Hiranda on your phones</p>
      </Shell>
    )
  }
  if (size === 's' || !me) return <Shell className={cls('bg-gradient-to-b', sky)}><WeatherColumn p={partner} size="s" /></Shell>
  return (
    <Shell className={cls('bg-gradient-to-b !flex-row gap-4', sky)}>
      <WeatherColumn p={me} size="m" />
      <span className="w-px self-stretch bg-white/10" aria-hidden />
      <WeatherColumn p={partner} size="m" />
    </Shell>
  )
}

// ── This week ─────────────────────────────────────────────────────────────
// The last seven days, each lit when you both showed up. No streak to lose:
// every lit day counts, and a quiet day is just a quiet day.
export function WeekWidget({ days, size }: { days: { label: string; lit: boolean; today: boolean }[]; size: Size }) {
  const lit = days.filter(d => d.lit).length
  const dots = (
    <div className="flex items-end justify-between gap-1">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <span className={cls('grid place-items-center rounded-full', size === 's' ? 'h-4 w-4' : 'h-8 w-8',
            d.lit ? 'bg-emerald-400/90 text-stone-950' : 'bg-stone-800', d.today && !d.lit && 'ring-1 ring-emerald-400/60')}>
            {size === 'm' && d.lit && <Leaf size={14} strokeWidth={2.5} />}
          </span>
          <span className={cls('text-[10px] leading-none', d.today ? 'text-emerald-300 font-semibold' : 'text-stone-500')}>{d.label}</span>
        </div>
      ))}
    </div>
  )
  return (
    <Shell href="/grow" className="justify-between">
      <div className="flex items-start justify-between gap-2">
        <Label icon={Leaf} className="text-emerald-400">This week</Label>
        {size === 'm' && <p className="text-[12px] text-stone-400">{lit ? 'Every day counts' : 'A fresh week'}</p>}
      </div>
      <p className={cls(big, size === 's' ? 'text-[34px]' : 'text-[30px]')}>
        {lit}<span className="text-[13px] font-sans font-medium text-stone-400 ml-1.5">{lit === 1 ? 'day' : 'days'} together</span>
      </p>
      {dots}
    </Shell>
  )
}

// ── Date jar ──────────────────────────────────────────────────────────────
export function JarWidget({ waiting, last, size }: { waiting: number; last: string | null; size: Size }) {
  const jar = (
    <span className="relative grid place-items-center shrink-0 w-fit self-center" aria-hidden>
      <span className={size === 's' ? 'text-[44px] leading-none' : 'text-[64px] leading-none'}>🫙</span>
      {waiting > 0 && <span className="absolute -top-1 -right-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-stone-950 text-[11px] font-bold grid place-items-center">{waiting}</span>}
    </span>
  )
  if (size === 's') {
    return (
      <Shell href="/games/jar" className="justify-between">
        <Label className="text-amber-300">Date jar</Label>
        {jar}
        <p className={sub}>{waiting ? `${waiting} idea${waiting === 1 ? '' : 's'} waiting` : 'Drop in an idea'}</p>
      </Shell>
    )
  }
  return (
    <Shell href="/games/jar" className="!flex-row items-center gap-4">
      {jar}
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <Label className="text-amber-300">Date jar</Label>
        {last
          ? <><p className="text-[11px] text-stone-400 uppercase tracking-[0.14em]">Last drawn</p><p className="font-hand text-[24px] leading-[1.05] text-amber-100 line-clamp-2">{last}</p></>
          : <p className={sub}>Each of you drops in a date idea, then you draw one together</p>}
        <p className="text-[12px] text-stone-400">{waiting ? `${waiting} idea${waiting === 1 ? '' : 's'} waiting` : 'The jar is empty'}</p>
      </div>
    </Shell>
  )
}

// ── Grow ──────────────────────────────────────────────────────────────────
export function GrowWidget({ next, together, total, size }: {
  next: { key: string; title: string; emoji: string; unit: string } | null
  together: number
  total: number
  size: Size
}) {
  const pct = total ? together / total : 0
  if (size === 's') {
    return (
      <Shell href={next ? `/grow/lesson/${next.key}` : '/grow'} className="justify-between items-start">
        <Label icon={Sprout} className="text-emerald-400">Grow</Label>
        <Ring pct={pct} size={64}><span className="text-2xl" aria-hidden>{next?.emoji ?? '🌳'}</span></Ring>
        <p className="text-[12px] text-stone-300 leading-snug line-clamp-2">{next ? next.title : 'You finished the path 🎉'}</p>
      </Shell>
    )
  }
  return (
    <Shell href={next ? `/grow/lesson/${next.key}` : '/grow'} className="!flex-row items-center gap-4">
      <Ring pct={pct} size={104}><span className={cls(big, 'text-[22px]')}>{together}<span className="text-[12px] text-stone-400">/{total}</span></span></Ring>
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <Label icon={Sprout} className="text-emerald-400">Up next</Label>
        {next ? (
          <>
            <p className="font-serif text-[20px] leading-tight text-amber-50 line-clamp-2">{next.emoji} {next.title}</p>
            <p className="text-[12px] text-stone-400 flex items-center gap-1 truncate">{next.unit} <ChevronRight size={12} /></p>
          </>
        ) : <p className={sub}>You finished the path together 🎉</p>}
      </div>
    </Shell>
  )
}

