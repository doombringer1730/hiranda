import { Flame, Heart } from 'lucide-react'

const MILESTONES = [3, 7, 30, 100, 365]

// Appearance tiers — the flame runs hotter (and glows more) as the streak grows.
function look(streak: number) {
  if (streak <= 0) return { c1: '#78716c', c2: '#44403c', hi: '#a8a29e', glow: 'none', alive: false }
  if (streak < 3)   return { c1: '#fbbf24', c2: '#b45309', hi: '#fde68a', glow: '0 0 10px rgba(180,83,9,.5)', alive: true }
  if (streak < 7)   return { c1: '#fb923c', c2: '#c2410c', hi: '#fed7aa', glow: '0 0 16px rgba(234,88,12,.55)', alive: true }
  if (streak < 30)  return { c1: '#fb7185', c2: '#e11d48', hi: '#fecdd3', glow: '0 0 20px rgba(225,29,72,.55)', alive: true }
  if (streak < 100) return { c1: '#c084fc', c2: '#7c3aed', hi: '#e9d5ff', glow: '0 0 24px rgba(124,58,237,.6)', alive: true }
  return { c1: '#38bdf8', c2: '#2563eb', hi: '#bae6fd', glow: '0 0 28px rgba(37,99,235,.65)', alive: true }
}

export function FlamePet({ streak, size = 72 }: { streak: number; size?: number }) {
  const { c1, c2, hi, glow, alive } = look(streak)
  const gid = `flame-${c2.replace('#', '')}`
  return (
    <div className={alive ? 'animate-flame' : ''} style={{ width: size, height: size * 1.25, filter: `drop-shadow(${glow})` }}>
      <svg viewBox="0 0 64 80" width={size} height={size * 1.25} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        {/* body */}
        <path d="M32 5 C 22 22 13 30 16 47 C 18 60 25 73 32 75 C 39 73 46 60 48 47 C 51 30 42 22 32 5 Z" fill={`url(#${gid})`} />
        {/* inner highlight */}
        <path d="M32 33 C 27 41 24 47 26 55 C 28 63 32 68 32 68 C 32 68 36 63 38 55 C 40 47 37 41 32 33 Z" fill={hi} opacity="0.85" />
        {/* face */}
        {alive ? (
          <g fill="#1c1917">
            <ellipse cx="27" cy="45" rx="2.4" ry="3.1" />
            <ellipse cx="37" cy="45" rx="2.4" ry="3.1" />
            <path d="M28 53 Q 32 57 36 53" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g stroke="#1c1917" strokeWidth="2" strokeLinecap="round">
            <path d="M24.5 46 q 2.5 2 5 0" fill="none" />
            <path d="M34.5 46 q 2.5 2 5 0" fill="none" />
            <path d="M29 54 q 3 -2 6 0" fill="none" />
          </g>
        )}
      </svg>
    </div>
  )
}

export function FlameWidget({ streak, fedToday, partnerMissing, days }: {
  streak: number
  fedToday: boolean
  partnerMissing: boolean
  days?: number | null
}) {
  const next = MILESTONES.find(m => m > streak) ?? null
  const prev = [...MILESTONES].reverse().find(m => m <= streak) ?? 0
  const pct = next ? Math.round(((streak - prev) / (next - prev)) * 100) : 100

  return (
    <section className="relative rounded-2xl bg-stone-900/70 border border-stone-800 p-4 flex items-center gap-4 card-glow">
      {days != null && (
        <span className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-stone-400">
          <Heart size={12} className="text-amber-600" />
          <span className="text-amber-100 font-medium">{days.toLocaleString()}</span>
          <span className="text-stone-500">days</span>
        </span>
      )}
      <div className="shrink-0">
        <FlamePet streak={streak} size={64} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {streak > 0 ? (
            <>
              <span className="text-amber-100 text-2xl font-semibold leading-none">{streak}</span>
              <span className="text-stone-400 text-sm">day streak</span>
            </>
          ) : (
            <span className="text-amber-100 font-medium">Your flame&rsquo;s asleep</span>
          )}
        </div>

        {next && streak > 0 && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
              <div className="h-full rounded-full bg-amber-600" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-stone-500 text-[11px] mt-1">{next - streak} day{next - streak !== 1 ? 's' : ''} to your {next}-day milestone</p>
          </div>
        )}

        <p className="text-stone-400 text-xs mt-2 flex items-center gap-1.5">
          {partnerMissing
            ? 'Invite your partner to start a streak.'
            : fedToday
              ? <><Flame size={12} className="text-amber-500" /> Fed today — see you tomorrow.</>
              : 'Feed it: both journal, add a memory, or study today.'}
        </p>
      </div>
    </section>
  )
}
