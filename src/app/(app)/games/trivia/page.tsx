import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TriviaClient, { type Trivia } from './trivia-client'

export default async function TriviaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couples } = await supabase
    .from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1)
  const couple = couples?.[0]
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const [{ data: questions }, { data: partner }] = await Promise.all([
    supabase.from('trivia_questions')
      .select('id, author, question, options, correct, guess, created_at')
      .order('created_at', { ascending: false }),
    partnerId
      ? supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <TriviaClient
        myId={user.id}
        partnerName={partner?.display_name?.split(' ')[0] ?? 'your partner'}
        // Don't ship the answer to a question you haven't guessed yet.
        questions={((questions ?? []) as Trivia[]).map(q =>
          q.author !== user.id && q.guess === null ? { ...q, correct: -1 } : q
        )}
      />
    </div>
  )
}
