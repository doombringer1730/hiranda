import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DeckClient from './deck-client'

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deck } = await supabase.from('study_decks').select('id, title, description').eq('id', id).maybeSingle()
  if (!deck) notFound()

  const { data: couple } = await supabase
    .from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle()
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const [{ data: cards }, { data: attempts }, { data: progress }, { data: profiles }] = await Promise.all([
    supabase.from('study_cards').select('id, term, definition, position').eq('deck_id', id).order('position'),
    supabase.from('study_attempts').select('user_id, mode, correct, total, xp').eq('deck_id', id),
    supabase.from('study_progress').select('card_id, due_at').eq('user_id', user.id),
    supabase.from('profiles').select('id, display_name').in('id', partnerId ? [partnerId] : ['00000000-0000-0000-0000-000000000000']),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const progMap = new Map((progress ?? []).map(p => [p.card_id, p.due_at]))
  const dueCount = (cards ?? []).filter(c => {
    const due = progMap.get(c.id)
    return !due || due <= today
  }).length

  const best = (uid: string) => {
    const runs = (attempts ?? []).filter(a => a.user_id === uid && a.mode === 'quiz' && a.total > 0)
    if (!runs.length) return null
    const b = runs.reduce((x, a) => (a.correct / a.total > x.correct / x.total ? a : x))
    return { correct: b.correct, total: b.total }
  }

  return (
    <DeckClient
      deck={deck}
      cards={cards ?? []}
      dueCount={dueCount}
      myBest={best(user.id)}
      partnerBest={partnerId ? best(partnerId) : null}
      partnerName={(profiles ?? [])[0]?.display_name?.split(' ')[0] ?? null}
    />
  )
}
