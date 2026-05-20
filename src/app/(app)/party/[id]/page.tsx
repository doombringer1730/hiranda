import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import PartyClient from './party-client'

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('watch_sessions')
    .select('id, title, platform, party_url, thumbnail_url, source_type')
    .eq('id', id)
    .single()

  if (!session) notFound()
  if (session.source_type !== 'party') redirect(`/watch/${id}`)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profiles } = await supabase.from('profiles').select('id, display_name')
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name]))

  return (
    <PartyClient
      sessionId={id}
      title={session.title}
      platform={session.platform ?? null}
      thumbnailUrl={session.thumbnail_url ?? null}
      userId={user!.id}
      profileMap={profileMap}
    />
  )
}
