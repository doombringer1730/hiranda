import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  PenLine, Play, MessageCircle, MessageCircleQuestion, ChevronRight, Gamepad2, Brain, Gift, CalendarPlus,
} from 'lucide-react'
import { type PresonProfile } from './presence-cards'
import { FlameTile } from './flame-pet'
import { flameState } from '@/lib/flame'
import { CountUp, ThinkingOfYou } from './home-tiles'
import { GAMES, type Kind } from './games/board/engine'
import DailyQuestion from './daily-question'
import { WidgetSync } from '@/components/widget-sync'
import TalkTime from './talk-time'
import { awardMilestones } from './grow/actions'
import { Greeting, TodayLine } from './greeting'
import { InstallCard, NotificationCard } from '@/components/pwa'
import { Polaroid, Scribble } from '@/components/handmade'
import SponsorCard from '@/components/sponsor-card'
import IncomingGiftCard, { type IncomingGift } from '@/components/incoming-gift'

const PROFILE_FIELDS = 'id, display_name, avatar_url, username, status_text, accent_color, banner_url, bio, activity, activity_at'

function daysTogether(since: string | null): number | null {
  if (!since) return null
  const ms = Date.now() - new Date(since).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

// Next occurrence (in whole days from today) for an important date.
function daysUntil(dateStr: string, recurring: boolean): number | null {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  let next = new Date(y, m - 1, d)
  if (recurring) {
    next = new Date(today.getFullYear(), m - 1, d)
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d)
  }
  if (next < today) return null // one-off in the past
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)
// How far back the flame looks (each query stays well under the row cap).
const FLAME_LOOKBACK_DAYS = 100

