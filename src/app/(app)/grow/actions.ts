'use server'

import { hasPlus } from '@/lib/plus'

import { creditFinishedCoupon } from '@/lib/coupon-credit'
import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { notifyPartner, myFirstName } from '@/lib/push'
import { milestoneByKey } from '@/lib/path'
import { routeByKey, stopByKey } from '@/lib/grow-map'
import { loadProgress, accessOf } from './map-data'

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

// ── The map ──

// Finish a map stop (or update your note on one you've finished). No coupons
// or stamps for lessons: learning together is its own reward (the critic's
// "no rewards or scores in Grow"). Your partner gets one quiet note, never a
// "your turn".
export async function completeLesson(key: string, note: string) {
  const stop = stopByKey(key)
  if (!stop) return { error: 'Unknown stop' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const map = await loadProgress(ctx)
  const { done } = map
  const access = accessOf(stop.route.key, map, await hasPlus(), ctx.user.id)
  if (access === 'plus') return { error: 'This route comes with Hiranda Plus.' }
  if (access !== 'open') return { error: 'This route opens once you’ve both said yes to it.' }
  const text = note.trim().slice(0, 1000) || null

  if (done.get(key)?.has(ctx.user.id)) {
    await ctx.supabase.from('lesson_progress').update({ note: text }).eq('user_id', ctx.user.id).eq('lesson_key', key)
    return { ok: true, together: false, updated: true }
  }
  const { error } = await ctx.supabase.from('lesson_progress')
    .upsert({ couple_id: ctx.couple.id, user_id: ctx.user.id, lesson_key: key, note: text }, { onConflict: 'user_id,lesson_key' })
  if (error) return { error: 'Couldn’t save. Try again?' }
  const together = !!done.get(key)?.has(ctx.partnerId)
  notifyPartner(async () => ({
    title: together ? `You finished “${stop.title}” together 💛` : `${await myFirstName()} finished “${stop.title}”`,
    body: together ? 'Another stop on your map.' : 'It’s on your map whenever you like.',
    url: `/grow/lesson/${key}`,
    tag: `lesson-${key}`,
  }))
  revalidatePath('/grow')
  return { ok: true, together }
}

// Your sealed answers to a stop's prediction: your own pick, and your guess at
// theirs. Final once given. Returns theirs if they've already answered.
export async function answerPrediction(key: string, mine: number, guess: number) {
  const stop = stopByKey(key)
  const n = stop?.predict?.options.length ?? 0
  if (!stop || !n || ![mine, guess].every(x => Number.isInteger(x) && x >= 0 && x < n)) return { error: 'Unknown answer' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { error } = await ctx.supabase.from('lesson_answers')
    .insert({ couple_id: ctx.couple.id, user_id: ctx.user.id, lesson_key: key, mine, guess })
  if (error && error.code !== '23505') return { error: 'Couldn’t save. Try again?' }
  const { data: theirs } = await ctx.supabase.from('lesson_answers').select('mine, guess')
    .eq('couple_id', ctx.couple.id).eq('user_id', ctx.partnerId).eq('lesson_key', key).maybeSingle()
  if (theirs) {
    notifyPartner({ title: 'Your answers are ready to open 📜', body: `“${stop.title}” on your map`, url: `/grow/lesson/${key}`, tag: `answers-${key}` })
  }
  return { ok: true, theirs: theirs ?? null }
}

// ── Opening a hard-topic route together (migration 052) ──

export async function suggestRoute(key: string) {
  const route = routeByKey(key)
  if (!route?.care) return { error: 'Unknown route' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { error } = await ctx.supabase.from('grow_routes').insert({ couple_id: ctx.couple.id, route_key: key, proposed_by: ctx.user.id })
  if (error && error.code !== '23505') return { error: 'Couldn’t save. Try again?' }
  if (!error) notifyPartner(async () => ({
    title: `${await myFirstName()} suggested a route: ${route.title} ${route.emoji}`,
    body: 'It opens if you’d like it to. “Not yet” is always fine.',
    url: '/grow',
    tag: `route-${key}`,
  }))
  revalidatePath('/grow')
  return { ok: true }
}

export async function sayYesToRoute(key: string) {
  const route = routeByKey(key)
  if (!route?.care) return { error: 'Unknown route' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data } = await ctx.supabase.from('grow_routes').update({ accepted_by: ctx.user.id, accepted_at: new Date().toISOString() })
    .eq('couple_id', ctx.couple.id).eq('route_key', key).is('accepted_by', null).neq('proposed_by', ctx.user.id).select('route_key')
  if (!data?.length) return { error: 'Nothing to say yes to.' }
  notifyPartner({ title: `${route.title} is open for you both ${route.emoji}`, body: 'Start whenever you like.', url: '/grow', tag: `route-${key}` })
  revalidatePath('/grow')
  return { ok: true }
}

/** Withdraw your suggestion, or "not yet" to theirs. No record, no reminder. */
export async function notYetRoute(key: string) {
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  await ctx.supabase.from('grow_routes').delete().eq('couple_id', ctx.couple.id).eq('route_key', key).is('accepted_by', null)
  revalidatePath('/grow')
  return { ok: true }
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
    ctx.supabase.from('prompt_responses').select('prompt_id, response, prompts!inner(id, type, text, option_a, option_b)').eq('user_id', ctx.partnerId).lt('prompts.depth', 4),
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
