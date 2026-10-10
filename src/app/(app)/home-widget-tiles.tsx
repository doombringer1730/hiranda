import Link from 'next/link'
import {
  CalendarPlus, Mail, Star, Clapperboard, Music, MessageCircle, Gamepad2, PenLine,
  CalendarHeart, Sprout, CheckSquare, Lock, Heart, Play, ChevronRight, Hourglass,
  NotebookPen, Film, Images,
} from 'lucide-react'
import { CountUp } from './home-tiles'
import type { WidgetSize } from '@/lib/home-widgets'

// Home widgets, shaped like iPhone widgets (a fixed square, two squares, or
// two by two; a small colored label up top, one big glanceable thing; the
// whole widget opens its page) but dressed in Hiranda's "warm craft": serif
// numerals, your own words in handwriting, paper and prints for keepsakes.
// See marketing/research/engagement-and-relationship-research.md.

type Size = WidgetSize
const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const big = 'font-serif leading-none text-amber-50 tabular-nums'
export const sub = 'text-[13px] leading-snug text-stone-400'

export function Shell({ href, children, className = '', pad = true }: { href?: string; children: React.ReactNode; className?: string; pad?: boolean }) {
  const c = cls('tile !rounded-[22px] h-full w-full flex flex-col overflow-hidden', pad && 'p-4 md:p-5', className)
  return href ? <Link href={href} className={c}>{children}</Link> : <div className={c}>{children}</div>
}

export function Label({ icon: Icon, children, className = 'text-amber-400' }: { icon?: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <p className={cls('flex items-center gap-1.5 text-[13px] font-semibold leading-none shrink-0 min-w-0', className)}>
      {Icon && <Icon size={13} strokeWidth={2.5} className="shrink-0" />}<span className="truncate">{children}</span>
    </p>
  )
}

const fmtDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// ── Calendar ──────────────────────────────────────────────────────────────
export type Upcoming = { id: string; label: string; inDays: number; on: string } // on: YYYY-MM-DD

export function CalendarWidget({ today, dates, size }: { today: string; dates: Upcoming[]; size: Size }) {
  const d = new Date(today + 'T12:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const when = (n: number) => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`
  const head = (
    <div className="shrink-0">
      <p className="text-[12px] font-semibold tracking-wide text-rose-400">{weekday}</p>
      <p className={cls(big, 'text-[44px] mt-0.5')}>{d.getDate()}</p>
    </div>
  )
  const list = (n: number) => dates.length === 0
    ? <p className={sub}>No dates yet. Add an anniversary or a trip.</p>
    : (
      <ul className="flex flex-col gap-1.5 min-w-0">
        {dates.slice(0, n).map(x => (
          <li key={x.id} className="flex gap-2 min-w-0">
            <span className="w-1 shrink-0 rounded-full bg-rose-400" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-amber-50 truncate">{x.label}</span>
              <span className="block text-[12px] text-stone-400">{when(x.inDays)}</span>
            </span>
          </li>
        ))}
      </ul>
    )

  if (size === 's') {
    return (
      <Shell href="/dates" className="justify-between">
        {head}
        {dates[0]
          ? <p className="text-[13px] leading-snug min-w-0"><span className="block text-amber-50 font-medium truncate">{dates[0].label}</span><span className="text-stone-400">{when(dates[0].inDays)}</span></p>
          : <p className={sub}>Nothing coming up</p>}
      </Shell>
    )
  }
  if (size === 'm') {
    return (
      <Shell href="/dates" className="!flex-row gap-4">
        <div className="flex flex-col justify-between w-[38%]">{head}<p className={sub}>{d.toLocaleDateString('en-US', { month: 'long' })}</p></div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">{list(3)}</div>
      </Shell>
    )
  }
  // Large: the month, with your dates marked.
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const marked = new Set(dates.filter(x => x.on.slice(0, 7) === today.slice(0, 7)).map(x => Number(x.on.slice(8, 10))))
  const cells: (number | null)[] = [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)]
  return (
    <Shell href="/dates" className="gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-rose-400">{d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}</p>
        <p className="text-[12px] text-stone-400">{d.getFullYear()}</p>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i} className="text-stone-500 font-medium">{w}</span>)}
        {cells.map((n, i) => (
          <span key={i} className="relative grid place-items-center h-[22px]">
            {n && (
              <span className={cls('grid place-items-center h-[21px] w-[21px] rounded-full tabular-nums', n === d.getDate() ? 'bg-rose-500 text-white font-semibold' : 'text-amber-50')}>{n}</span>
            )}
            {n && marked.has(n) && n !== d.getDate() && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-rose-400" />}
          </span>
        ))}
      </div>
      <div className="mt-auto">{list(1)}</div>
    </Shell>
  )
}

