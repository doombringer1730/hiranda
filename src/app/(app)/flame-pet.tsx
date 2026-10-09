import { Flame, Heart } from 'lucide-react'
import { CountUp } from './home-tiles'
import type { FlameState } from '@/lib/flame'

const MILESTONES = [3, 7, 30, 100, 365]

// Glow tiers: the pet glows hotter as the run grows.
function look(streak: number) {
  if (streak <= 0) return { glow: 'none', alive: false }
  if (streak < 3)   return { glow: '0 0 10px rgba(180,83,9,.5)', alive: true }
  if (streak < 7)   return { glow: '0 0 16px rgba(234,88,12,.55)', alive: true }
  if (streak < 30)  return { glow: '0 0 20px rgba(225,29,72,.55)', alive: true }
  if (streak < 100) return { glow: '0 0 24px rgba(124,58,237,.6)', alive: true }
  return { glow: '0 0 28px rgba(37,99,235,.65)', alive: true }
}

export type FlameMood = 'idle' | 'happy' | 'sleep'

// The flame pet: a little fire creature (pixel sprites in /public). It sleeps
// while the flame rests, perks up on days you've been together, and glows
// hotter as the run grows. No sad or hurt states, on purpose.
export function FlamePet({ streak, size = 72, mood }: { streak: number; size?: number; mood?: FlameMood }) {
  const { glow, alive } = look(streak)
  const m: FlameMood = mood ?? (alive ? 'idle' : 'sleep')
  return (
    <div className={m !== 'sleep' ? 'animate-flame' : ''} style={{ width: size, filter: glow === 'none' ? undefined : `drop-shadow(${glow})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/flame-${m}.png`} alt="" width={size} className="block h-auto w-full select-none" style={{ imageRendering: 'pixelated' }} draggable={false} />
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
              : 'Feed it: both answer today’s question, journal, add a memory, or study.'}
        </p>
      </div>
    </section>
  )
}

// Home tile. Flame 2.0 (src/lib/flame.ts): it counts days you showed up for
// each other, forgives busy days, and never says anything was broken.
export function FlameTile({ flame, partnerMissing }: { flame: FlameState; partnerMissing: boolean }) {
  const { days, fedToday, resting, cozyLeft, cozyUsed } = flame
  const next = MILESTONES.find(m => m > days)
  const restedRecently = cozyUsed.length > 0 && !fedToday
  return (
    <section className="tile px-4 py-3.5 flex items-center gap-4">
      <div className={`shrink-0 -my-1 transition-opacity ${restedRecently ? 'opacity-80' : ''}`}><FlamePet streak={days} size={44} mood={resting ? 'sleep' : fedToday ? 'happy' : 'idle'} /></div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-2xl leading-none text-amber-50">
          <CountUp value={days} /> <span className="text-stone-300 text-lg">{days === 1 ? 'day' : 'days'} lit{fedToday ? ' 🔥' : ''}</span>
        </p>
        <p className="text-stone-400 text-xs mt-1 truncate">
          {partnerMissing ? 'Invite your partner to light it'
            : resting ? 'Resting. Anything you do together relights it'
            : fedToday ? (next ? `Lit today · ${next - days} to the ${next}-day mark` : 'Lit today')
            : `Busy day? It keeps. ${cozyLeft} cozy day${cozyLeft === 1 ? '' : 's'} left this month`}
        </p>
      </div>
      {!fedToday && !partnerMissing && <Flame size={16} className="shrink-0 text-amber-400/70" />}
    </section>
  )
}