function HomeAvatar({ p }: { p: PresonProfile }) {
  return (
    <span className="relative grid place-items-center h-9 w-9 rounded-full overflow-hidden ring-2 ring-stone-950 text-sm font-semibold text-amber-50" style={{ background: p.accent_color ?? 'var(--color-amber-800)' }}>
      {p.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
        : p.display_name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default async function HomeHub() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple')
    .select('id, user1_id, user2_id, together_since')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  // New passport stamps (and their coupons) appear as soon as they're earned.
  if (partnerId) await awardMilestones()

  const since = new Date(Date.now() - FLAME_LOOKBACK_DAYS * 86_400_000).toISOString()

  const [
    { data: profiles },
    { data: partnerTurns },
    { data: myResponses },
    { data: partnerJournal },
    { data: dates },
    { data: continueWatching },
    { data: journalDays },
    { data: memoryDays },
    { data: studyDays },
    { data: promptDays },
    { data: activeCoupons },
    { data: myMoves },
    { count: triviaWaiting },
    { data: allMemories },
    { data: partnerLove },
    { data: talkDays },
    { count: unreadChat },
  ] = await Promise.all([
    supabase.from('profiles').select(PROFILE_FIELDS).in('id', [user.id, ...(partnerId ? [partnerId] : [])]),
    partnerId
      ? supabase.from('prompt_responses')
          .select('prompt_id, responded_at, prompts!inner(text, type)')
          .eq('user_id', partnerId).order('responded_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('prompt_responses').select('prompt_id').eq('user_id', user.id),
    partnerId
      ? supabase.from('journal_entries')
          .select('id, title, created_at').eq('created_by', partnerId)
          .order('created_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('important_dates').select('id, label, date, recurring'),
    supabase.from('watch_sessions')
      .select('id, title, playback_position_seconds, updated_at')
      .gt('playback_position_seconds', 5).order('updated_at', { ascending: false }).limit(1),
    // activity for the shared flame streak (couple-scoped by RLS)
    supabase.from('journal_entries').select('created_by, created_at').gte('created_at', since),
    supabase.from('memories').select('created_by, created_at').gte('created_at', since),
    supabase.from('study_attempts').select('user_id, created_at').gte('created_at', since),
    supabase.from('prompt_responses').select('user_id, responded_at').gte('responded_at', since),
    // redeemed ("activated") coupons — someone's cashing them in
    supabase.from('coupons').select('id, title, emoji, bought_by, redeemed, revealed_at, done_at').or('redeemed.eq.false,done_at.is.null').order('created_at', { ascending: false }).limit(20),
    // live games where it's my move
    supabase.from('board_games').select('id, kind').eq('status', 'active').eq('turn', user.id),
    partnerId
      ? supabase.from('trivia_questions').select('id', { count: 'exact', head: true }).eq('author', partnerId).is('guess', null)
      : Promise.resolve({ count: 0 }),
    // for "On this day"
    supabase.from('memories').select('id, title, happened_at').order('happened_at', { ascending: false }).limit(500),
    partnerId
      ? supabase.from('love_taps').select('created_at').eq('from_user', partnerId).order('created_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('talk_sessions').select('minutes, started_at, ended_at, completed').gte('started_at', since),
    partnerId
      ? supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender', partnerId).is('read_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p as PresonProfile]))
  const { data: incoming } = await supabase.rpc('incoming_gifts')
  const gifts = ((incoming ?? []) as (IncomingGift & { sender_id: string })[])
    .filter(g => g.status !== 'delivered').slice(0, 2)
  const me = profileMap.get(user.id) ?? { id: user.id, display_name: 'You', avatar_url: null, username: null, status_text: null, accent_color: null, banner_url: null, bio: null, activity: null, activity_at: null }
  const partner = partnerId ? profileMap.get(partnerId) ?? null : null
  const firstName = me.display_name.split(' ')[0]

  // "Your turn" — a prompt the partner answered that you haven't.
  const answeredByMe = new Set((myResponses ?? []).map(r => r.prompt_id))
  const yourTurn = (partnerTurns ?? []).find(t => !answeredByMe.has(t.prompt_id))
  const yourTurnPrompt = yourTurn
    ? (Array.isArray(yourTurn.prompts) ? yourTurn.prompts[0] : yourTurn.prompts) as { text: string; type: string } | undefined
    : undefined

  const latestJournal = (partnerJournal ?? [])[0] as { id: string; title: string | null; created_at: string } | undefined
  // Only surface the journal entry if it's fresh (last 7 days).
  const journalFresh = latestJournal && (Date.now() - new Date(latestJournal.created_at).getTime()) < 7 * 86_400_000

  // Soonest upcoming date.
  const upcoming = (dates ?? [])
    .map(d => ({ ...d, inDays: daysUntil(d.date, d.recurring ?? true) }))
    .filter((d): d is typeof d & { inDays: number } => d.inDays !== null)
    .sort((a, b) => a.inDays - b.inDays)[0]

  const watching = (continueWatching ?? [])[0] as { id: string; title: string } | undefined
  const partnerFirst = partner?.display_name.split(' ')[0] ?? 'your partner'
  const days = daysTogether(couple?.together_since ?? null)

  // Shared flame streak: a day is "fed" when BOTH partners did the same kind of
  // thing that day — both journalled, added a memory, studied, or answered a prompt.
  const byDay = new Map<string, { mem: Set<string>; jrn: Set<string>; std: Set<string>; prm: Set<string> }>()
  const mark = (day: string, kind: 'mem' | 'jrn' | 'std' | 'prm', uid: string) => {
    const e = byDay.get(day) ?? { mem: new Set<string>(), jrn: new Set<string>(), std: new Set<string>(), prm: new Set<string>() }
    e[kind].add(uid); byDay.set(day, e)
  }
  for (const r of (journalDays ?? []) as { created_by: string; created_at: string }[]) mark(r.created_at.slice(0, 10), 'jrn', r.created_by)
  for (const r of (memoryDays ?? []) as { created_by: string; created_at: string }[]) mark(r.created_at.slice(0, 10), 'mem', r.created_by)
  for (const r of (studyDays ?? []) as { user_id: string; created_at: string }[]) mark(r.created_at.slice(0, 10), 'std', r.user_id)
  for (const r of (promptDays ?? []) as { user_id: string; responded_at: string }[]) mark(r.responded_at.slice(0, 10), 'prm', r.user_id)
  const fedDays = new Set<string>()
  if (partnerId) {
    const both = (s: Set<string>) => s.has(user.id) && s.has(partnerId)
    for (const [day, e] of byDay) if (both(e.mem) || both(e.jrn) || both(e.std) || both(e.prm)) fedDays.add(day)
    // Talk time is something you do together, so a finished one feeds it too.
    for (const t of (talkDays ?? []) as { minutes: number; started_at: string; ended_at: string | null; completed: boolean }[]) {
      const over = !t.ended_at && new Date(t.started_at).getTime() + t.minutes * 60_000 <= Date.now()
      if (t.completed || over) fedDays.add(t.started_at.slice(0, 10))
    }
  }
  const flame = flameState(fedDays, new Date(), FLAME_LOOKBACK_DAYS)

  // ── On this day: a memory from this date in an earlier year, otherwise one
  // from the archive (stable for the day). ──
  const today = new Date()
  const md = today.toISOString().slice(5, 10)
  const mems = (allMemories ?? []) as { id: string; title: string; happened_at: string }[]
  const sameDay = mems.filter(m => m.happened_at?.slice(5, 10) === md && m.happened_at.slice(0, 4) < String(today.getFullYear()))
  const archive = mems.filter(m => today.getTime() - new Date(m.happened_at).getTime() > 30 * 86_400_000)
  const pick = sameDay[0] ?? (archive.length ? archive[Number(dayKey(today).replace(/-/g, '')) % archive.length] : null)
  const pickLabel = !pick ? null
    : sameDay[0] ? (() => { const y = today.getFullYear() - Number(pick.happened_at.slice(0, 4)); return `${y} year${y === 1 ? '' : 's'} ago today` })()
    : `From ${new Date(pick.happened_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
  let pickPhoto: string | null = null
  if (pick) {
    const { data: ph } = await supabase.from('photos').select('storage_path').eq('memory_id', pick.id).limit(1).maybeSingle()
    if (ph?.storage_path) pickPhoto = (await supabase.storage.from('photos').createSignedUrl(ph.storage_path, 3600)).data?.signedUrl ?? null
  }

  // ── Your move: everything currently waiting on you ──
  type Waiting = { href: string; icon: React.ElementType; title: string; sub?: string }
  const waiting: Waiting[] = []
  if (unreadChat) waiting.push({ href: '/chat', icon: MessageCircle, title: `${unreadChat} new message${unreadChat === 1 ? '' : 's'} from ${partnerFirst}` })
  for (const g of (myMoves ?? []) as { id: string; kind: Kind }[]) {
    const meta = GAMES[g.kind]
    if (meta) waiting.push({ href: `/games/${meta.slug}`, icon: Gamepad2, title: `Your move in ${meta.name}`, sub: `${partnerFirst} played` })
  }
  if (yourTurnPrompt && yourTurn) waiting.push({ href: `/games/questions?p=${yourTurn.prompt_id}`, icon: MessageCircleQuestion, title: `${partnerFirst} answered — your turn`, sub: `“${yourTurnPrompt.text}”` })
  if (triviaWaiting) waiting.push({ href: '/games/trivia', icon: Brain, title: `${triviaWaiting} trivia question${triviaWaiting === 1 ? '' : 's'} about ${partnerFirst}` })
  if (journalFresh && latestJournal) waiting.push({ href: `/journal/${latestJournal.id}`, icon: PenLine, title: `${partnerFirst} wrote in the journal`, sub: latestJournal.title || 'Untitled entry' })
  type HomeCoupon = { id: string; title: string; emoji: string | null; bought_by: string; redeemed: boolean; revealed_at: string | null; done_at: string | null }
  const cps = (activeCoupons ?? []) as HomeCoupon[]
  const unrevealed = cps.filter(c => c.bought_by === user.id && !c.redeemed && !c.revealed_at).length
  if (unrevealed) waiting.push({ href: '/grow/coupons', icon: Gift, title: `${unrevealed} new coupon${unrevealed === 1 ? '' : 's'} to reveal ✨`, sub: 'earned together' })
  for (const c of cps.filter(c => c.bought_by === partnerId && c.redeemed && !c.done_at)) {
    waiting.push({ href: '/grow/coupons', icon: Gift, title: `${c.emoji ?? '🎁'} ${c.title}`, sub: `${partnerFirst} is using this one on you` })
  }

  const lastLove = ((partnerLove ?? []) as { created_at: string }[])[0]?.created_at ?? null
  const eyebrow = 'text-stone-400 text-[11px] uppercase tracking-[0.22em]'
  return (
    <div className="px-4 pb-10 max-w-2xl md:max-w-5xl mx-auto">
      {/* Greeting */}
      <header className="relative mb-7 pt-[calc(env(safe-area-inset-top)+20px)] md:pt-8">
        {/* Settings lives behind your avatar, iOS-style */}
        <Link href="/settings" aria-label="Settings" className="absolute right-0 top-[calc(env(safe-area-inset-top)+16px)] md:top-8 h-10 w-10 rounded-full overflow-hidden material flex items-center justify-center text-sm font-semibold text-amber-100">
          {me.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" />
            : firstName.slice(0, 1).toUpperCase()}
        </Link>
        <p className="text-stone-400 text-[11px] uppercase tracking-[0.3em]">
          <TodayLine />
        </p>
        <h1 className="font-serif text-[44px] md:text-6xl text-amber-50 mt-2 leading-[1.02]">
          <span className="italic text-stone-400"><Greeting />,</span><br className="md:hidden" /> {firstName}<span className="text-amber-500">.</span>
        </h1>
        {partner && (
          <div className="mt-4 flex items-center gap-3">
            <span className="flex -space-x-2.5">
              <HomeAvatar p={me} /><HomeAvatar p={partner} />
            </span>
            <p className="relative font-hand text-[22px] leading-none text-amber-200">
              {days != null ? <>{days.toLocaleString()} days of you two</> : <>you &amp; {partnerFirst}</>}
              <Scribble kind="underline" className="absolute left-0 -bottom-2 h-2.5 w-full text-amber-500/70" />
            </p>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-3 mb-3 empty:hidden">
        <InstallCard />
        <NotificationCard />
      </div>

      {/* A gift on its way to you (Hiranda Store) */}
      {gifts.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 animate-rise">
          {gifts.map(g => (
            <IncomingGiftCard key={g.id} gift={g} from={profileMap.get(g.sender_id)?.display_name.split(' ')[0] ?? partnerFirst} />
          ))}
        </div>
      )}

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
              <DailyQuestion myId={user.id} partnerId={partnerId} partnerName={partnerFirst} />
              <WidgetSync since={couple?.together_since ?? null} partner={partner ? partnerFirst : null} me={firstName} />
            </div>
          )}
          {partnerId && (
            <div className="animate-rise" style={{ '--i': 2 } as React.CSSProperties}>
              <TalkTime myId={user.id} partnerName={partnerFirst} />
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

          {couple && (
            <Link href="/grow" className="block animate-rise" style={{ '--i': 4 } as React.CSSProperties}>
              <FlameTile flame={flame} partnerMissing={!partnerId} />
            </Link>
          )}

          {/* The first week of a month: last month's keepsake is ready. */}
          {couple && new Date().getUTCDate() <= 7 && (
            <Link href="/month" className="tile p-4 flex items-center gap-3 animate-rise" style={{ '--i': 5 } as React.CSSProperties}>
              <span className="grid place-items-center h-10 w-10 rounded-full bg-stone-800 text-lg" aria-hidden>📔</span>
              <span className="min-w-0 flex-1">
                <span className="block text-amber-50 text-sm truncate">Your {new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} keepsake is ready</span>
                <span className="block text-stone-400 text-xs">Our month, in photos and good news</span>
              </span>
              <ChevronRight size={16} className="text-stone-600" />
            </Link>
          )}

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

      <div className="mt-8"><SponsorCard place="home" /></div>
    </div>
  )
}