// ── Countdown ─────────────────────────────────────────────────────────────
export function CountdownWidget({ dates, size }: { dates: Upcoming[]; size: Size }) {
  const [next, ...rest] = dates
  if (!next) {
    return (
      <Shell href="/dates" className="justify-between">
        <Label icon={Hourglass}>Countdown</Label>
        <p className={cls(sub, 'flex items-center gap-2')}><CalendarPlus size={16} /> Add a date</p>
      </Shell>
    )
  }
  const number = next.inDays === 0
    ? <p className={cls(big, 'text-[34px]')}>Today 🎉</p>
    : <p className={cls(big, 'text-[48px]')}><CountUp value={next.inDays} /><span className="text-[15px] font-medium text-stone-400 ml-1">{next.inDays === 1 ? 'day' : 'days'}</span></p>
  return (
    <Shell href="/dates" className={size === 'm' ? '!flex-row gap-4' : 'justify-between'}>
      <div className={cls('flex flex-col justify-between min-w-0', size === 'm' ? 'flex-1' : 'h-full')}>
        <Label icon={Hourglass}>Countdown</Label>
        <div className="min-w-0">
          {number}
          <p className={cls(sub, 'mt-1 truncate')}>until {next.label}</p>
        </div>
      </div>
      {size === 'm' && rest.length > 0 && (
        <ul className="flex-1 min-w-0 flex flex-col justify-end gap-2">
          {rest.slice(0, 3).map(x => (
            <li key={x.id} className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-[13px] text-amber-50 truncate">{x.label}</span>
              <span className="text-[12px] text-stone-400 tabular-nums shrink-0">{x.inDays}d</span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

// ── Days together ─────────────────────────────────────────────────────────
export function DaysWidget({ days, since, size }: { days: number | null; since: string | null; size: Size }) {
  if (days == null || !since) {
    return (
      <Shell href="/settings" className="justify-between">
        <Label icon={Heart} className="text-pink-400">Together</Label>
        <p className={sub}>Add the day you got together</p>
      </Shell>
    )
  }
  const years = Math.floor(days / 365.25)
  const nextYear = new Date(since + 'T12:00:00'); nextYear.setFullYear(nextYear.getFullYear() + years + 1)
  return (
    <Shell className={cls('bg-gradient-to-br from-pink-500/20 to-transparent', size === 'm' ? '!flex-row gap-4' : 'justify-between')}>
      <div className={cls('flex flex-col justify-between', size === 'm' ? 'flex-1' : 'h-full')}>
        <Label icon={Heart} className="text-pink-400">Together</Label>
        <div>
          <p className={cls(big, 'text-[44px]')}><CountUp value={days} /></p>
          <p className={cls(sub, 'mt-1')}>days of you two</p>
        </div>
      </div>
      {size === 'm' && (
        <div className="flex-1 flex flex-col justify-end gap-1 text-[13px] text-stone-400">
          <p>Since <span className="text-amber-50">{fmtDay(since)}, {since.slice(0, 4)}</span></p>
          {years > 0 && <p>{years} year{years === 1 ? '' : 's'} and counting</p>}
          <p>Next anniversary <span className="text-amber-50">{nextYear.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></p>
        </div>
      )}
    </Shell>
  )
}

// ── Letters ───────────────────────────────────────────────────────────────
export function LettersWidget({ waiting, sealedDays, partnerName, size }: {
  waiting: number // letters to you that you can open now
  sealedDays: number | null // days until the next sealed one opens, if any
  partnerName: string
  size: Size
}) {
  const sealed = sealedDays != null && (
    <p className="text-[12px] text-stone-500 flex items-center gap-1"><Lock size={11} /> Another opens in {sealedDays}d</p>
  )
  return (
    <Shell href="/letters" className={size === 'm' ? '!flex-row gap-4' : 'justify-between'}>
      <div className={cls('flex flex-col justify-between gap-2', size === 'm' ? 'flex-1' : 'h-full')}>
        <Label icon={Mail} className="text-rose-400">Letters</Label>
        {waiting > 0 ? (
          <div>
            <p className={cls(big, 'text-[44px]')}>{waiting}</p>
            <p className={cls(sub, 'mt-1')}>from {partnerName}, ready to open</p>
          </div>
        ) : <p className={sub}>Write {partnerName} an “open when” letter</p>}
        {size === 's' && sealed}
      </div>
      {size === 'm' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-5xl" aria-hidden>{waiting > 0 ? '💌' : '✉️'}</span>
          {sealed || <p className={sub}>{waiting > 0 ? 'Tap to open' : 'Seal one for later'}</p>}
        </div>
      )}
    </Shell>
  )
}

// ── Bucket list ───────────────────────────────────────────────────────────
export function Ring({ pct, size = 44, children, color = 'stroke-emerald-400' }: { pct: number; size?: number; children?: React.ReactNode; color?: string }) {
  const r = 42, c = 2 * Math.PI * r
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-stone-800" />
        {pct > 0 && <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" strokeLinecap="round" className={color} strokeDasharray={`${c * Math.min(1, pct)} ${c}`} />}
      </svg>
      {children}
    </span>
  )
}

export function BucketWidget({ dream, done, total, size }: { dream: string | null; done: number; total: number; size: Size }) {
  if (total === 0) {
    return (
      <Shell href="/bucket-list" className="justify-between">
        <Label icon={Star} className="text-emerald-400">Someday</Label>
        <p className={sub}>Start your bucket list together</p>
      </Shell>
    )
  }
  return (
    <Shell href="/bucket-list" className={size === 'm' ? '!flex-row gap-4' : 'justify-between'}>
      <div className={cls('flex flex-col justify-between min-w-0', size === 'm' ? 'flex-1' : 'h-full')}>
        <div className="flex items-start justify-between gap-2">
          <Label icon={Star} className="text-emerald-400">Someday</Label>
          {size === 's' && <Ring pct={done / total} size={30} />}
        </div>
        {dream ? <p className="font-hand text-[24px] leading-[1.05] text-amber-100 line-clamp-3">{dream}</p> : <p className={sub}>You did them all 🎉</p>}
      </div>
      {size === 'm' && (
        <div className="flex flex-col items-center justify-center gap-1.5">
          <Ring pct={done / total} size={84}><span className={cls(big, 'text-xl')}>{done}</span></Ring>
          <p className="text-[12px] text-stone-400">of {total} done</p>
        </div>
      )}
    </Shell>
  )
}

// ── Up next (watchlist) ───────────────────────────────────────────────────
export function WatchlistWidget({ title, kind, left, size }: { title: string | null; kind: string | null; left: number; size: Size }) {
  return (
    <Shell href="/watchlist" className={size === 'm' ? '!flex-row gap-4' : 'justify-between'}>
      {size === 'm' && (
        <span className="aspect-[2/3] h-full shrink-0 rounded-[12px] bg-gradient-to-br from-sky-500/50 via-indigo-500/30 to-stone-900 grid place-items-center text-3xl" aria-hidden>🎬</span>
      )}
      <div className="flex flex-col justify-between min-w-0 flex-1 h-full">
        <Label icon={Clapperboard} className="text-sky-400">Up next</Label>
        {title ? (
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-tight text-amber-50 line-clamp-2">{title}</p>
            <p className={cls(sub, 'mt-1')}>{kind === 'show' ? 'Show' : 'Movie'}{left > 1 ? ` · ${left - 1} more` : ''}</p>
          </div>
        ) : <p className={sub}>Add something to watch together</p>}
      </div>
    </Shell>
  )
}

// ── Our song (Music) ──────────────────────────────────────────────────────
export function SongWidget({ song, artist, note, by, size }: { song: string | null; artist: string | null; note: string | null; by: string | null; size: Size }) {
  if (!song) {
    return (
      <Shell href="/music" className="justify-between">
        <Label icon={Music} className="text-rose-400">Our song</Label>
        <p className={sub}>Save a song that’s yours</p>
      </Shell>
    )
  }
  return (
    <Shell href="/music" className={size === 'm' ? '!flex-row gap-4' : 'justify-between'}>
      <span className={cls('grid place-items-center shrink-0 rounded-[12px] bg-gradient-to-br from-rose-500 via-fuchsia-600 to-indigo-700 shadow-lg', size === 'm' ? 'h-full aspect-square' : 'h-14 w-14')} aria-hidden>
        <Music size={size === 'm' ? 34 : 22} className="text-white/90" />
      </span>
      <div className={cls('flex flex-col min-w-0 flex-1', size === 'm' ? 'justify-between' : 'justify-end')}>
        {size === 'm' && <Label icon={Music} className="text-rose-400">Our song</Label>}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight text-amber-50 truncate">{song}</p>
          <p className={cls(sub, 'truncate')}>{artist}</p>
          {size === 'm' && note && <p className="font-hand text-[19px] leading-tight text-amber-200 mt-1 line-clamp-2">“{note}”{by ? ` · ${by}` : ''}</p>}
        </div>
      </div>
    </Shell>
  )
}

// ── Notes (the journal) ───────────────────────────────────────────────────
export function JournalWidget({ entry, size }: { entry: { id: string; title: string | null; body: string; by: string; ago: string } | null; size: Size }) {
  return (
    <Link href={entry ? `/journal/${entry.id}` : '/journal/new'} className="paper paper-ruled h-full w-full rounded-[22px] overflow-hidden px-4 pt-3.5 pb-3 flex flex-col gap-1">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] opacity-60"><NotebookPen size={12} strokeWidth={2.5} /> Journal</p>
      {entry ? (
        <>
          <p className="font-hand text-[24px] leading-none line-clamp-1 mt-0.5">{entry.title || 'Untitled'}</p>
          <p className={cls('font-serif text-[14px] leading-[1.45] opacity-80', size === 'm' ? 'line-clamp-3' : 'line-clamp-2')}>{entry.body}</p>
          <p className="mt-auto text-[11px] opacity-55">{entry.by} · {entry.ago}</p>
        </>
      ) : <p className="font-hand text-[22px] leading-tight mt-1">Write the first page together</p>}
    </Link>
  )
}

// ── Your move ─────────────────────────────────────────────────────────────
export type Waiting = { href: string; icon: React.ElementType; title: string; sub?: string }

export function MovesWidget({ waiting, size }: { waiting: Waiting[]; size: Size }) {
  const show = waiting.slice(0, size === 'l' ? 5 : 2)
  return (
    <Shell className="gap-2">
      <div className="flex items-center justify-between">
        <Label icon={ChevronRight}>Your move</Label>
        <span className="grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-stone-950 text-[11px] font-bold">{waiting.length}</span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-center divide-y divide-stone-800/80">
        {show.map((w, i) => {
          const Icon = w.icon
          return (
            <Link key={i} href={w.href} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0 min-w-0">
              <span className="grid place-items-center h-8 w-8 shrink-0 rounded-full bg-amber-500/15 text-amber-300"><Icon size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-amber-50 text-[14px] font-medium truncate">{w.title}</span>
                {w.sub && <span className="block text-stone-400 text-[12px] truncate">{w.sub}</span>}
              </span>
            </Link>
          )
        })}
      </div>
    </Shell>
  )
}

// ── Continue watching ─────────────────────────────────────────────────────
export function WatchingWidget({ id, title }: { id: string; title: string }) {
  return (
    <Shell href={`/watch/${id}`} className="!flex-row items-center gap-4 bg-gradient-to-r from-amber-700/25 to-transparent">
      <span className="grid place-items-center h-14 w-14 shrink-0 rounded-full bg-amber-500 text-stone-950"><Play size={22} fill="currentColor" /></span>
      <span className="min-w-0 flex-1">
        <Label icon={Film}>Continue watching</Label>
        <span className="block text-[17px] font-semibold text-amber-50 truncate mt-1.5">{title}</span>
      </span>
    </Shell>
  )
}

// ── On this day ───────────────────────────────────────────────────────────
// The original Home's Polaroid, tape and all, fitted to the widget: the print
// sits a little crooked in its spot, photo on top (or beside it when medium),
// the caption handwritten on the white border.
export function MemoryWidget({ href, photo, title, when, size }: { href: string; photo: string | null; title: string; when: string; size: Size }) {
  const wide = size === 'm'
  const pic = (
    <span className={cls('relative block overflow-hidden rounded-[2px] bg-[#ece6da]', wide ? 'h-full aspect-square shrink-0' : 'flex-1 min-h-0')}>
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        : <span className={cls('absolute inset-0 grid place-items-center font-serif text-[#b4a993]', size === 'l' ? 'text-7xl' : 'text-5xl')} aria-hidden>H.</span>}
    </span>
  )
  const caption = (
    <span className={cls('block min-w-0 text-[#2b2620]', wide ? 'self-end pb-1' : 'px-1 pt-1.5 pb-1')}>
      <span className={cls('block font-hand leading-[1.05]', size === 's' ? 'text-[19px] truncate' : size === 'l' ? 'text-[30px] line-clamp-2' : 'text-[26px] line-clamp-3')}>{title}</span>
      <span className="block text-[10px] uppercase tracking-[0.18em] text-[#8a7f70] mt-0.5 truncate">{when}</span>
    </span>
  )
  return (
    <Link href={href} className="relative block h-full w-full">
      <span
        className={cls('polaroid !absolute inset-x-[8px] bottom-[8px] top-[16px] !flex !rounded-[4px]', wide ? 'flex-row gap-3 !p-2' : 'flex-col !pb-0')}
        style={{ rotate: size === 'l' ? '-1.2deg' : '-2deg' }}
      >
        <span className="tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" aria-hidden />
        {pic}{caption}
      </span>
    </Link>
  )
}

// ── Shortcuts ─────────────────────────────────────────────────────────────
const SHORTCUTS = [
  { href: '/chat', label: 'Chat', icon: MessageCircle, color: 'from-sky-400 to-blue-600' },
  { href: '/games', label: 'Games', icon: Gamepad2, color: 'from-violet-400 to-purple-600' },
  { href: '/memories', label: 'Memories', icon: Images, color: 'from-amber-400 to-orange-600' },
  { href: '/letters', label: 'Letters', icon: Mail, color: 'from-rose-400 to-pink-600' },
  { href: '/journal', label: 'Journal', icon: PenLine, color: 'from-yellow-400 to-amber-600' },
  { href: '/dates', label: 'Dates', icon: CalendarHeart, color: 'from-red-400 to-rose-600' },
  { href: '/grow', label: 'Grow', icon: Sprout, color: 'from-emerald-400 to-green-600' },
  { href: '/todos', label: 'Todos', icon: CheckSquare, color: 'from-teal-400 to-cyan-600' },
]

// Like the Shortcuts app: colored tiles with an icon and a name.
export function ShortcutsWidget({ size }: { size: Size }) {
  const items = SHORTCUTS.slice(0, size === 'l' ? 8 : 4)
  return (
    <nav aria-label="Shortcuts" className={cls('tile !rounded-[22px] h-full w-full grid grid-cols-2 gap-2 p-2.5', size === 'l' && 'grid-rows-4')}>
      {items.map(({ href, label, icon: Icon, color }) => size === 's'
        ? <Link key={href} href={href} aria-label={label} className={cls('grid place-items-center rounded-[14px] bg-gradient-to-br text-white', color)}><Icon size={22} /></Link>
        : (
          <Link key={href} href={href} className={cls('flex flex-col justify-between rounded-[14px] bg-gradient-to-br p-3 text-white', color)}>
            <Icon size={20} />
            <span className="text-[14px] font-semibold leading-none">{label}</span>
          </Link>
        ))}
    </nav>
  )
}
