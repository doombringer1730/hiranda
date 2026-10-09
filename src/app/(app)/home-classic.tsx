import Link from 'next/link'
import { Play, ChevronRight, CalendarPlus } from 'lucide-react'
import { FlameTile } from './flame-pet'
import type { FlameState } from '@/lib/flame'
import { CountUp, ThinkingOfYou } from './home-tiles'
import DailyQuestion from './daily-question'
import { WidgetSync } from '@/components/widget-sync'
import TalkTime from './talk-time'
import { Polaroid } from '@/components/handmade'
import CheckinCard from './closeness/checkin-card'
import type { Waiting } from './home-widget-tiles'

const eyebrow = 'text-stone-400 text-[11px] uppercase tracking-[0.22em]'

// Home as it has always been. Couples without Plus keep this one; the widget
// Home you arrange yourself comes with Plus.
export default function ClassicHome({
  myId, partnerId, partnerFirst, firstName, hasPartnerProfile, togetherSince, hasCouple,
  waiting, pick, pickPhoto, pickLabel, upcoming, lastLove, flame, watching,
}: {
  myId: string
  partnerId: string | null
  partnerFirst: string
  firstName: string
  hasPartnerProfile: boolean
  togetherSince: string | null
  hasCouple: boolean
  waiting: Waiting[]
  pick: { id: string; title: string } | null
  pickPhoto: string | null
  pickLabel: string | null
  upcoming: { label: string; inDays: number } | undefined
  lastLove: string | null
  flame: FlameState
  watching: { id: string; title: string } | undefined
}) {
  return (
    <>
      {/* Your move — only when something is waiting on you */}
      {waiting.length > 0 && (
        <section className="mb-6 animate-rise">
          <p className={`${eyebrow} px-1 mb-2`}>Your move · {waiting.length}</p>
          <div className="tile p-1.5 flex flex-col">
            {waiting.slice(0, 4).map((w, i) => {
              const Icon = w.icon
              return (
                <Link key={i} href={w.href} className="group flex items-center gap-3 rounded-[22px] px-3 py-2.5 hover:bg-stone-800/50 transition-colors">
                  <span className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-amber-700/20 text-amber-300"><Icon size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-amber-50 text-[15px] truncate">{w.title}</span>
                    {w.sub && <span className="block text-stone-400 text-xs truncate">{w.sub}</span>}
                  </span>
                  <ChevronRight size={16} className="text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Two columns on desktop, one flowing column on phones. The things you
          do together today come first; keepsakes and counters follow. */}
      <div className="grid gap-x-6 gap-y-6 md:grid-cols-[1.15fr_1fr] md:items-start">
        <div className="flex flex-col gap-6">
          {partnerId && (
            <div className="pt-2 animate-rise" style={{ '--i': 1 } as React.CSSProperties}>
              <DailyQuestion myId={myId} partnerId={partnerId} partnerName={partnerFirst} />
              <WidgetSync since={togetherSince} partner={hasPartnerProfile ? partnerFirst : null} me={firstName} />
            </div>
          )}
          {partnerId && (
            <div className="animate-rise" style={{ '--i': 2 } as React.CSSProperties}>
              <TalkTime myId={myId} partnerName={partnerFirst} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* A keepsake, then the two little counters beside it */}
          <div className="grid grid-cols-[1.15fr_1fr] gap-4 items-stretch animate-rise" style={{ '--i': 3 } as React.CSSProperties}>
            <Link href={pick ? `/memories/${pick.id}` : '/memories/new'} className="block pt-3 pl-1">
              <Polaroid
                src={pickPhoto}
                caption={pick?.title ?? 'Add your first memory'}
                sub={pickLabel ?? 'On this day'}
                tilt={-3}
              />
            </Link>
            <div className="flex flex-col gap-4">
              <Link href="/dates" className="tile flex-1 p-4 flex flex-col justify-between min-h-[120px]">
                <p className={eyebrow}>Countdown</p>
                {upcoming ? (
                  <div>
                    {upcoming.inDays === 0
                      ? <p className="font-serif text-[38px] leading-none text-amber-50">Today 🎉</p>
                      : <p className="font-serif text-[44px] leading-none text-amber-50"><CountUp value={upcoming.inDays} /><span className="text-stone-400 text-base font-sans ml-1.5">{upcoming.inDays === 1 ? 'day' : 'days'}</span></p>}
                    <p className="text-stone-400 text-xs mt-1 truncate">{upcoming.label}</p>
                  </div>
                ) : (
                  <p className="text-stone-400 text-sm flex items-center gap-2"><CalendarPlus size={18} className="text-stone-500" /> Add a date</p>
                )}
              </Link>
              {partnerId && (
                <div className="flex-1">
                  <ThinkingOfYou partnerName={partnerFirst} lastFromPartner={lastLove} />
                </div>
              )}
            </div>
          </div>

          {hasCouple && (
            <Link href="/grow" className="block animate-rise" style={{ '--i': 4 } as React.CSSProperties}>
              <FlameTile flame={flame} partnerMissing={!partnerId} />
            </Link>
          )}

          {/* The first week of a month: last month's keepsake is ready. */}
          {hasCouple && new Date().getUTCDate() <= 7 && (
            <Link href="/month" className="tile p-4 flex items-center gap-3 animate-rise" style={{ '--i': 5 } as React.CSSProperties}>
              <span className="grid place-items-center h-10 w-10 rounded-full bg-stone-800 text-lg" aria-hidden>📔</span>
              <span className="min-w-0 flex-1">
                <span className="block text-amber-50 text-sm truncate">Your {new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} keepsake is ready</span>
                <span className="block text-stone-400 text-xs">Our month, and what you two were great at</span>
              </span>
              <ChevronRight size={16} className="text-stone-600" />
            </Link>
          )}

          {/* About once a month: a private closeness check-in. */}
          {hasCouple && partnerId && <div className="animate-rise" style={{ '--i': 5 } as React.CSSProperties}><CheckinCard partnerName={partnerFirst} /></div>}

          {/* Continue watching (Theater link only — the watch page is untouched) */}
          {watching && (
            <Link href={`/watch/${watching.id}`} className="tile p-4 flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-full bg-stone-800 text-amber-300"><Play size={16} fill="currentColor" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-amber-50 text-sm truncate">{watching.title}</span>
                <span className="block text-stone-400 text-xs">Continue watching</span>
              </span>
              <ChevronRight size={16} className="text-stone-600" />
            </Link>
          )}
        </div>
      </div>

      {hasCouple && (
        <p className="mt-8 text-center text-xs text-stone-500">
          <Link href="/plus" className="hover:text-amber-300 transition-colors">Arrange Home your way with Plus ✨</Link>
        </p>
      )}
    </>
  )
}
