'use server'

import { coupleContext } from '@/lib/couple'
import { notifyPartner, myFirstName } from '@/lib/push'

export type Message = {
  id: string
  sender: string
  kind: 'text' | 'good_news' | 'urgent'
  body: string
  reaction: string | null
  read_at: string | null
  created_at: string
}

const FIELDS = 'id, sender, kind, body, reaction, read_at, created_at'
const PAGE = 120
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

// Newest PAGE messages (or the page before `before`), oldest first.
export async function getMessages(before?: string): Promise<{ coupleId: string; messages: Message[]; more: boolean } | null> {
  const ctx = await coupleContext()
  if (!ctx) return null
  let q = ctx.supabase.from('messages').select(FIELDS)
    .eq('couple_id', ctx.couple.id).order('created_at', { ascending: false }).limit(PAGE + 1)
  if (before) q = q.lt('created_at', before)
  const { data } = await q
  const rows = (data ?? []) as Message[]
  return { coupleId: ctx.couple.id, messages: rows.slice(0, PAGE).reverse(), more: rows.length > PAGE }
}

export async function sendMessage(body: string, kind: 'text' | 'good_news' | 'urgent' = 'text') {
  const text = body.trim()
  if (!text) return { error: 'Empty message' }
  if (text.length > 4000) return { error: 'That’s a bit long — try splitting it up' }
  if (kind !== 'text' && kind !== 'good_news' && kind !== 'urgent') return { error: 'Bad message type' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Chat needs both of you' }

  const { error } = await ctx.supabase.from('messages')
    .insert({ couple_id: ctx.couple.id, sender: ctx.user.id, kind, body: text })
  if (error) return { error: error.message.includes('urgent_limit') ? 'Urgent is limited to 3 a day — send it as a normal message instead.' : 'Couldn’t send — try again' }

  notifyPartner(async () => {
    const name = await myFirstName()
    return {
      title: kind === 'urgent' ? `🚨 Urgent from ${name}` : kind === 'good_news' ? `${name} has good news 🎉` : name,
      body: text.length > 140 ? text.slice(0, 137) + '…' : text,
      url: '/chat',
      tag: kind === 'urgent' ? 'chat-urgent' : 'chat',
      urgent: kind === 'urgent',
    }
  })
  return { ok: true }
}

// React to one of your partner's messages (null clears it).
export async function reactTo(id: string, reaction: string | null) {
  if (reaction !== null && !REACTIONS.includes(reaction)) return { error: 'Unknown reaction' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  await ctx.supabase.from('messages').update({ reaction }).eq('id', id).neq('sender', ctx.user.id)
  return { ok: true }
}

// Everything your partner sent is now seen.
export async function markRead() {
  const ctx = await coupleContext()
  if (!ctx) return
  await ctx.supabase.from('messages').update({ read_at: new Date().toISOString() })
    .eq('couple_id', ctx.couple.id).eq('sender', ctx.partnerId).is('read_at', null)
}

export async function unsend(id: string) {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  await ctx.supabase.from('messages').delete().eq('id', id).eq('sender', ctx.user.id)
  return { ok: true }
}

export async function unreadCount(): Promise<number> {
  const ctx = await coupleContext()
  if (!ctx) return 0
  const { count } = await ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
    .eq('couple_id', ctx.couple.id).eq('sender', ctx.partnerId).is('read_at', null)
  return count ?? 0
}
