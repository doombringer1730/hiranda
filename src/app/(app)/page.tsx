import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  PenLine, CalendarHeart, Play, MessageCircleQuestion, ChevronRight,
} from 'lucide-react'
import PresenceCards, { type PresonProfile } from './presence-cards'
import { FlameWidget } from './flame-pet'

const PROFILE_FIELDS = 'id, display_name, avatar_url, username, status_text, accent_color, banner_url, bio'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'still up'
  if (h < 12) return 'good morning'
  if (h < 18) return 'good afternoon'
  return 'good evening'
}

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

// Shared streak: consecutive days (ending today, or yesterday as grace) with
// any couple activity — a journal entry, memory, or answered prompt.
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
function computeStreak(days: Set<string>): number {
  const d = new Date()
  if (!days.has(dayKey(d))) d.setUTCDate(d.getUTCDate() - 1) // grace: today not logged yet
  let n = 0
  while (days.has(dayKey(d))) { n++; d.setUTCDate(d.getUTCDate() - 1) }
  return n
}

export default async function HomeHub() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple')
    .select('id, user1_id, user2_id, together_since')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  const since = new Date(Date.now() - 45 * 86_400_000).toISOString()

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
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p as PresonProfile]))
  const me = profileMap.get(user.id) ?? { id: user.id, display_name: 'You', avatar_url: null, username: null, status_text: null, accent_color: null, banner_url: null, bio: null }
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
  // thing that day — both journalled, or both added a memory. (Study joins later.)
  const byDay = new Map<string, { mem: Set<string>; jrn: Set<string>; std: Set<string> }>()
  const mark = (day: string, kind: 'mem' | 'jrn' | 'std', uid: string) => {
    const e = byDay.get(day) ?? { mem: new Set<string>(), jrn: new Set<string>(), std: new Set<string>() }
    e[kind].add(uid); byDay.set(day, e)
  }
  for (const r of (journalDays ?? []) as { created_by: string; created_at: string }[]) mark(r.created_at.slice(0, 10), 'jrn', r.created_by)
  for (const r of (memoryDays ?? []) as { created_by: string; created_at: string }[]) mark(r.created_at.slice(0, 10), 'mem', r.created_by)
  for (const r of (studyDays ?? []) as { user_id: string; created_at: string }[]) mark(r.created_at.slice(0, 10), 'std', r.user_id)
  const fedDays = new Set<string>()
  if (partnerId) {
    const both = (s: Set<string>) => s.has(user.id) && s.has(partnerId)
    for (const [day, e] of byDay) if (both(e.mem) || both(e.jrn) || both(e.std)) fedDays.add(day)
  }
  const streak = computeStreak(fedDays)
  const fedToday = fedDays.has(dayKey(new Date()))

  const hasWaiting = yourTurnPrompt || journalFresh

  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl md:max-w-4xl mx-auto">
      {/* Greeting */}
      <header className="mb-6">
        <p className="text-stone-500 text-sm">{greeting()},</p>
        <h1 className="font-serif text-3xl text-amber-100 mt-0.5">{firstName}</h1>
      </header>

      {/* Bento grid — size signals importance: presence + flame are the
          full-width heroes; waiting & coming-up sit side by side beneath. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Presence — the "double stack" */}
        {couple && <div className="md:col-span-2"><PresenceCards coupleId={couple.id} me={me} partner={partner} /></div>}

        {/* Flame pet + days — the shared "us" hero */}
        {couple && <div className="md:col-span-2"><FlameWidget streak={streak} fedToday={fedToday} partnerMissing={!partnerId} days={days} /></div>}

        {/* Waiting for you */}
        {hasWaiting && (
        <section className="md:col-span-1">
          <h2 className="text-stone-500 text-xs uppercase tracking-widest mb-3">Waiting for you</h2>
          <div className="flex flex-col gap-2.5">
            {yourTurnPrompt && (
              <Link href="/games" className="group flex items-center gap-3 bg-amber-900/20 border border-amber-800/40 rounded-2xl p-4 hover:border-amber-700/60 card-glow">
                <MessageCircleQuestion size={18} className="text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-amber-100 text-sm">{partnerFirst} answered — your turn</p>
                  <p className="text-stone-500 text-xs truncate mt-0.5">&ldquo;{yourTurnPrompt.text}&rdquo;</p>
                </div>
                <ChevronRight size={16} className="text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
              </Link>
            )}
            {journalFresh && latestJournal && (
              <Link href={`/journal`} className="group flex items-center gap-3 bg-stone-900/70 border border-stone-800 rounded-2xl p-4 hover:border-amber-800/50 card-glow">
                <PenLine size={18} className="text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-amber-100 text-sm truncate">{partnerFirst} wrote a journal entry</p>
                  <p className="text-stone-500 text-xs truncate mt-0.5">{latestJournal.title || 'Untitled entry'}</p>
                </div>
                <ChevronRight size={16} className="text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
              </Link>
            )}
          </div>
        </section>
      )}

        {/* Coming up */}
        {(upcoming || watching) && (
        <section className="md:col-span-1">
          <h2 className="text-stone-500 text-xs uppercase tracking-widest mb-3">Coming up</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {upcoming && (
              <Link href="/dates" className="bg-stone-900/70 border border-stone-800 rounded-2xl p-4 hover:border-amber-800/50 card-glow flex flex-col gap-1">
                <CalendarHeart size={16} className="text-amber-600" />
                <p className="text-amber-100 text-sm mt-1 truncate">{upcoming.label}</p>
                <p className="text-amber-200/80 text-xs">
                  {upcoming.inDays === 0 ? 'today' : upcoming.inDays === 1 ? 'tomorrow' : `in ${upcoming.inDays} days`}
                </p>
              </Link>
            )}
            {watching && (
              <Link href={`/watch/${watching.id}`} className="bg-stone-900/70 border border-stone-800 rounded-2xl p-4 hover:border-amber-800/50 card-glow flex flex-col gap-1">
                <Play size={16} className="text-amber-600" fill="currentColor" />
                <p className="text-amber-100 text-sm mt-1 truncate">{watching.title}</p>
                <p className="text-stone-500 text-xs">continue watching</p>
              </Link>
            )}
          </div>
        </section>
        )}
      </div>
    </div>
  )
}
