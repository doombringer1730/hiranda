'use server'

import { coupleContext } from '@/lib/couple'
import { notifyPartner, myFirstName } from '@/lib/push'

export type Slip = { id: string; author: string; body: string | null; drawn_at: string | null; created_at: string }
export type JarState = { myId: string; partnerId: string; partnerName: string; slips: Slip[] }

const MAX_WAITING = 30 // per person, so the jar stays a jar

export async function getJar(): Promise<JarState | null> {
  const ctx = await coupleContext()
  if (!ctx) return null
  const [{ data }, { data: partner }] = await Promise.all([
    ctx.supabase.rpc('jar_slips_for', { p_jar: 'ours' }),
    ctx.supabase.from('profiles').select('display_name').eq('id', ctx.partnerId).maybeSingle(),
  ])
  return {
    myId: ctx.user.id,
    partnerId: ctx.partnerId,
    partnerName: partner?.display_name?.split(' ')[0] ?? 'your partner',
    slips: (data ?? []) as Slip[],
  }
}

export async function addSlip(body: string) {
  const text = body.trim()
  if (!text) return { error: 'Write something first' }
  if (text.length > 200) return { error: 'Keep it short — it has to fold up small' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { count } = await ctx.supabase.from('jar_slips').select('id', { count: 'exact', head: true })
    .eq('couple_id', ctx.couple.id).eq('jar', 'ours').eq('author', ctx.user.id).is('drawn_at', null)
  if ((count ?? 0) >= MAX_WAITING) return { error: `The jar’s full on your side (${MAX_WAITING}) — draw a few first` }
  const { error } = await ctx.supabase.from('jar_slips').insert({ couple_id: ctx.couple.id, jar: 'ours', author: ctx.user.id, body: text })
  if (error) return { error: 'Couldn’t add it — try again' }
  return { ok: true }
}

export async function removeSlip(id: string) {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  await ctx.supabase.from('jar_slips').delete().eq('id', id).eq('author', ctx.user.id).is('drawn_at', null)
  return { ok: true }
}

// One slip from each of you, at the same moment.
export async function drawPair(): Promise<{ error: string } | { ok: true; pair: { author: string; body: string }[] }> {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data } = await ctx.supabase.rpc('draw_from_jar')
  const pair = (data ?? []) as { id: string; author: string; body: string }[]
  if (pair.length < 2) return { error: 'You both need at least one slip in the jar' }
  notifyPartner(async () => ({
    title: `${await myFirstName()} drew from the jar 🫙`,
    body: pair.map(p => `“${p.body}”`).join(' + '),
    url: '/games/jar',
    tag: 'jar',
  }))
  return { ok: true, pair: pair.map(p => ({ author: p.author, body: p.body })) }
}
