'use server'

import { createClient } from '@/lib/supabase/server'
import { notifyPartner, myFirstName } from '@/lib/push'

export type TalkSession = {
  id: string
  started_by: string
  minutes: number
  started_at: string
  ended_at: string | null
  completed: boolean
}

export type TalkState = {
  coupleId: string
  // The server's clock when this was read, so countdowns on both phones
  // agree even if one phone's clock is off.
  serverNow: number
  sessions: TalkSession[] // last ~60 days, newest first
}

const FIELDS = 'id, started_by, minutes, started_at, ended_at, completed'

async function myCouple() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: couple } = await supabase
    .from('couple').select('id, user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1).maybeSingle()
  if (!couple?.user1_id || !couple.user2_id) return null
  return { supabase, user, couple }
}

export async function getTalkState(): Promise<TalkState | null> {
  const ctx = await myCouple()
  if (!ctx) return null
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data } = await ctx.supabase.from('talk_sessions').select(FIELDS)
    .eq('couple_id', ctx.couple.id).gte('started_at', since)
    .order('started_at', { ascending: false }).limit(200)
  return { coupleId: ctx.couple.id, serverNow: Date.now(), sessions: (data ?? []) as TalkSession[] }
}

const isRunning = (s: TalkSession, now: number) =>
  !s.ended_at && new Date(s.started_at).getTime() + s.minutes * 60_000 > now

export async function startTalk(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return { error: 'Pick between 1 and 180 minutes' }
  const ctx = await myCouple()
  if (!ctx) return { error: 'Talk time needs both of you' }

  // Already going (your partner may have just started one) — join it.
  const { data: latest } = await ctx.supabase.from('talk_sessions').select(FIELDS)
    .eq('couple_id', ctx.couple.id).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (latest && isRunning(latest as TalkSession, Date.now())) return { ok: true }

  const { error } = await ctx.supabase.from('talk_sessions')
    .insert({ couple_id: ctx.couple.id, started_by: ctx.user.id, minutes })
  if (error) return { error: 'Couldn’t start — try again' }

  notifyPartner(async () => ({
    title: `${await myFirstName()} started talk time 💬`,
    body: `${minutes} minutes, phones down — just you two.`,
    url: '/',
    tag: 'talk',
  }))
  return { ok: true }
}

// Add (or take off) a few minutes while it's running.
export async function stretchTalk(id: string, by: number) {
  if (!Number.isInteger(by) || Math.abs(by) > 60) return { error: 'Bad amount' }
  const ctx = await myCouple()
  if (!ctx) return { error: 'Not signed in' }
  const { data: s } = await ctx.supabase.from('talk_sessions').select(FIELDS).eq('id', id).maybeSingle()
  if (!s || !isRunning(s as TalkSession, Date.now())) return { error: 'That session already ended' }
  const minutes = Math.min(180, Math.max(1, s.minutes + by))
  await ctx.supabase.from('talk_sessions').update({ minutes }).eq('id', id).is('ended_at', null)
  return { ok: true }
}

// Ends a session. `finished` is true when the timer ran out on its own.
// Both phones may call this at the same moment; only the first one counts.
export async function endTalk(id: string, finished: boolean) {
  const ctx = await myCouple()
  if (!ctx) return { error: 'Not signed in' }
  const { data: s } = await ctx.supabase.from('talk_sessions').select(FIELDS).eq('id', id).maybeSingle()
  if (!s || s.ended_at) return { ok: true }
  const ran = Date.now() - new Date(s.started_at).getTime()
  // Ended early but past halfway still counts.
  const completed = finished || ran >= (s.minutes * 60_000) / 2
  await ctx.supabase.from('talk_sessions')
    .update({ ended_at: new Date().toISOString(), completed })
    .eq('id', id).is('ended_at', null)
  return { ok: true }
}
