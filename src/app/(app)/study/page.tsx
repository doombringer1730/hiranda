import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, GraduationCap, Trophy, Brain, RotateCcw, Sparkles, ChevronRight, Heart, Coins } from 'lucide-react'
import { type Assignment } from './assignments-panel'
import CalendarWidget from './calendar-widget'
import GoalWidget from './goal-widget'
import { studyStats, HEALTH_MAX, type Attempt } from './stats'

const DEFAULT_GOAL = 500

export default async function StudyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle()
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: profiles }, { data: decks }, { data: attemptsRaw }, { data: assignments }, { data: progress }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, xp_goal, status_text').in('id', [user.id, ...(partnerId ? [partnerId] : [])]),
    supabase.from('study_decks').select('id, title, study_cards(count)').order('created_at', { ascending: false }),
    supabase.from('study_attempts').select('user_id, deck_id, mode, correct, total, xp, coins, created_at'),
    supabase.from('assignments').select('id, title, due_date, turned_in').order('due_date'),
    supabase.from('study_progress').select('due_at').eq('user_id', user.id),
  ])
  const attempts = (attemptsRaw ?? []) as Attempt[]
  const profMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const totalCards = (decks ?? []).reduce((s, d) => s + ((d.study_cards as unknown as { count: number }[])?.[0]?.count ?? 0), 0)
  const notDue = (progress ?? []).filter(p => p.due_at > today).length
  const dueCount = Math.max(0, totalCards - notDue)
  const firstDeckId = (decks ?? [])[0]?.id

  const me = studyStats(attempts, user.id)
  const partner = partnerId ? studyStats(attempts, partnerId) : null
  const myProf = profMap.get(user.id)
  const partnerProf = partnerId ? profMap.get(partnerId) : null
  const firstName = (id: string) => (profMap.get(id)?.display_name ?? 'Partner').split(' ')[0]

  const people = [
    { id: user.id, name: 'You', week: me.weeklyXp, total: me.xp },
    ...(partner && partnerId ? [{ id: partnerId, name: firstName(partnerId), week: partner.weeklyXp, total: partner.xp }] : []),
  ].sort((a, b) => b.week - a.week)

  const bestQuiz = (deckId: string, uid: string) => {
    const runs = attempts.filter(a => a.deck_id === deckId && a.user_id === uid && a.mode === 'quiz' && a.total > 0)
    if (!runs.length) return null
    return runs.reduce((best, a) => (a.correct / a.total > best.correct / best.total ? a : best))
  }
  const medals = ['🥇', '🥈']

  const smart = totalCards === 0
    ? { href: '/study/new', icon: Plus, title: 'Create your first deck', hint: 'Add cards, then quiz each other' }
    : me.health <= 0
      ? { href: '/study/review', icon: RotateCcw, title: 'Out of health — review (free)', hint: 'Spaced-repetition review doesn’t cost hearts' }
      : dueCount > 0
        ? { href: '/study/review', icon: RotateCcw, title: `Review ${dueCount} card${dueCount !== 1 ? 's' : ''} due`, hint: 'Spaced repetition — the biggest retention win' }
        : firstDeckId
          ? { href: `/study/${firstDeckId}`, icon: Brain, title: 'Learn a deck', hint: 'Active recall beats rereading' }
          : { href: '/study/new', icon: Plus, title: 'Create a deck', hint: '' }
  const SmartIcon = smart.icon

  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl md:max-w-4xl mx-auto flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap size={22} className="text-indigo-400" />
          <h1 className="font-serif text-3xl text-amber-100">Study</h1>
        </div>
        <Link href="/study/new" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> New deck
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Health */}
        <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5"><Heart size={13} className="text-red-400" fill="currentColor" /><span className="text-stone-400 text-xs">Health</span></div>
          <p className="text-3xl font-semibold text-amber-100 mt-2">{me.health}<span className="text-stone-600 text-base">/{HEALTH_MAX}</span></p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {me.health <= 0 ? 'Resting — back tomorrow' : me.flawlessToday > 0 ? `+${me.flawlessToday * 5} from flawless` : me.wrongToday > 0 ? `−${me.wrongToday} from misses` : 'Full for today'}
          </p>
        </div>

        {/* Coins */}
        <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5"><Coins size={13} className="text-amber-400" /><span className="text-stone-400 text-xs">Coins</span></div>
          <p className="text-3xl font-semibold text-amber-100 mt-2">{me.coins.toLocaleString()}</p>
          <p className="text-[11px] text-stone-500 mt-0.5">Shop coming soon</p>
        </div>

        {/* Goal double-widget */}
        <GoalWidget name="Your goal" status={myProf?.status_text ?? null} weeklyXp={me.weeklyXp} goal={myProf?.xp_goal ?? DEFAULT_GOAL} editable />
        {partner
          ? <GoalWidget name={firstName(partnerId!)} status={partnerProf?.status_text ?? null} weeklyXp={partner.weeklyXp} goal={partnerProf?.xp_goal ?? DEFAULT_GOAL} editable={false} />
          : <div className="rounded-2xl bg-stone-900/40 border border-dashed border-stone-800 flex items-center justify-center p-4 text-center text-stone-600 text-xs">Partner goal shows here</div>}

        {/* Study smarter — coaches the research-optimal next move */}
        <Link href={smart.href} className="md:col-span-2 group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-950/70 to-stone-900 border border-indigo-800/50 p-4 hover:border-indigo-600/70 transition-colors">
          <span className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-700/50 flex items-center justify-center shrink-0"><SmartIcon size={20} className="text-indigo-300" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-indigo-300/80 text-[10px] uppercase tracking-widest"><Sparkles size={11} /> Study smarter</p>
            <p className="text-amber-50 font-medium mt-0.5 truncate">{smart.title}</p>
            {smart.hint && <p className="text-stone-500 text-xs truncate">{smart.hint}</p>}
          </div>
          <ChevronRight size={18} className="text-indigo-400/60 group-hover:text-indigo-300 shrink-0" />
        </Link>

        {/* Leaderboard */}
        <div className="md:col-span-2 rounded-2xl bg-stone-900/70 border border-stone-800 p-4">
          <div className="flex items-center gap-2 mb-2"><Trophy size={13} className="text-amber-400" /><h2 className="text-stone-400 text-xs uppercase tracking-widest">This week</h2></div>
          <div className="flex flex-col gap-1.5">
            {people.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === 0 && people.length > 1 && p.week > 0 ? 'bg-indigo-900/20 border border-indigo-800/40' : 'bg-stone-950/60 border border-stone-800'}`}>
                <span className="w-5 text-center">{medals[i] ?? '·'}</span>
                <span className="text-amber-100 flex-1 text-sm">{p.name}</span>
                <span className="text-indigo-200/90 font-medium text-sm">{p.week.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </div>

        {/* Apple-style calendar */}
        <div className="md:col-span-2">
          <CalendarWidget assignments={(assignments ?? []) as Assignment[]} />
        </div>

        {/* Decks */}
        <div className="md:col-span-2 flex flex-col gap-3">
          {!decks?.length ? (
            <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-6 text-center text-stone-500 text-sm">No decks yet — make one and quiz each other.</div>
          ) : decks.map(d => {
            const count = (d.study_cards as unknown as { count: number }[])?.[0]?.count ?? 0
            const mine = bestQuiz(d.id, user.id)
            const theirs = partnerId ? bestQuiz(d.id, partnerId) : null
            return (
              <Link key={d.id} href={`/study/${d.id}`} className="group bg-stone-900/70 border border-stone-800 rounded-2xl p-4 hover:border-indigo-800/50 card-glow">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl text-amber-100 group-hover:text-indigo-300 transition-colors truncate">{d.title}</h3>
                  <span className="text-stone-500 text-xs shrink-0">{count} card{count !== 1 ? 's' : ''}</span>
                </div>
                {(mine || theirs) && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-stone-400">Your best <span className="text-indigo-200">{mine ? `${mine.correct}/${mine.total}` : '—'}</span></span>
                    {partnerId && <span className="text-stone-400">{firstName(partnerId)} <span className="text-indigo-200">{theirs ? `${theirs.correct}/${theirs.total}` : '—'}</span></span>}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
