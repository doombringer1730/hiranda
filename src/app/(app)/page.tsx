import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  PenLine, MessageCircle, MessageCircleQuestion, ChevronRight, Gamepad2, Brain, Gift,
} from 'lucide-react'
import { type PresonProfile } from './presence-cards'
import { FlamePet, FlameTile } from './flame-pet'
import { flameState } from '@/lib/flame'
import { ThinkingOfYou, PhotoFrame, TodosWidget } from './home-tiles'
import { GAMES, type Kind } from './games/board/engine'
import DailyQuestion from './daily-question'
import { WidgetSync } from '@/components/widget-sync'
import TalkTime from './talk-time'
import { awardMilestones } from './grow/actions'
import { Greeting, TodayLine } from './greeting'
import { InstallCard, NotificationCard } from '@/components/pwa'
import { Scribble } from '@/components/handmade'
import SponsorCard from '@/components/sponsor-card'
import IncomingGiftCard, { type IncomingGift } from '@/components/incoming-gift'
import CheckinCard from './closeness/checkin-card'
import PlusWelcome from './plus/plus-welcome'
import HomeGrid from './home-grid'
import ClassicHome, { YourMoveList, ContinueWatchingRow } from './home-classic'
import { ClocksWidget, TimeZoneSync } from './home-clocks'
import {
  CountdownWidget, DaysWidget, LettersWidget, BucketWidget, WatchlistWidget, SongWidget, ShortcutsWidget,
  CalendarWidget, JournalWidget, MovesWidget, WatchingWidget, MemoryWidget, Shell, Label, Ring, big, type Waiting,
} from './home-widget-tiles'
import { normalizeLayout, DEFAULT_LAYOUT } from '@/lib/home-widgets'
import { hasPlus } from '@/lib/plus'
import { NoteWidget } from './home-tiles'
import { PartnerWidget, WeatherWidget, WeekWidget, JarWidget, GrowWidget } from './home-more-tiles'
import { weatherFor, cityOf } from '@/lib/weather'
import { ALL_LESSONS } from '@/lib/path'

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
  // Plus decides which Home you get: the widgets you arrange, or the classic one.
  const [plus] = await Promise.all([hasPlus(), partnerId ? awardMilestones() : null])

  const none = Promise.resolve({ data: [] as never[] })
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
    { data: savedLayout },
    { data: lettersForMe },
    { data: bucket },
    { data: upNext, count: watchlistLeft },
    { data: songs },
    { data: zones },
    { data: lastPage },
    { data: openTodos },
    { data: homeNote },
    { data: jarSlips },
    { data: lessons },
    { count: heartsThisWeek },
  ] = await Promise.all([
    supabase.from('profiles').select(PROFILE_FIELDS).in('id', [user.id, ...(partnerId ? [partnerId] : [])]),
    partnerId
      ? supabase.from('prompt_responses')
          .select('prompt_id, responded_at, prompts!inner(text, type)')
          .eq('user_id', partnerId).lt('prompts.depth', 4) // never After Dark on Home
          .order('responded_at', { ascending: false }).limit(20)
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
    // Everything below is only for the widget Home (Plus).
    // The Home screen layout, shared by you both (none yet: the default).
    plus && couple
      ? supabase.from('home_layouts').select('layout').eq('couple_id', couple.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // For the Letters, Bucket list, Up next and Our song widgets
    plus ? supabase.from('letters').select('unlock_at').eq('recipient', user.id).is('opened_at', null).limit(50) : none,
    plus ? supabase.from('bucket_list').select('id, title, completed').limit(500) : none,
    plus
      ? supabase.from('watchlist').select('title, type', { count: 'exact' }).eq('watched', false).order('created_at', { ascending: true }).limit(1)
      : Promise.resolve({ data: [] as never[], count: 0 }),
    plus ? supabase.from('music_moments').select('song_name, artist, note, added_by').order('created_at', { ascending: false }).limit(1) : none,
    // For the Clocks widget (fails quietly until migration 040 adds the column)
    plus ? supabase.from('profiles').select('id, time_zone').in('id', [user.id, ...(partnerId ? [partnerId] : [])]) : Promise.resolve({ data: null }),
    // For the Notes and Reminders widgets
    plus ? supabase.from('journal_entries').select('id, title, body, created_by, created_at').order('created_at', { ascending: false }).limit(1) : none,
    plus ? supabase.from('todos').select('id, text').eq('completed', false).order('created_at', { ascending: true }).limit(9) : none,
    // For the Sticky note, Date jar, Grow and Thinking of you widgets
    plus && couple ? supabase.from('home_notes').select('body, updated_by, updated_at').eq('couple_id', couple.id).maybeSingle() : Promise.resolve({ data: null }),
    plus && partnerId ? supabase.rpc('jar_slips_for', { p_jar: 'ours' }) : none,
    plus && couple ? supabase.from('lesson_progress').select('user_id, lesson_key').eq('couple_id', couple.id) : none,
    plus && partnerId
      ? supabase.from('love_taps').select('id', { count: 'exact', head: true }).in('from_user', [user.id, partnerId]).gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
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
    .sort((a, b) => a.inDays - b.inDays)
    .map(d => {
      const on = new Date(); on.setHours(12, 0, 0, 0); on.setDate(on.getDate() + d.inDays)
      return { id: d.id, label: d.label, inDays: d.inDays, on: `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, '0')}-${String(on.getDate()).padStart(2, '0')}` }
    })

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

  // Arranging Home is Plus. Without it, Home is the default (a saved layout
  // waits for Plus to come back).
  const layout = plus && savedLayout ? normalizeLayout(savedLayout.layout) : DEFAULT_LAYOUT.map(i => ({ ...i }))

  // Letters to you: the ones you can open now, and the next sealed one.
  const now = today.getTime()
  const myLetters = (lettersForMe ?? []) as { unlock_at: string | null }[]
  const lettersWaiting = myLetters.filter(l => !l.unlock_at || new Date(l.unlock_at).getTime() <= now).length
  const nextUnlock = myLetters.map(l => l.unlock_at).filter((u): u is string => !!u && new Date(u).getTime() > now).sort()[0]
  const sealedDays = nextUnlock ? Math.max(1, Math.ceil((new Date(nextUnlock).getTime() - now) / 86_400_000)) : null

  // Bucket list: a dream for today (stable for the day), and how far along you are.
  const dreams = (bucket ?? []) as { id: string; title: string; completed: boolean | null }[]
  const notYet = dreams.filter(d => !d.completed)
  const dream = notYet.length ? notYet[Number(dayKey(today).replace(/-/g, '')) % notYet.length].title : null

  const next = ((upNext ?? []) as { title: string; type: string | null }[])[0]
  const song = ((songs ?? []) as { song_name: string; artist: string; note: string | null; added_by: string }[])[0]

  // Photo frame (Plus): your latest photos, only fetched when it's on Home.
  let framePhotos: { url: string; caption: string | null; href: string }[] = []
  if (plus) {
    const { data: ph } = await supabase.from('photos').select('storage_path, caption, memory_id, memories(title)').order('created_at', { ascending: false }).limit(8)
    const rows = (ph ?? []) as { storage_path: string; caption: string | null; memory_id: string; memories: { title: string } | { title: string }[] | null }[]
    if (rows.length) {
      const { data: signed } = await supabase.storage.from('photos').createSignedUrls(rows.map(r => r.storage_path), 3600)
      framePhotos = rows.flatMap((r, n) => {
        const url = signed?.[n]?.signedUrl
        const mem = Array.isArray(r.memories) ? r.memories[0] : r.memories
        return url ? [{ url, caption: r.caption || mem?.title || null, href: `/memories/${r.memory_id}` }] : []
      })
    }
  }

  // Clocks: only when you two are in different time zones.
  const tzOf = new Map(((zones ?? []) as { id: string; time_zone: string | null }[]).map(z => [z.id, z.time_zone]))
  const myTz = tzOf.get(user.id) ?? null, partnerTz = partnerId ? tzOf.get(partnerId) ?? null : null
  const twoZones = !!myTz && !!partnerTz && myTz !== partnerTz
  const clocks = (size: 's' | 'm' | 'l') => twoZones
    ? <ClocksWidget me={{ name: firstName, tz: myTz! }} partner={{ name: partnerFirst, tz: partnerTz! }} size={size} />
    : null

  const rise = (n: number) => ({ '--i': n }) as React.CSSProperties
  const ago = (iso: string) => {
    const d = Math.floor((today.getTime() - new Date(iso).getTime()) / 86_400_000)
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
  }
  const page = ((lastPage ?? []) as { id: string; title: string | null; body: string; created_by: string; created_at: string }[])[0]
  const journalEntry = page ? {
    id: page.id, title: page.title, body: page.body.slice(0, 280),
    by: page.created_by === user.id ? 'You' : partnerFirst, ago: ago(page.created_at),
  } : null
  const todos = (openTodos ?? []) as { id: string; text: string }[]
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Partner: their face, their status, and what they're up to right now.
  const partnerCard = partner ? {
    name: partnerFirst, avatar: partner.avatar_url, accent: partner.accent_color, status: partner.status_text,
    live: partner.activity && partner.activity_at && Date.now() - new Date(partner.activity_at).getTime() < 10 * 60_000 ? partner.activity : null,
  } : null

  // Weather where each of you is (your time zone's city).
  const [myWeather, partnerWeather] = plus
    ? await Promise.all([myTz ? weatherFor(myTz, myTz) : null, partnerTz ? weatherFor(partnerTz, myTz) : null])
    : [null, null]
  const place = (who: string, tz: string | null, w: typeof myWeather) => tz ? { who, w, city: cityOf(tz) } : null

  // This week: the last seven days, lit when you both showed up.
  const week = Array.from({ length: 7 }, (_, n) => {
    const d = new Date(today); d.setDate(d.getDate() - 6 + n)
    return { label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), lit: fedDays.has(dayKey(d)), today: n === 6 }
  })

  // Date jar: ideas waiting, and the last one you drew.
  const slips = (jarSlips ?? []) as { body: string | null; drawn_at: string | null }[]
  const jarWaiting = slips.filter(x => !x.drawn_at).length
  const lastDrawn = slips.filter(x => x.drawn_at).sort((a, b) => b.drawn_at!.localeCompare(a.drawn_at!))[0]?.body ?? null

  // Grow: your next lesson, and how many you've done together.
  const doneBy = new Map<string, Set<string>>()
  for (const l of (lessons ?? []) as { user_id: string; lesson_key: string }[]) doneBy.set(l.lesson_key, (doneBy.get(l.lesson_key) ?? new Set()).add(l.user_id))
  const lessonsTogether = ALL_LESSONS.filter(l => doneBy.get(l.key)?.size === 2).length
  const nextLesson = ALL_LESSONS.find(l => !doneBy.get(l.key)?.has(user.id))

  const memory = (size: 's' | 'm' | 'l') => (
    <MemoryWidget href={pick ? `/memories/${pick.id}` : '/memories/new'} photo={pickPhoto} title={pick?.title ?? 'Add your first memory'} when={pickLabel ?? 'On this day'} size={size} />
  )
  // Flame, as a ring that fills toward the next milestone (like Activity).
  const MARKS = [7, 14, 30, 50, 100, 200, 365, 500, 1000]
  const nextMark = MARKS.find(m => m > flame.days) ?? null
  const prevMark = [...MARKS].reverse().find(m => m <= flame.days) ?? 0
  const flamePct = nextMark ? (flame.days - prevMark) / (nextMark - prevMark) : 1
  const flameMood = flame.resting ? 'sleep' : flame.fedToday ? 'happy' : 'idle'
  const flameNote = !partnerId ? 'Invite your partner to light it'
    : flame.resting ? 'Resting. Do anything together to relight it'
    : flame.fedToday ? (nextMark ? `Lit today · ${nextMark - flame.days} to ${nextMark}` : 'Lit today')
    : `Not lit yet today · ${flame.cozyLeft} cozy day${flame.cozyLeft === 1 ? '' : 's'} left`

  // Every widget, rendered once per size. HomeGrid places them; a missing one
  // means there's nothing to show right now (it hides until there is).
  const both = <T,>(f: (size: 's' | 'm' | 'l') => T) => ({ s: f('s'), m: f('m'), l: f('l') })
  const sized = (id: string, f: (size: 's' | 'm' | 'l') => React.ReactNode) =>
    Object.fromEntries(Object.entries(both(f)).map(([k, v]) => [`${id}:${k}`, v]))
  const nodes: Record<string, React.ReactNode> = {
    ...sized('moves', size => waiting.length > 0 ? <MovesWidget waiting={waiting} size={size} /> : null),
    // Full: the original Home's cards, at their own height.
    'moves:w': waiting.length > 0 ? <div className="animate-rise"><YourMoveList waiting={waiting} /></div> : null,
    'question:w': partnerId ? <div className="pt-2"><DailyQuestion myId={user.id} partnerId={partnerId} partnerName={partnerFirst} /></div> : null,
    'talk:w': partnerId ? <TalkTime myId={user.id} partnerName={partnerFirst} /> : null,
    'flame:w': couple ? <Link href="/grow" className="block"><FlameTile flame={flame} partnerMissing={!partnerId} /></Link> : null,
    'watching:w': watching ? <ContinueWatchingRow id={watching.id} title={watching.title} /> : null,
    question: partnerId ? <div className="h-full w-full overflow-y-auto overscroll-contain pt-3 [scrollbar-width:none]"><DailyQuestion myId={user.id} partnerId={partnerId} partnerName={partnerFirst} /></div> : null,
    talk: partnerId ? <div className="h-full w-full overflow-y-auto overscroll-contain [scrollbar-width:none]"><TalkTime myId={user.id} partnerName={partnerFirst} /></div> : null,
    ...sized('clocks', clocks),
    ...sized('calendar', size => <CalendarWidget today={todayKey} dates={upcoming} size={size} />),
    ...sized('todos', size => <TodosWidget todos={todos} size={size} />),
    ...sized('journal', size => <JournalWidget entry={journalEntry} size={size} />),
    ...sized('memory', memory),
    ...sized('countdown', size => <CountdownWidget dates={upcoming} size={size} />),
    'heart:s': partnerId ? <ThinkingOfYou partnerName={partnerFirst} lastFromPartner={lastLove} /> : null,
    'heart:m': partnerId ? <ThinkingOfYou partnerName={partnerFirst} lastFromPartner={lastLove} week={heartsThisWeek ?? 0} /> : null,
    ...sized('partner', size => partnerCard ? <PartnerWidget p={partnerCard} size={size} /> : null),
    ...sized('note', size => couple ? (
      <NoteWidget
        coupleId={couple.id} myId={user.id} partnerName={partnerFirst} size={size}
        initial={homeNote?.body ? { body: homeNote.body, by: homeNote.updated_by === user.id ? 'You' : partnerFirst, ago: ago(homeNote.updated_at) } : null}
      />
    ) : null),
    ...sized('weather', size => <WeatherWidget me={place(firstName, myTz, myWeather)} partner={place(partnerFirst, partnerTz, partnerWeather)} size={size} />),
    ...sized('week', size => partnerId ? <WeekWidget days={week} size={size} /> : null),
    ...sized('jar', size => partnerId ? <JarWidget waiting={jarWaiting} last={lastDrawn} size={size} /> : null),
    ...sized('grow', size => couple ? (
      <GrowWidget
        next={nextLesson ? { key: nextLesson.key, title: nextLesson.title, emoji: nextLesson.unit.emoji, unit: nextLesson.unit.title } : null}
        together={lessonsTogether} total={ALL_LESSONS.length} size={size}
      />
    ) : null),
    'flame:s': couple ? (
      <Shell href="/grow" className="items-center justify-between text-center">
        <Ring pct={flamePct} size={92} color="stroke-amber-500"><FlamePet streak={flame.days} size={44} mood={flameMood} /></Ring>
        <div>
          <p className={`${big} text-[26px]`}>{flame.days}<span className="text-[13px] font-medium text-stone-400 ml-1">{flame.days === 1 ? 'day' : 'days'} lit</span></p>
        </div>
      </Shell>
    ) : null,
    'flame:m': couple ? (
      <Shell href="/grow" className="!flex-row items-center gap-5">
        <Ring pct={flamePct} size={112} color="stroke-amber-500"><FlamePet streak={flame.days} size={54} mood={flameMood} /></Ring>
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <Label>Flame</Label>
          <p className={`${big} text-[40px]`}>{flame.days}<span className="text-[15px] font-medium text-stone-400 ml-1.5">{flame.days === 1 ? 'day' : 'days'} lit{flame.fedToday ? ' 🔥' : ''}</span></p>
          <p className="text-[13px] leading-snug text-stone-400">{flameNote}</p>
        </div>
      </Shell>
    ) : null,
    watching: watching ? <WatchingWidget id={watching.id} title={watching.title} /> : null,
    ...sized('days', size => <DaysWidget days={days} since={couple?.together_since ?? null} size={size} />),
    ...sized('letters', size => <LettersWidget waiting={lettersWaiting} sealedDays={sealedDays} partnerName={partnerFirst} size={size} />),
    ...sized('bucket', size => <BucketWidget dream={dream} done={dreams.length - notYet.length} total={dreams.length} size={size} />),
    ...sized('watchlist', size => <WatchlistWidget title={next?.title ?? null} kind={next?.type ?? null} left={watchlistLeft ?? 0} size={size} />),
    ...sized('song', size => <SongWidget song={song?.song_name ?? null} artist={song?.artist ?? null} note={song?.note ?? null} by={song ? profileMap.get(song.added_by)?.display_name.split(' ')[0] ?? null : null} size={size} />),
    ...sized('shortcuts', size => <ShortcutsWidget size={size} />),
    ...sized('photos', size => plus ? <PhotoFrame photos={framePhotos} large={size === 'l'} /> : null),
  }

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

      {/* Plus: the one-time hello for a new couple, or a note as a free week ends */}
      {couple && partnerId && <PlusWelcome userId={user.id} partnerName={partnerFirst} />}

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

      {!plus && (
        <ClassicHome
          myId={user.id} partnerId={partnerId} partnerFirst={partnerFirst} firstName={firstName}
          hasPartnerProfile={!!partner} togetherSince={couple?.together_since ?? null} hasCouple={!!couple}
          waiting={waiting} pick={pick} pickPhoto={pickPhoto} pickLabel={pickLabel} upcoming={upcoming[0]}
          lastLove={lastLove} flame={flame} watching={watching}
        />
      )}

      {/* Timely notes that come and go on their own */}
      {plus && couple && (new Date().getUTCDate() <= 7 || partnerId) && (
        <div className="mb-6 flex flex-col gap-3 empty:hidden">
          {/* The first week of a month: last month's keepsake is ready. */}
          {new Date().getUTCDate() <= 7 && (
            <Link href="/month" className="tile p-4 flex items-center gap-3 animate-rise">
              <span className="grid place-items-center h-10 w-10 rounded-full bg-stone-800 text-lg" aria-hidden>📔</span>
              <span className="min-w-0 flex-1">
                <span className="block text-amber-50 text-sm truncate">Your {new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} keepsake is ready</span>
                <span className="block text-stone-400 text-xs">Our month, and what you two were great at</span>
              </span>
              <ChevronRight size={16} className="text-stone-600" />
            </Link>
          )}
          {/* About once a month: a private closeness check-in. */}
          {partnerId && <CheckinCard partnerName={partnerFirst} />}
        </div>
      )}

      {plus && (
        <>
          {zones && <TimeZoneSync saved={myTz} />}
          {partnerId && <WidgetSync since={couple?.together_since ?? null} partner={partner ? partnerFirst : null} me={firstName} />}

          {/* Your widgets: added, removed, resized and arranged by the two of you. */}
          <div className="animate-rise" style={rise(1)}>
            <HomeGrid initial={layout} nodes={nodes} plus={plus} />
          </div>
        </>
      )}

      <div className="mt-8"><SponsorCard place="home" /></div>
    </div>
  )
}
