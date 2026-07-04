import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActivePrompt } from './actions'
import GameClient from './game-client'
import { Gamepad2 } from 'lucide-react'

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

  const [questions, wyr, tot] = await Promise.all([
    getActivePrompt('question'),
    getActivePrompt('would_you_rather'),
    getActivePrompt('this_or_that'),
  ])

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
    { type: 'this_or_that' as const, label: 'This or That', shortLabel: 'This or That', initial: tot },
  ]

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Gamepad2 size={28} className="text-amber-700" />
        <h2 className="font-serif text-3xl text-amber-100">Games</h2>
      </div>

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
      />
    </div>
  )
}
