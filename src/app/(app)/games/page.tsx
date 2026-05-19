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

  const tabs = [
    { type: 'question' as const, label: 'Questions', initial: questions },
    { type: 'would_you_rather' as const, label: 'Would You Rather', initial: wyr },
    { type: 'this_or_that' as const, label: 'This or That', initial: tot },
  ]

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Gamepad2 size={28} className="text-amber-700" />
        <h2 className="font-serif text-3xl text-amber-100">Games</h2>
      </div>
      <GameClient
        tabs={tabs}
        partnerName={partnerProfile?.display_name ?? 'your partner'}
      />
    </div>
  )
}
