import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { kindFromSlug } from '../board/engine'
import { getLatestGame, getRecord } from '../board/actions'
import BoardClient from '../board/board-client'

export default async function BoardGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kind = kindFromSlug(slug)
  if (!kind) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couples } = await supabase
    .from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1)
  const couple = couples?.[0]
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const [{ data: profiles }, game, record] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', [user.id, ...(partnerId ? [partnerId] : [])]),
    getLatestGame(kind),
    getRecord(kind),
  ])
  const nameOf = (id: string | null) =>
    (profiles ?? []).find(p => p.id === id)?.display_name?.split(' ')[0]

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <BoardClient
        kind={kind}
        initial={game}
        myId={user.id}
        myName={nameOf(user.id) ?? 'You'}
        partnerName={nameOf(partnerId) ?? 'your partner'}
        record={record}
      />
    </div>
  )
}
