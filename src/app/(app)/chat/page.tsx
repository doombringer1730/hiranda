import { redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import ChatClient from './chat-client'

export default async function ChatPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const { data: profiles } = await ctx.supabase.from('profiles')
    .select('id, display_name, avatar_url, accent_color').in('id', [ctx.user.id, ctx.partnerId])
  const partner = profiles?.find(p => p.id === ctx.partnerId)

  return (
    <ChatClient
      myId={ctx.user.id}
      partner={{
        name: partner?.display_name?.split(' ')[0] ?? 'Your partner',
        avatar: partner?.avatar_url ?? null,
        accent: partner?.accent_color ?? null,
      }}
    />
  )
}
