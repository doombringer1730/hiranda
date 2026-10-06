'use server'

import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { notifyPartner, myFirstName } from '@/lib/push'

export type Envelope = {
  id: string
  author: string
  recipient: string
  open_when: string | null
  title: string | null
  unlock_at: string | null
  opened_at: string | null
  created_at: string
}

export type ThanksSlip = { id: string; author: string; body: string | null; created_at: string }

export type LettersState = {
  myId: string
  partnerName: string
  received: Envelope[]
  sent: Envelope[]
  thanks: { openOn: string | null; suggestedOpenOn: string | null; slips: ThanksSlip[] }
}

const ENVELOPE = 'id, author, recipient, open_when, title, unlock_at, opened_at, created_at'

// The next anniversary of `since` (YYYY-MM-DD), as YYYY-MM-DD.
function nextAnniversary(since: string | null) {
  if (!since) return null
  const [, m, d] = since.split('-').map(Number)
  const now = new Date()
  let y = now.getFullYear()
  const today = `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let next = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (next < today) { y++; next = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
  return next
}

export async function getLetters(): Promise<LettersState | null> {
  const ctx = await coupleContext()
  if (!ctx) return null
  const [{ data: letters }, { data: slips }, { data: settings }, { data: partner }] = await Promise.all([
    ctx.supabase.from('letters').select(ENVELOPE).eq('couple_id', ctx.couple.id).order('created_at', { ascending: false }),
    ctx.supabase.rpc('jar_slips_for', { p_jar: 'thanks' }),
    ctx.supabase.from('jar_settings').select('thanks_open_on').eq('couple_id', ctx.couple.id).maybeSingle(),
    ctx.supabase.from('profiles').select('display_name').eq('id', ctx.partnerId).maybeSingle(),
  ])
  const all = (letters ?? []) as Envelope[]
  return {
    myId: ctx.user.id,
    partnerName: partner?.display_name?.split(' ')[0] ?? 'your partner',
    received: all.filter(l => l.recipient === ctx.user.id),
    sent: all.filter(l => l.author === ctx.user.id),
    thanks: {
      openOn: settings?.thanks_open_on ?? null,
      suggestedOpenOn: nextAnniversary(ctx.couple.together_since ?? null),
      slips: (slips ?? []) as ThanksSlip[],
    },
  }
}

export async function writeLetter(input: { openWhen?: string; title?: string; body: string; unlockAt?: string }) {
  const body = input.body?.trim()
  if (!body) return { error: 'Write a little something first' }
  if (body.length > 20000) return { error: 'That letter is too long to fit in the envelope' }
  const openWhen = input.openWhen?.trim().slice(0, 80) || null
  const title = input.title?.trim().slice(0, 120) || null
  let unlockAt: string | null = null
  if (input.unlockAt) {
    const d = new Date(input.unlockAt)
    if (Number.isNaN(d.getTime())) return { error: 'That date doesn’t look right' }
    unlockAt = d.toISOString()
  }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Letters need both of you' }
  const { error } = await ctx.supabase.from('letters').insert({
    couple_id: ctx.couple.id, author: ctx.user.id, recipient: ctx.partnerId,
    open_when: openWhen, title, body, unlock_at: unlockAt,
  })
  if (error) return { error: 'Couldn’t seal it — try again' }

  notifyPartner(async () => ({
    title: `${await myFirstName()} wrote you a letter 💌`,
    body: openWhen ? `Open when ${openWhen.replace(/^open when\s*/i, '')}` : unlockAt ? `Sealed until ${new Date(unlockAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : 'It’s waiting for you.',
    url: '/letters',
    tag: 'letter',
  }))
  revalidatePath('/letters')
  return { ok: true }
}

// Returns the letter's body if you're allowed to read it (and marks it opened).
export async function openLetter(id: string): Promise<{ body: string; opened_at: string | null } | null> {
  const ctx = await coupleContext()
  if (!ctx) return null
  const { data } = await ctx.supabase.rpc('read_letter', { p_id: id })
  const row = (data as { body: string; opened_at: string | null }[] | null)?.[0]
  return row ?? null
}

export async function takeBackLetter(id: string) {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  await ctx.supabase.from('letters').delete().eq('id', id).eq('author', ctx.user.id)
  revalidatePath('/letters')
  return { ok: true }
}

// The appreciation jar — quiet on purpose: no notification, just a jar that fills.
export async function dropThanks(body: string) {
  const text = body.trim()
  if (!text) return { error: 'Write a little thank-you first' }
  if (text.length > 500) return { error: 'Keep it to a short note' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  // First note ever: the jar opens on your next anniversary (or in three
  // months if you haven't set when you got together). Changeable any time.
  const { data: settings } = await ctx.supabase.from('jar_settings').select('thanks_open_on').eq('couple_id', ctx.couple.id).maybeSingle()
  if (!settings?.thanks_open_on) {
    const fallback = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
    await ctx.supabase.from('jar_settings').upsert({ couple_id: ctx.couple.id, thanks_open_on: nextAnniversary(ctx.couple.together_since ?? null) ?? fallback })
  }
  const { error } = await ctx.supabase.from('jar_slips').insert({ couple_id: ctx.couple.id, jar: 'thanks', author: ctx.user.id, body: text })
  if (error) return { error: 'Couldn’t drop it in — try again' }
  return { ok: true }
}

export async function setThanksOpenOn(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Pick a date' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  await ctx.supabase.from('jar_settings').upsert({ couple_id: ctx.couple.id, thanks_open_on: date })
  return { ok: true }
}
