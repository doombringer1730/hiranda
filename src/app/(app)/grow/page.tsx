import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Ticket, BookHeart, Sparkles } from 'lucide-react'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { PATH, ALL_LESSONS, MILESTONES } from '@/lib/path'
import PageHeader from '@/components/page-header'
import { Scribble } from '@/components/handmade'
import { PersonChip } from '@/components/ui'
import WhyItWorks from '@/components/why-it-works'
import CalendarWidget from '../study/calendar-widget'
import type { Assignment } from '../study/assignments-panel'
import { awardMilestones, getReviewDeck } from './actions'
import PathMap from './path-map'

const DAY = 86_400_000
const WEEK_GOAL = 4

// Grow: the study dashboard, rebuilt around the research — a shared weekly
// rhythm instead of XP, a team bar instead of a leaderboard, Love Map review
// instead of flashcards, and a passport of stamps that earn you coupons.
export default async function GrowPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const { supabase, user, couple, partnerId } = ctx

  const justStamped = await awardMilestones()

  // This week (Mon–Sun, UTC): days you both showed up.
  const now = new Date()
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)))
  const since = monday.toISOString()

  const [
    people, { data: progressRows }, { data: earned }, { data: lessonRows }, { data: coupons }, review,
    { data: assignments }, { data: decks },
    { data: j }, { data: m }, { data: r }, { data: msg }, { data: taps }, { data: talks },
  ] = await Promise.all([
    getPeople(),
    supabase.rpc('milestone_progress'),
    supabase.from('milestones').select('key, earned_at').eq('couple_id', couple.id),
    supabase.from('lesson_progress').select('user_id, lesson_key, completed_at').eq('couple_id', couple.id),
    supabase.from('coupons').select('id, bought_by, redeemed, revealed_at, done_at'),
    getReviewDeck(),
    supabase.from('assignments').select('id, title, due_date, turned_in').order('due_date'),
    supabase.from('study_decks').select('id, title').order('created_at', { ascending: false }),
    supabase.from('journal_entries').select('created_by, created_at').gte('created_at', since),
    supabase.from('memories').select('created_by, created_at').gte('created_at', since),
    supabase.from('prompt_responses').select('user_id, responded_at').gte('responded_at', since),
    supabase.from('messages').select('sender, created_at').eq('couple_id', couple.id).gte('created_at', since),
    supabase.from('love_taps').select('from_user, created_at').gte('created_at', since),
    supabase.from('talk_sessions').select('started_at, completed').eq('couple_id', couple.id).gte('started_at', since),
  ])

  const byDay = new Map<string, Set<string>>()
  const mark = (who: string, at: string) => { const k = at.slice(0, 10); byDay.set(k, (byDay.get(k) ?? new Set()).add(who)) }
  for (const x of j ?? []) mark(x.created_by, x.created_at)
  for (const x of m ?? []) mark(x.created_by, x.created_at)
  for (const x of r ?? []) mark(x.user_id, x.responded_at)
  for (const x of msg ?? []) mark(x.sender, x.created_at)
  for (const x of taps ?? []) mark(x.from_user, x.created_at)
  const talkDays = new Set((talks ?? []).filter(t => t.completed).map(t => t.started_at.slice(0, 10)))
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY).toISOString().slice(0, 10)
    const s = byDay.get(d)
    return { d, together: talkDays.has(d) || (!!s && s.has(user.id) && s.has(partnerId)), future: d > now.toISOString().slice(0, 10) }
  })
  const togetherDays = week.filter(w => w.together).length

  // Path progress.
  const doneBy = new Map<string, Set<string>>()
  for (const l of lessonRows ?? []) doneBy.set(l.lesson_key, (doneBy.get(l.lesson_key) ?? new Set()).add(l.user_id))
  const together = ALL_LESSONS.filter(l => doneBy.get(l.key)?.size === 2).length
  const next = ALL_LESSONS.find(l => !doneBy.get(l.key)?.has(user.id))

  // Passport.
  const progress = new Map(((progressRows ?? []) as { track: string; value: number }[]).map(p => [p.track, p.value]))
  const earnedSet = new Set((earned ?? []).map(e => e.key))
  const upcoming = MILESTONES.filter(ms => !earnedSet.has(ms.key))
    .map(ms => ({ ms, have: progress.get(ms.track) ?? 0 }))
    .sort((a, b) => (a.ms.threshold - a.have) / a.ms.threshold - (b.ms.threshold - b.have) / b.ms.threshold)
  const nextStamp = upcoming[0]

  // Coupons.
  const mine = (coupons ?? []).filter(c => c.bought_by === user.id)
  const toReveal = mine.filter(c => !c.revealed_at).length
  const toUse = mine.filter(c => !c.redeemed).length
  const owed = (coupons ?? []).filter(c => c.bought_by === partnerId && c.redeemed && !c.done_at).length

  const me = people.get(user.id), partner = people.get(partnerId)
  const tile = 'tile p-4'
  const label = 'text-stone-400 text-[11px] uppercase tracking-[0.2em]'

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl md:max-w-4xl mx-auto">
      <PageHeader eyebrow="Grow together" title="Grow" />
      <p className="relative inline-block font-hand text-[23px] text-amber-200 mt-2 mb-6">
        {together} lesson{together === 1 ? '' : 's'} together · {earnedSet.size} stamp{earnedSet.size === 1 ? '' : 's'}
        <Scribble kind="underline" className="absolute left-0 -bottom-1.5 h-2 w-full text-amber-500/60" />
      </p>

      {justStamped.length > 0 && (
        <Link href="/grow/coupons" className="paper rounded-[6px] px-5 py-4 mb-5 flex items-center gap-4 animate-rise -rotate-[0.5deg]">
          <span className="text-4xl">{MILESTONES.find(x => x.key === justStamped[0])?.emoji ?? '🎟️'}</span>
          <span className="min-w-0">
            <span className="block font-hand text-[26px] leading-tight text-[var(--paper-ink)]">New stamp! You both earned a coupon.</span>
            <span className="block text-sm text-[var(--paper-muted)]">{MILESTONES.find(x => x.key === justStamped[0])?.title} — tap to reveal yours</span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* This week — a shared rhythm, not a streak to lose */}
        <section className={`${tile} col-span-2`}>
          <div className="flex items-center justify-between">
            <p className={label}>This week</p>
            {togetherDays >= WEEK_GOAL && <p className="text-amber-300 text-xs">Good week 🔥</p>}
          </div>
          <div className="flex justify-between mt-3">
            {week.map((w, i) => (
              <div key={w.d} className="flex flex-col items-center gap-1.5">
                <span className={`grid place-items-center h-9 w-9 rounded-full text-sm transition-colors ${w.together ? 'bg-amber-600 text-amber-50' : w.future ? 'border border-dashed border-stone-700 text-stone-600' : 'bg-stone-800/70 text-stone-500'}`}>
                  {w.together ? '♥' : ''}
                </span>
                <span className="text-[10px] text-stone-500">{'MTWTFSS'[i]}</span>
              </div>
            ))}
          </div>
          <p className="text-stone-300 text-sm mt-3">
            <span className="font-serif text-2xl text-amber-50">{togetherDays}</span> of {WEEK_GOAL} together days
          </p>
          <p className="text-stone-500 text-xs mt-0.5">A day counts when you both show up — any little thing. Busy weeks happen; nothing breaks.</p>
        </section>

        {/* Coupon book */}
        <Link href="/grow/coupons" className={`${tile} flex flex-col justify-between group`}>
          <p className={`${label} flex items-center gap-1.5`}><Ticket size={12} /> Coupons</p>
          <p className="font-serif text-[44px] leading-none text-amber-50 mt-2">{toUse}</p>
          <p className="text-stone-400 text-xs mt-1">
            {toReveal ? <span className="text-amber-300">{toReveal} to reveal ✨</span> : owed ? `${partner?.first ?? 'They'} is using ${owed}` : 'to use on each other'}
          </p>
        </Link>

        {/* Love Map review */}
        <Link href="/grow/review" className={`${tile} flex flex-col justify-between group`}>
          <p className={`${label} flex items-center gap-1.5`}><BookHeart size={12} /> Love Map</p>
          <p className="font-serif text-[44px] leading-none text-amber-50 mt-2">{review?.dueTotal ?? 0}</p>
          <p className="text-stone-400 text-xs mt-1">{review?.dueTotal ? `things about ${review.partnerName} to review` : 'answer more questions to fill it'}</p>
        </Link>

        {/* Up next on the path — one team bar, never a leaderboard */}
        {next && (
          <Link href={`/grow/lesson/${next.key}`} className={`${tile} col-span-2 md:col-span-4 flex items-center gap-4 group`} style={{ background: `linear-gradient(110deg, color-mix(in oklab, ${next.unit.color} 28%, transparent), transparent 70%), color-mix(in oklab, var(--color-stone-900) 80%, transparent)` }}>
            <span className="grid place-items-center h-14 w-14 shrink-0 rounded-2xl text-3xl" style={{ background: `color-mix(in oklab, ${next.unit.color} 35%, transparent)` }}>{next.unit.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className={`${label} flex items-center gap-1.5`}><Sparkles size={11} /> Up next · {next.unit.title}</span>
              <span className="block font-serif text-2xl leading-tight text-amber-50 mt-0.5 truncate">{next.title}</span>
              <span className="mt-2 flex items-center gap-2">
                <span className="h-2 flex-1 rounded-full bg-stone-800 overflow-hidden"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${(together / ALL_LESSONS.length) * 100}%` }} /></span>
                <span className="text-stone-400 text-xs shrink-0">{together}/{ALL_LESSONS.length} together</span>
              </span>
            </span>
            <ChevronRight size={18} className="text-stone-600 group-hover:text-amber-400 shrink-0" />
          </Link>
        )}

        {/* Next stamp — goal-gradient: show how close you are */}
        {nextStamp && (
          <section className={`${tile} col-span-2 md:col-span-4 flex items-center gap-4`}>
            <span className="text-3xl grayscale-[0.4]">{nextStamp.ms.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className={label}>Next stamp</span>
              <span className="block text-amber-50 text-[15px] mt-0.5">{nextStamp.ms.title} <span className="text-stone-500 text-xs">· a {nextStamp.ms.rarity} coupon for you both</span></span>
              <span className="mt-2 flex items-center gap-2">
                <span className="h-2 flex-1 rounded-full bg-stone-800 overflow-hidden"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (nextStamp.have / nextStamp.ms.threshold) * 100)}%` }} /></span>
                <span className="text-stone-400 text-xs shrink-0">{Math.min(nextStamp.have, nextStamp.ms.threshold)}/{nextStamp.ms.threshold}</span>
              </span>
            </span>
          </section>
        )}

      </div>

      {/* The Path */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-2">
          <h2 className="font-serif text-[32px] leading-none text-amber-50">The Path</h2>
          <span className="flex items-center gap-1.5 text-xs text-stone-400"><PersonChip person={me} size={16} /> you · <PersonChip person={partner} size={16} /> {partner?.first}</span>
        </div>
        <p className="text-stone-400 text-sm mb-6">Short lessons you do for real, in Hiranda. Each one counts once you’ve both done it — take your time.</p>
        <PathMap units={PATH} doneBy={Object.fromEntries([...doneBy].map(([k, v]) => [k, [...v]]))} myId={user.id} partnerId={partnerId} myColor={me?.accent ?? '#b45309'} partnerColor={partner?.accent ?? '#e7829f'} />
      </section>

      {/* Passport */}
      <section className="mt-12">
        <h2 className="font-serif text-[32px] leading-none text-amber-50">Passport</h2>
        <p className="text-stone-400 text-sm mt-2 mb-5">Stamps for the things you do together. Each one gives you both a coupon.</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {MILESTONES.map((ms, i) => {
            const got = earnedSet.has(ms.key)
            const have = progress.get(ms.track) ?? 0
            return (
              <div key={ms.key} className={`relative aspect-square rounded-full grid place-items-center text-center p-2 ${got ? 'border-[3px] border-double' : 'border-2 border-dashed border-stone-700 opacity-60'}`}
                style={got ? { borderColor: ms.rarity === 'legendary' ? '#d4a531' : ms.rarity === 'rare' ? '#5b8fd6' : 'var(--color-amber-600)', rotate: `${[-8, 5, -3, 9, -6, 4][i % 6]}deg` } : undefined}
                title={got ? `${ms.title} — earned` : `${ms.title} — ${have}/${ms.threshold}`}>
                <span>
                  <span className={`block text-2xl ${got ? '' : 'grayscale'}`}>{ms.emoji}</span>
                  <span className={`block text-[9px] leading-tight mt-1 ${got ? 'text-amber-100' : 'text-stone-500'}`}>{got ? ms.title : `${Math.min(have, ms.threshold)}/${ms.threshold}`}</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Plans (the calendar, kept from Study) */}
      <section className="mt-12">
        <h2 className="font-serif text-[32px] leading-none text-amber-50 mb-5">Plans</h2>
        <CalendarWidget assignments={(assignments ?? []) as Assignment[]} />
      </section>

      {(decks?.length ?? 0) > 0 && (
        <details className="mt-12 tile p-4">
          <summary className="cursor-pointer text-stone-300 text-sm">Your flashcard sets ({decks!.length})</summary>
          <div className="flex flex-col mt-3">
            {decks!.map(d => (
              <Link key={d.id} href={`/study/${d.id}`} className="flex items-center justify-between py-2 text-amber-50 hover:text-amber-300">
                <span className="font-serif text-lg">{d.title}</span><ChevronRight size={15} className="text-stone-600" />
              </Link>
            ))}
          </div>
        </details>
      )}

      <WhyItWorks className="mt-10" source="Lally et al., 2010; Silverman & Barasch, 2023">
        Habits take about two months to stick, and missing a day doesn’t undo them. Streaks help — as long as a busy day can’t break them. So here, nothing breaks.
      </WhyItWorks>
    </div>
  )
}
