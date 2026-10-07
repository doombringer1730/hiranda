import { redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import type { PresonProfile } from '../presence-cards'
import ChatClient from './chat-client'
import { getQuietPrefs } from '@/app/quiet-actions'

const PROFILE_FIELDS = 'id, display_name, avatar_url, username, status_text, accent_color, banner_url, bio, activity, activity_at'

export default async function ChatPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const [{ data: profiles }, quiet] = await Promise.all([
    ctx.supabase.from('profiles').select(PROFILE_FIELDS).in('id', [ctx.user.id, ctx.partnerId]),
    getQuietPrefs(),
  ])
  const find = (id: string) => (profiles ?? []).find(p => p.id === id) as PresonProfile | undefined
  const fallback = (id: string, name: string): PresonProfile => ({ id, display_name: name, avatar_url: null, username: null, status_text: null, accent_color: null, banner_url: null, bio: null, activity: null, activity_at: null })
  const since = ctx.couple.together_since as string | null
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const togetherDays = since ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000)) : null

  return (
    <ChatClient
      myId={ctx.user.id}
      coupleId={ctx.couple.id}
      me={find(ctx.user.id) ?? fallback(ctx.user.id, 'You')}
      partner={find(ctx.partnerId) ?? fallback(ctx.partnerId, 'Your partner')}
      togetherDays={togetherDays}
      quiet={quiet ?? { mine: null, partner: null }}
    />
  )
}
