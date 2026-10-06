import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActivePrompt } from './actions'
import { getLatestGames } from './board/actions'
import { GAMES, type Kind } from './board/engine'
import GameClient from './game-client'
import { ChevronRight } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { Jar, SLIP_ME, SLIP_PARTNER } from '@/components/jar'
import { Scribble } from '@/components/handmade'
import WhyItWorks from '@/components/why-it-works'

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

  const [questions, wyr, tot, likely, latest, { count: triviaWaiting }, { data: jarSlips }] = await Promise.all([
    getActivePrompt('question'),
    getActivePrompt('would_you_rather'),
    getActivePrompt('this_or_that'),
    getActivePrompt('most_likely'),
    getLatestGames(),
    partnerId
      ? supabase.from('trivia_questions').select('id', { count: 'exact', head: true }).eq('author', partnerId).is('guess', null)
      : Promise.resolve({ count: 0 }),
    supabase.from('jar_slips').select('author').eq('jar', 'ours').is('drawn_at', null),
  ])
  const jarMine = (jarSlips ?? []).filter(s => s.author === user.id).length
  const jarTheirs = (jarSlips ?? []).length - jarMine

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

  const partnerFirst = partnerProfile?.display_name?.split(' ')[0] ?? 'your partner'

  // Every game gets its own box colour — a shelf of games, not a list.
  const games: Tile[] = [
    { href: '/games/daring', name: 'Daring Questions', blurb: 'Deep, flirty, silly — or take the dare.', emoji: '💋', color: '#d9466f', badge: null },
    { href: '/games/trivia', name: 'Trivia About Us', blurb: 'How well do you really know each other?', emoji: '🧠', color: '#4f6fd8', badge: triviaWaiting ? `${triviaWaiting} to answer` : null },
    { href: `/games/${GAMES.uno.slug}`, name: GAMES.uno.name, blurb: GAMES.uno.blurb, emoji: GAMES.uno.emoji, color: '#e0a21a', badge: liveBadge('uno') },
    { href: `/games/${GAMES.connect_four.slug}`, name: GAMES.connect_four.name, blurb: GAMES.connect_four.blurb, emoji: GAMES.connect_four.emoji, color: '#d8523b', badge: liveBadge('connect_four') },
    { href: `/games/${GAMES.tic_tac_toe.slug}`, name: GAMES.tic_tac_toe.name, blurb: GAMES.tic_tac_toe.blurb, emoji: GAMES.tic_tac_toe.emoji, color: '#3a9b7a', badge: liveBadge('tic_tac_toe') },
    { href: `/games/${GAMES.dots_and_boxes.slug}`, name: GAMES.dots_and_boxes.name, blurb: GAMES.dots_and_boxes.blurb, emoji: GAMES.dots_and_boxes.emoji, color: '#8a5cc7', badge: liveBadge('dots_and_boxes') },
  ]
  // Open loops first: anything waiting on you leads the shelf.
  const yourMove = games.filter(g => g.badge === 'Your move' || g.badge?.endsWith('to answer'))
  const shelf = [...yourMove, ...games.filter(g => !yourMove.includes(g))]

  return (
    <div className="px-4 pt-6 max-w-2xl md:max-w-4xl mx-auto pb-12">
      <PageHeader eyebrow="Game night" title="Games" />
      {stats ? (
        <p className="relative inline-block font-hand text-[23px] text-amber-200 mt-3 mb-7">
          {stats.together} answered together{stats.comparable > 0 && <> · you match {Math.round((stats.matches / stats.comparable) * 100)}%</>}{stats.streak > 1 && <> · {stats.streak} in a row 🔥</>}
          <Scribble kind="underline" className="absolute left-0 -bottom-1.5 h-2 w-full text-amber-500/60" />
        </p>
      ) : (
        <p className="font-hand text-[23px] text-stone-400 mt-3 mb-7">pick something, {partnerFirst} is waiting.</p>
      )}

      {/* Featured: the jar */}
      <Link href="/games/jar" className="group tile p-5 md:p-6 mb-5 flex items-center gap-5 overflow-hidden animate-rise">
        <div className="shrink-0 text-stone-300 transition-transform duration-500 group-hover:-rotate-6">
          <Jar slips={[...Array(jarMine).fill(SLIP_ME), ...Array(jarTheirs).fill(SLIP_PARTNER)]} size={82} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-amber-300/90 text-[11px] uppercase tracking-[0.22em]">New · The Jar</p>
          <p className="font-serif text-[26px] leading-tight text-amber-50 mt-1">Write ten. Pull one from each of you.</p>
          <p className="text-stone-400 text-sm mt-1">{jarMine + jarTheirs > 0 ? `${jarMine} from you · ${jarTheirs} from ${partnerFirst} waiting` : 'Fill it with things you’d love to do together.'}</p>
        </div>
        <ChevronRight size={18} className="text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
      </Link>

      {/* The shelf */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {shelf.map((g, i) => <GameBox key={g.href} g={g} i={i} />)}
      </div>

      <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3 mt-12">Quick questions</h2>
      <GameClient
        tabs={tabs}
        partnerName={partnerProfile?.display_name ?? 'your partner'}
        myId={user.id}
        partnerId={partnerId}
      />

      <WhyItWorks className="mt-10" source="Aron et al., 2000">
        Playing and trying new things together — not just spending time together — is what lifted couples’ relationship quality in the lab.
      </WhyItWorks>
    </div>
  )
}

type Tile = { href: string; name: string; blurb: string; emoji: string; color: string; badge: string | null }

// A game box: a coloured lid with a big tilted emoji, the name underneath.
function GameBox({ g, i }: { g: Tile; i: number }) {
  const waiting = g.badge === 'Your move' || g.badge?.endsWith('to answer')
  return (
    <Link href={g.href} className="group tile flex flex-col overflow-hidden animate-rise" style={{ '--i': i + 1 } as React.CSSProperties}>
      <div className="relative h-24 md:h-28 grid place-items-center overflow-hidden" style={{ background: `radial-gradient(120% 120% at 30% 0%, ${g.color}, color-mix(in oklab, ${g.color} 55%, black))` }}>
        <span aria-hidden className="absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(45deg,white_0_2px,transparent_2px_12px)]" />
        <span className="relative text-[44px] drop-shadow-[0_6px_10px_rgb(0_0_0/0.35)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" style={{ rotate: `${i % 2 ? 8 : -8}deg` }}>{g.emoji}</span>
        {g.badge && (
          <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${waiting ? 'bg-white text-stone-950 animate-pop' : 'bg-black/30 text-white/85'}`}>{g.badge}</span>
        )}
      </div>
      <div className="p-3.5">
        <p className="text-amber-50 text-[15px] font-semibold leading-tight">{g.name}</p>
        <p className="text-stone-400 text-xs mt-1 leading-snug line-clamp-2">{g.blurb}</p>
      </div>
    </Link>
  )
}
