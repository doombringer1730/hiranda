import Link from 'next/link'
import {
  CalendarPlus, Mail, Star, Clapperboard, Music, MessageCircle, Gamepad2, BookOpen, PenLine,
  CalendarHeart, Sprout, CheckSquare, Lock,
} from 'lucide-react'
import { CountUp } from './home-tiles'

// The smaller Home widgets. Each one fills its cell; the grid decides the size.

const eyebrow = 'text-stone-400 text-[11px] uppercase tracking-[0.22em]'

type Upcoming = { id: string; label: string; inDays: number }

export function CountdownWidget({ dates, wide }: { dates: Upcoming[]; wide: boolean }) {
  const [next, ...rest] = dates
  return (
    <Link href="/dates" className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
      <p className={eyebrow}>Countdown</p>
      {next ? (
        <div className={wide ? 'flex items-end justify-between gap-4' : ''}>
          <div className="min-w-0">
            {next.inDays === 0
              ? <p className="font-serif text-[38px] leading-none text-amber-50">Today 🎉</p>
              : <p className="font-serif text-[44px] leading-none text-amber-50"><CountUp value={next.inDays} /><span className="text-stone-400 text-base font-sans ml-1.5">{next.inDays === 1 ? 'day' : 'days'}</span></p>}
            <p className="text-stone-400 text-xs mt-1 truncate">{next.label}</p>
          </div>
          {wide && rest.length > 0 && (
            <ul className="min-w-0 text-right text-xs text-stone-400 flex flex-col gap-1">
              {rest.slice(0, 2).map(d => (
                <li key={d.id} className="truncate"><span className="text-amber-100 tabular-nums">{d.inDays}d</span> · {d.label}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-stone-400 text-sm flex items-center gap-2"><CalendarPlus size={18} className="text-stone-500" /> Add a date</p>
      )}
    </Link>
  )
}

export function DaysWidget({ days, since, wide }: { days: number | null; since: string | null; wide: boolean }) {
  if (days == null) {
    return (
      <Link href="/settings" className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
        <p className={eyebrow}>Together</p>
        <p className="text-stone-400 text-sm">Add the day you got together</p>
      </Link>
    )
  }
  const years = Math.floor(days / 365.25)
  return (
    <div className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
      <p className={eyebrow}>Together</p>
      <div className={wide ? 'flex items-end justify-between gap-4' : ''}>
        <p className="font-serif text-[44px] leading-none text-amber-50"><CountUp value={days} /><span className="text-stone-400 text-base font-sans ml-1.5">days</span></p>
        <p className="text-stone-400 text-xs mt-1">
          {wide && since ? <>since {new Date(since + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}{years > 0 ? ` · ${years} year${years === 1 ? '' : 's'}` : ''}</> : 'of you two 💞'}
        </p>
      </div>
    </div>
  )
}

export function LettersWidget({ waiting, sealedDays: sealed, partnerName, wide }: {
  waiting: number // letters to you that you can open now
  sealedDays: number | null // days until the next sealed one opens, if any
  partnerName: string
  wide: boolean
}) {
  return (
    <Link href="/letters" className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
      <p className={`${eyebrow} flex items-center gap-1.5`}><Mail size={12} /> Letters</p>
      <div className={wide ? 'flex items-end justify-between gap-4' : ''}>
        {waiting > 0 ? (
          <div>
            <p className="font-serif text-[44px] leading-none text-amber-50">{waiting}<span className="ml-1.5 text-2xl">💌</span></p>
            <p className="text-stone-400 text-xs mt-1">from {partnerName}, ready to open</p>
          </div>
        ) : (
          <p className="text-stone-300 text-sm leading-snug">Write {partnerName} an “open when” letter</p>
        )}
        {sealed != null && (
          <p className={`text-stone-500 text-[11px] flex items-center gap-1 ${wide ? '' : 'mt-2'}`}><Lock size={11} /> one more opens in {sealed} day{sealed === 1 ? '' : 's'}</p>
        )}
      </div>
    </Link>
  )
}

export function BucketWidget({ dream, done, total, wide }: { dream: string | null; done: number; total: number; wide: boolean }) {
  return (
    <Link href="/bucket-list" className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
      <p className={`${eyebrow} flex items-center gap-1.5`}><Star size={12} /> Someday</p>
      {total === 0 ? (
        <p className="text-stone-300 text-sm leading-snug">Start your bucket list together</p>
      ) : (
        <div className={wide ? 'flex items-end justify-between gap-4' : ''}>
          {dream && <p className="font-hand text-[22px] leading-[1.05] text-amber-100 line-clamp-2 min-w-0">{dream}</p>}
          <div className={`shrink-0 ${wide ? 'w-28' : 'mt-2'}`}>
            <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
              <div className="h-full rounded-full bg-amber-600" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
            <p className="text-stone-500 text-[11px] mt-1">{done} of {total} done</p>
          </div>
        </div>
      )}
    </Link>
  )
}

export function WatchlistWidget({ title, kind, left, wide }: { title: string | null; kind: string | null; left: number; wide: boolean }) {
  return (
    <Link href="/watchlist" className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
      <p className={`${eyebrow} flex items-center gap-1.5`}><Clapperboard size={12} /> Up next</p>
      {title ? (
        <div className={wide ? 'flex items-end justify-between gap-4' : ''}>
          <p className="text-amber-50 text-[17px] leading-snug line-clamp-2 min-w-0">{title}</p>
          <p className="text-stone-500 text-[11px] mt-1 shrink-0">{kind === 'show' ? 'Show' : 'Movie'}{left > 1 ? ` · ${left - 1} more after` : ''}</p>
        </div>
      ) : (
        <p className="text-stone-300 text-sm leading-snug">Add something to watch together</p>
      )}
    </Link>
  )
}

export function SongWidget({ song, artist, note, by, wide }: { song: string | null; artist: string | null; note: string | null; by: string | null; wide: boolean }) {
  return (
    <Link href="/music" className="tile h-full p-4 flex flex-col justify-between gap-3 min-h-[120px]">
      <p className={`${eyebrow} flex items-center gap-1.5`}><Music size={12} /> Our song</p>
      {song ? (
        <div className={wide ? 'flex items-center gap-3' : ''}>
          {wide && <span className="grid place-items-center h-12 w-12 shrink-0 rounded-full bg-stone-800 text-xl animate-[spin_6s_linear_infinite] motion-reduce:animate-none" aria-hidden>💿</span>}
          <div className="min-w-0">
            <p className="text-amber-50 text-[15px] leading-snug truncate">{song}</p>
            <p className="text-stone-400 text-xs truncate">{artist}</p>
            {wide && note && <p className="font-hand text-amber-200 text-lg leading-tight mt-1 line-clamp-1">“{note}”{by ? ` · ${by}` : ''}</p>}
          </div>
        </div>
      ) : (
        <p className="text-stone-300 text-sm leading-snug">Save a song that’s yours</p>
      )}
    </Link>
  )
}

const SHORTCUTS = [
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/games', label: 'Games', icon: Gamepad2 },
  { href: '/memories', label: 'Memories', icon: BookOpen },
  { href: '/letters', label: 'Letters', icon: Mail },
  { href: '/journal', label: 'Journal', icon: PenLine },
  { href: '/dates', label: 'Dates', icon: CalendarHeart },
  { href: '/grow', label: 'Grow', icon: Sprout },
  { href: '/todos', label: 'Todos', icon: CheckSquare },
]

export function ShortcutsWidget({ large }: { large: boolean }) {
  const items = SHORTCUTS.slice(0, large ? 8 : 4)
  return (
    <nav aria-label="Shortcuts" className="tile h-full p-3 grid grid-cols-4 gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-[18px] py-2 hover:bg-stone-800/50 transition-colors">
          <span className="grid place-items-center h-11 w-11 rounded-[14px] bg-amber-700/20 text-amber-300"><Icon size={19} /></span>
          <span className="text-stone-300 text-[11px]">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
