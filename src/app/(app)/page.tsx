import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen, PenLine, Library, Gamepad2, CalendarHeart, Play,
  MessageCircleQuestion, ChevronRight, Heart,
} from 'lucide-react'
import PresenceCards, { type PresonProfile } from './presence-cards'

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

const jumpIn = [
  { href: '/memories', label: 'Memories', icon: BookOpen },
  { href: '/journal', label: 'Journal', icon: PenLine },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/games', label: 'Games', icon: Gamepad2 },
]

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

  const [
    { data: profiles },
    { data: partnerTurns },
    { data: myResponses },
    { data: partnerJournal },
    { data: dates },
    { data: continueWatching },
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

  const hasWaiting = yourTurnPrompt || journalFresh

  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header: greeting + days-together chip */}
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-stone-500 text-sm">{greeting()},</p>
          <h1 className="font-serif text-3xl text-amber-100 mt-0.5">{firstName}</h1>
        </div>
        {days !== null && (
          <Link href={partner?.username ? `/profile/${partner.username}` : '/settings'}
            className="flex items-center gap-1.5 bg-stone-900/70 border border-stone-800 rounded-full px-3 py-1.5 text-xs text-stone-400 shrink-0 hover:border-amber-800/50 transition-colors">
            <Heart size={12} className="text-amber-600" />
            <span className="text-amber-100 font-medium">{days.toLocaleString()}</span> days
          </Link>
        )}
      </header>

      {/* Presence — the "double stack" */}
      {couple && <PresenceCards coupleId={couple.id} me={me} partner={partner} />}

      {/* Waiting for you */}
      {hasWaiting && (
        <section>
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
        <section>
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

      {/* Jump in */}
      <section>
        <h2 className="text-stone-500 text-xs uppercase tracking-widest mb-3">Jump in</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {jumpIn.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-2 bg-stone-900/70 border border-stone-800 rounded-2xl py-4 hover:border-amber-800/50 hover:text-amber-200 text-stone-400 transition-colors card-glow">
              <Icon size={20} />
              <span className="text-[11px]">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
