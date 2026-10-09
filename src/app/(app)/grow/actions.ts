'use server'

import { hasPlus } from '@/lib/plus'
import { isPlusUnit } from '@/lib/plus-config'

import { creditFinishedCoupon } from '@/lib/coupon-credit'
import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { notifyPartner, myFirstName } from '@/lib/push'
import { lessonByKey, milestoneByKey, PATH } from '@/lib/path'

// ── Milestones ──

// Stamp anything newly reached (the database counts and decides). Each new
// stamp gives you both a coupon; your partner hears about it once.
export async function awardMilestones(): Promise<string[]> {
  const ctx = await coupleContext()
  if (!ctx) return []
  const { data } = await ctx.supabase.rpc('award_milestones')
  const keys = ((data ?? []) as { key: string }[]).map(r => r.key)
  if (keys.length) {
    const first = milestoneByKey(keys[0])
    notifyPartner({
      title: `New stamp in your passport ${first?.emoji ?? '🎟️'}`,
      body: `${first?.title ?? 'A milestone'} — you both earned a coupon.`,
      url: '/grow/coupons',
      tag: 'milestone',
    })
  }
  return keys
}

// ── Path ──

export async function completeLesson(key: string, note: string) {
  const lesson = lessonByKey(key)
  if (!lesson) return { error: 'Unknown lesson' }
  if (isPlusUnit(PATH.indexOf(lesson.unit)) && !(await hasPlus())) return { error: 'This unit comes with Hiranda Plus.' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const text = note.trim().slice(0, 1000) || null
  const { data: already } = await ctx.supabase.from('lesson_progress').select('lesson_key')
    .eq('user_id', ctx.user.id).eq('lesson_key', key).maybeSingle()
  if (already) {
    // Already done — just update the note.
    await ctx.supabase.from('lesson_progress').update({ note: text }).eq('user_id', ctx.user.id).eq('lesson_key', key)
    return { ok: true, together: false, stamped: [] as string[], updated: true }
  }
  const { error } = await ctx.supabase.from('lesson_progress')
    .insert({ couple_id: ctx.couple.id, user_id: ctx.user.id, lesson_key: key, note: text })
  if (error) return { error: 'Couldn’t save — try again' }
  const { data: partnerDone } = await ctx.supabase.from('lesson_progress').select('user_id')
    .eq('lesson_key', key).eq('user_id', ctx.partnerId).maybeSingle()
  notifyPartner(async () => ({
    title: partnerDone ? `You finished “${lesson.title}” together 🎉` : `${await myFirstName()} finished “${lesson.title}”`,
    body: partnerDone ? 'Another step on your path.' : 'Your turn whenever you’re ready — no rush.',
    url: `/grow/lesson/${key}`,
    tag: `lesson-${key}`,
  }))
  const stamped = await awardMilestones()
  revalidatePath('/grow')
  return { ok: true, together: !!partnerDone, stamped }
}

// ── Coupons ──

export async function revealCoupon(id: string) {
  const ctx = await coupleContext()
  if (!ctx) return
  await ctx.supabase.from('coupons').update({ revealed_at: new Date().toISOString() })
    .eq('id', id).eq('bought_by', ctx.user.id).is('revealed_at', null)
}

export async function spendCoupon(id: string) {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data: c } = await ctx.supabase.from('coupons').select('title, emoji')
    .eq('id', id).eq('bought_by', ctx.user.id).eq('redeemed', false).maybeSingle()
  if (!c) return { error: 'That one’s already used' }
  await ctx.supabase.from('coupons').update({ redeemed: true, redeemed_at: new Date().toISOString(), revealed_at: new Date().toISOString() })
    .eq('id', id).eq('bought_by', ctx.user.id)
  notifyPartner(async () => ({
    title: `${await myFirstName()} is using a coupon ${c.emoji ?? '🎟️'}`,
    body: c.title,
    url: '/grow/coupons',
    tag: `coupon-${id}`,
  }))
  revalidatePath('/grow/coupons')
  return { ok: true }
}

// Your partner used a coupon on you — mark it done.
export async function markCouponDone(id: string) {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data: done } = await ctx.supabase.from('coupons').update({ done_at: new Date().toISOString() })
    .eq('id', id).eq('bought_by', ctx.partnerId).eq('redeemed', true).is('done_at', null).select('id')
  // A finished coupon takes a little off your next Plus renewal (Stripe only).
  const credited = done?.length ? await creditFinishedCoupon(ctx.couple.id, id) : 0
  revalidatePath('/grow/coupons')
  return { ok: true, credited }
}

