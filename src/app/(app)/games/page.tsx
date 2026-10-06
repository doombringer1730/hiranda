import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePrompt } from './actions'
import { getLatestGames } from './board/actions'
import { GAMES, type Kind } from './board/engine'
import GameClient from './game-client'
import { ChevronRight } from 'lucide-react'
import PageHeader from '@/components/page-header'

export default async function GamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  const { data: partnerProfile } = partnerId
    ? await supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle()
    : { data: null }

  const [questions, wyr, tot, likely, latest, { count: triviaWaiting }] = await Promise.all([
    getActivePrompt('question'),
    getActivePrompt('would_you_rather'),
    getActivePrompt('this_or_that'),
    getActivePrompt('most_likely'),
    getLatestGames(),
    partnerId
      ? supabase.from('trivia_questions').select('id', { count: 'exact', head: true }).eq('author', partnerId).is('guess', null)
      : Promise.resolve({ count: 0 }),
  ])

  // Badge for a live game tile: whose move it is, or nothing.
  const liveBadge = (kind: Kind) => {
    const g = latest[kind]
    if (!g || g.status !== 'active') return null
    return g.turn === user.id ? 'Your move' : 'Their move'
  }

  // ── Match stats: how often the two of you picked the same answer ──────────
  let stats: { together: number; matches: number; comparable: number; streak: number } | null = null
  if (partnerId) {
    const { data: allResponses } = await supabase
      .from('prompt_responses')
      .select('prompt_id, user_id, response, responded_at, prompts!inner(type)')
      .in('user_id', [user.id, partnerId])

    type Row = { prompt_id: string; user_id: string; response: string; responded_at: string; prompts: { type: string } }
    const byPrompt = new Map<string, Row[]>()
    for (const r of (allResponses ?? []) as unknown as Row[]) {
      const list = byPrompt.get(r.prompt_id) ?? []
      list.push(r)
      byPrompt.set(r.prompt_id, list)
    }

    let together = 0
    let matches = 0
    let comparable = 0
    // Chronological match/miss sequence for option-based prompts, for the streak.
    const seq: { at: string; matched: boolean }[] = []
    for (const rows of byPrompt.values()) {
      const mine = rows.find(r => r.user_id === user.id)
      const theirs = rows.find(r => r.user_id === partnerId)
      if (!mine || !theirs) continue
      together++
      // Free-text questions can't "match"; only compare option-based prompts.
      if (rows[0].prompts.type === 'question') continue
      comparable++
      const matched = mine.response === theirs.response
      if (matched) matches++
      seq.push({ at: mine.responded_at > theirs.responded_at ? mine.responded_at : theirs.responded_at, matched })
    }
    seq.sort((a, b) => a.at.localeCompare(b.at))
    let streak = 0
    for (let i = seq.length - 1; i >= 0 && seq[i].matched; i--) streak++

    if (together > 0) stats = { together, matches, comparable, streak }
  }

  const tabs = [
    { type: 'question' as const, label: 'Questions', initial: questions },
    { type: 'would_you_rather' as const, label: 'Would You Rather', shortLabel: 'WYR', initial: wyr },
    { type: 'this_or_that' as const, label: 'This or That', shortLabel: 'This/That', initial: tot },
    { type: 'most_likely' as const, label: 'Most Likely To', shortLabel: 'Most Likely', initial: likely },
  ]

  const cardGames = [
    { href: '/games/daring', name: 'Daring Questions', blurb: 'Deep, flirty, silly — or take the dare.', emoji: '💋', badge: null },
    { href: '/games/trivia', name: 'Trivia About Us', blurb: 'How well do you really know each other?', emoji: '🧠', badge: triviaWaiting ? `${triviaWaiting} to answer` : null },
    { href: `/games/${GAMES.uno.slug}`, name: GAMES.uno.name, blurb: GAMES.uno.blurb, emoji: GAMES.uno.emoji, badge: liveBadge('uno') },
  ]
  const boardGames = (['tic_tac_toe', 'connect_four', 'dots_and_boxes'] as const).map(kind => ({
    href: `/games/${GAMES[kind].slug}`, name: GAMES[kind].name, blurb: GAMES[kind].blurb, emoji: GAMES[kind].emoji, badge: liveBadge(kind),
  }))

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <PageHeader eyebrow="Game night" title="Games" className="mb-8" />

      <GameSection title="Card games" games={cardGames} />
      <GameSection title="Board games" games={boardGames} />

      <h2 className="flex items-center gap-3 text-stone-500 text-[10px] uppercase tracking-[0.25em] mb-3 mt-10">Daily prompts<span className="rule-fade flex-1" /></h2>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-center">
            <p className="font-serif text-2xl text-amber-100">{stats.together}</p>
            <p className="text-stone-500 text-xs mt-1">answered together</p>
          </div>
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-center">
            <p className="font-serif text-2xl text-amber-100">
              {stats.comparable > 0 ? `${Math.round((stats.matches / stats.comparable) * 100)}%` : '—'}
            </p>
            <p className="text-stone-500 text-xs mt-1">match rate</p>
          </div>
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-center">
            <p className="font-serif text-2xl text-amber-100">{stats.streak > 0 ? `${stats.streak} 🔥` : '0'}</p>
            <p className="text-stone-500 text-xs mt-1">match streak</p>
          </div>
        </div>
      )}

      <GameClient
        tabs={tabs}
        partnerName={partnerProfile?.display_name ?? 'your partner'}
        myId={user.id}
        partnerId={partnerId}
      />
    </div>
  )
}

type Tile = { href: string; name: string; blurb: string; emoji: string; badge: string | null }

function GameSection({ title, games }: { title: string; games: Tile[] }) {
  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-3 text-stone-500 text-[10px] uppercase tracking-[0.25em] mb-3">{title}<span className="rule-fade flex-1" /></h2>
      <div className="flex flex-col gap-2.5">
        {games.map(g => (
          <Link key={g.href} href={g.href} className="group flex items-center gap-4 bg-stone-900/70 border border-stone-800 rounded-2xl p-4 hover:border-amber-800/50 card-glow">
            <span className="h-11 w-11 shrink-0 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-center text-lg text-amber-300">{g.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-amber-50 text-sm font-medium flex items-center gap-2">
                {g.name}
                {g.badge && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${g.badge === 'Their move' ? 'bg-stone-800 text-stone-400' : 'bg-amber-900/50 text-amber-300'}`}>{g.badge}</span>
                )}
              </p>
              <p className="text-stone-500 text-xs truncate mt-0.5">{g.blurb}</p>
            </div>
            <ChevronRight size={16} className="text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  )
}
