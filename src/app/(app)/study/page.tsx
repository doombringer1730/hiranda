import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, GraduationCap, Trophy, Layers, Brain, RotateCcw, Sparkles, ChevronRight } from 'lucide-react'
import AssignmentsPanel, { type Assignment } from './assignments-panel'

type Attempt = { user_id: string; deck_id: string | null; mode: string; correct: number; total: number; xp: number; created_at: string }

export default async function StudyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle()
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: profiles }, { data: decks }, { data: attempts }, { data: assignments }, { data: progress }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', [user.id, ...(partnerId ? [partnerId] : [])]),
    supabase.from('study_decks').select('id, title, study_cards(count)').order('created_at', { ascending: false }),
    supabase.from('study_attempts').select('user_id, deck_id, mode, correct, total, xp, created_at'),
    supabase.from('assignments').select('id, title, due_date, turned_in').order('due_date'),
    supabase.from('study_progress').select('due_at').eq('user_id', user.id),
  ])

  // Cards due across all decks (spaced repetition): total cards minus those
  // scheduled for a future day. New/unseen cards count as due.
  const totalCards = (decks ?? []).reduce((s, d) => s + ((d.study_cards as unknown as { count: number }[])?.[0]?.count ?? 0), 0)
  const notDue = (progress ?? []).filter(p => p.due_at > today).length
  const dueCount = Math.max(0, totalCards - notDue)
  const firstDeckId = (decks ?? [])[0]?.id

  const nameOf = new Map((profiles ?? []).map(p => [p.id, p.display_name.split(' ')[0]]))
  const weekAgo = Date.now() - 7 * 86_400_000
  const xp = (uid: string, weekly = false) => (attempts ?? [] as Attempt[])
    .filter(a => a.user_id === uid && (!weekly || new Date(a.created_at).getTime() >= weekAgo))
    .reduce((s, a) => s + a.xp, 0)

  // Leaderboard rows sorted by weekly XP.
  const people = [user.id, ...(partnerId ? [partnerId] : [])]
    .map(id => ({ id, name: id === user.id ? 'You' : (nameOf.get(id) ?? 'Partner'), week: xp(id, true), total: xp(id) }))
    .sort((a, b) => b.week - a.week)

  // Best quiz score per deck per person.
  const bestQuiz = (deckId: string, uid: string) => {
    const runs = (attempts ?? [] as Attempt[]).filter(a => a.deck_id === deckId && a.user_id === uid && a.mode === 'quiz' && a.total > 0)
    if (!runs.length) return null
    return runs.reduce((best, a) => (a.correct / a.total > best.correct / best.total ? a : best))
  }

  const medals = ['🥇', '🥈']

  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl mx-auto flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap size={22} className="text-amber-500" />
          <h1 className="font-serif text-3xl text-amber-100">Study</h1>
        </div>
        <Link href="/study/new" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> New deck
        </Link>
      </header>

      {/* Study smarter — coaches the research-optimal next action */}
      {(() => {
        const s = totalCards === 0
          ? { href: '/study/new', icon: Plus, title: 'Create your first deck', hint: 'Add cards, then quiz each other for XP' }
          : dueCount > 0
            ? { href: '/study/review', icon: RotateCcw, title: `Review ${dueCount} card${dueCount !== 1 ? 's' : ''} due`, hint: 'Spaced repetition — the biggest retention win' }
            : firstDeckId
              ? { href: `/study/${firstDeckId}`, icon: Brain, title: 'Learn a deck', hint: 'Active recall beats rereading, every time' }
              : { href: '/study/new', icon: Plus, title: 'Create a deck', hint: '' }
        const Icon = s.icon
        return (
          <Link href={s.href} className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-950/70 to-stone-900 border border-indigo-800/50 p-4 hover:border-indigo-600/70 transition-colors">
            <span className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-700/50 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-indigo-300" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-indigo-300/80 text-[10px] uppercase tracking-widest"><Sparkles size={11} /> Study smarter</p>
              <p className="text-amber-50 font-medium mt-0.5 truncate">{s.title}</p>
              {s.hint && <p className="text-stone-500 text-xs truncate">{s.hint}</p>}
            </div>
            <ChevronRight size={18} className="text-indigo-400/60 group-hover:text-indigo-300 transition-colors shrink-0" />
          </Link>
        )
      })()}

      {/* Assignments calendar */}
      <AssignmentsPanel assignments={(assignments ?? []) as Assignment[]} />

      {/* Competitive XP leaderboard */}
      <section className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={14} className="text-amber-500" />
          <h2 className="text-stone-400 text-xs uppercase tracking-widest">This week</h2>
        </div>
        <div className="flex flex-col gap-2">
          {people.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === 0 && people.length > 1 && p.week > 0 ? 'bg-amber-900/20 border border-amber-800/40' : 'bg-stone-950/60 border border-stone-800'}`}>
              <span className="text-lg w-6 text-center">{medals[i] ?? '·'}</span>
              <span className="text-amber-100 flex-1">{p.name}</span>
              <span className="text-amber-200/90 font-medium">{p.week.toLocaleString()} XP</span>
              <span className="text-stone-600 text-xs w-16 text-right">{p.total.toLocaleString()} all-time</span>
            </div>
          ))}
        </div>
        {people.length > 1 && people[0].week === people[1].week && (
          <p className="text-stone-500 text-xs text-center mt-2">Dead even — win a round to pull ahead.</p>
        )}
      </section>

      {/* Decks */}
      {!decks?.length ? (
        <div className="text-center py-20">
          <Layers size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No decks yet. Make one and quiz each other.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {decks.map(d => {
            const count = (d.study_cards as unknown as { count: number }[])?.[0]?.count ?? 0
            const mine = bestQuiz(d.id, user.id)
            const theirs = partnerId ? bestQuiz(d.id, partnerId) : null
            return (
              <Link key={d.id} href={`/study/${d.id}`}
                className="group bg-stone-900/70 border border-stone-800 rounded-2xl p-4 hover:border-amber-800/50 card-glow">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl text-amber-100 group-hover:text-amber-300 transition-colors truncate">{d.title}</h3>
                  <span className="text-stone-500 text-xs shrink-0">{count} card{count !== 1 ? 's' : ''}</span>
                </div>
                {(mine || theirs) && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-stone-400">Your best <span className="text-amber-200">{mine ? `${mine.correct}/${mine.total}` : '—'}</span></span>
                    {partnerId && (
                      <span className="text-stone-400">{nameOf.get(partnerId)} <span className="text-amber-200">{theirs ? `${theirs.correct}/${theirs.total}` : '—'}</span></span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