export async function giveCoupon(title: string, emoji: string) {
  const t = title.trim()
  if (!t || t.length > 80) return { error: 'Keep it to a short line' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data: id, error } = await ctx.supabase.rpc('give_coupon', { p_title: t, p_emoji: emoji })
  if (error || !id) return { error: 'Couldn’t give it — try again' }
  notifyPartner(async () => ({
    title: `${await myFirstName()} gave you a coupon 🎟️`,
    body: 'Open your coupon book to see it.',
    url: '/grow/coupons',
    tag: 'coupon-gift',
  }))
  revalidatePath('/grow/coupons')
  return { ok: true }
}

// ── Love Map review (spaced repetition over answers you've both revealed) ──

export type ReviewCard = {
  promptId: string
  type: 'question' | 'would_you_rather' | 'this_or_that' | 'most_likely'
  text: string
  options: { value: string; label: string }[] | null // null → free text, self-graded
  answer: string // their answer (display text)
  answerValue: string
}

const BOX_DAYS = [1, 2, 4, 7, 14, 30, 60]
const DECK = 8

export async function getReviewDeck(): Promise<{ partnerName: string; cards: ReviewCard[]; dueTotal: number } | null> {
  const ctx = await coupleContext()
  if (!ctx) return null
  const [{ data: theirs }, { data: mine }, { data: boxes }, { data: partner }] = await Promise.all([
    ctx.supabase.from('prompt_responses').select('prompt_id, response, prompts!inner(id, type, text, option_a, option_b)').eq('user_id', ctx.partnerId),
    ctx.supabase.from('prompt_responses').select('prompt_id').eq('user_id', ctx.user.id),
    ctx.supabase.from('lovemap_reviews').select('prompt_id, due_on').eq('user_id', ctx.user.id),
    ctx.supabase.from('profiles').select('display_name').eq('id', ctx.partnerId).maybeSingle(),
  ])
  const partnerName = partner?.display_name?.split(' ')[0] ?? 'them'
  // Only answers that are already revealed (you've both answered) — never a spoiler.
  const answeredByMe = new Set((mine ?? []).map(r => r.prompt_id))
  const today = new Date().toISOString().slice(0, 10)
  const due = new Map((boxes ?? []).map(b => [b.prompt_id, b.due_on as string]))
  type Row = { prompt_id: string; response: string; prompts: { id: string; type: ReviewCard['type']; text: string; option_a: string | null; option_b: string | null } }
  const pool = ((theirs ?? []) as unknown as Row[])
    .filter(r => answeredByMe.has(r.prompt_id))
    .filter(r => !due.has(r.prompt_id) || due.get(r.prompt_id)! <= today)

  const cards: ReviewCard[] = pool.slice(0, DECK).map(r => {
    const p = r.prompts
    if (p.type === 'most_likely') {
      const opts = [{ value: ctx.user.id, label: 'You' }, { value: ctx.partnerId, label: partnerName }]
      return { promptId: p.id, type: p.type, text: `Who did ${partnerName} say is more likely to… ${p.text.replace(/^who('?s| is)? more likely to\s*/i, '')}`, options: opts, answerValue: r.response, answer: opts.find(o => o.value === r.response)?.label ?? r.response }
    }
    if (p.option_a && p.option_b) {
      return { promptId: p.id, type: p.type, text: `${p.text}`, options: [{ value: p.option_a, label: p.option_a }, { value: p.option_b, label: p.option_b }], answerValue: r.response, answer: r.response }
    }
    return { promptId: p.id, type: p.type, text: p.text, options: null, answerValue: r.response, answer: r.response }
  })
  return { partnerName, cards, dueTotal: pool.length }
}

// Leitner: right moves the card up a box (seen less often), wrong sends it back to the start.
export async function gradeReview(promptId: string, correct: boolean) {
  const ctx = await coupleContext()
  if (!ctx) return
  const { data: row } = await ctx.supabase.from('lovemap_reviews').select('box').eq('user_id', ctx.user.id).eq('prompt_id', promptId).maybeSingle()
  const box = correct ? Math.min(6, (row?.box ?? 0) + 1) : 0
  const due = new Date(Date.now() + BOX_DAYS[box] * 86_400_000).toISOString().slice(0, 10)
  await ctx.supabase.from('lovemap_reviews').upsert({ user_id: ctx.user.id, prompt_id: promptId, box, due_on: due, updated_at: new Date().toISOString() })
}
