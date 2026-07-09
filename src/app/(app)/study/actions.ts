'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function createDeck(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()
  const title = (formData.get('title') as string)?.trim()
  if (!title) return
  const { data, error } = await supabase
    .from('study_decks')
    .insert({ title: title.slice(0, 120), description: (formData.get('description') as string)?.trim()?.slice(0, 300) || null, created_by: user.id })
    .select('id')
    .single()
  if (error || !data) return
  revalidatePath('/study')
  redirect(`/study/${data.id}`)
}

export async function addCard(deckId: string, term: string, definition: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser()
  if (!term.trim() || !definition.trim()) return { error: 'Both sides are required.' }
  const { count } = await supabase.from('study_cards').select('id', { count: 'exact', head: true }).eq('deck_id', deckId)
  const { error } = await supabase.from('study_cards').insert({
    deck_id: deckId, term: term.trim().slice(0, 500), definition: definition.trim().slice(0, 1000), position: count ?? 0,
  })
  if (error) return { error: error.message }
  revalidatePath(`/study/${deckId}`)
  return {}
}

// Bulk create from pasted text (Quizlet-style). Pairs are parsed client-side.
export async function addCardsBulk(deckId: string, pairs: { term: string; definition: string }[]): Promise<{ error?: string; added?: number }> {
  const { supabase } = await requireUser()
  const clean = pairs
    .map(p => ({ term: p.term.trim().slice(0, 500), definition: p.definition.trim().slice(0, 1000) }))
    .filter(p => p.term && p.definition)
    .slice(0, 500)
  if (!clean.length) return { error: 'Nothing to import — check the format.' }
  const { count } = await supabase.from('study_cards').select('id', { count: 'exact', head: true }).eq('deck_id', deckId)
  const base = count ?? 0
  const rows = clean.map((p, i) => ({ deck_id: deckId, term: p.term, definition: p.definition, position: base + i }))
  const { error } = await supabase.from('study_cards').insert(rows)
  if (error) return { error: error.message }
  revalidatePath(`/study/${deckId}`)
  return { added: clean.length }
}

export async function updateCard(id: string, deckId: string, term: string, definition: string): Promise<void> {
  const { supabase } = await requireUser()
  await supabase.from('study_cards').update({ term: term.trim().slice(0, 500), definition: definition.trim().slice(0, 1000) }).eq('id', id)
  revalidatePath(`/study/${deckId}`)
}

export async function deleteCard(id: string, deckId: string): Promise<void> {
  const { supabase } = await requireUser()
  await supabase.from('study_cards').delete().eq('id', id)
  revalidatePath(`/study/${deckId}`)
}

export async function deleteDeck(id: string): Promise<void> {
  const { supabase } = await requireUser()
  await supabase.from('study_decks').delete().eq('id', id)
  revalidatePath('/study')
  redirect('/study')
}

const GRADED = ['quiz', 'match', 'write', 'learn']
const DAILY_COIN_CAP = 50
const TEST_COIN_EXTRA = 20
export async function recordAttempt(
  deckId: string | null, mode: 'quiz' | 'match' | 'review' | 'write' | 'learn', correct: number, total: number, xp: number, durationMs?: number,
): Promise<void> {
  const { supabase, user } = await requireUser()
  let finalXp = Math.max(0, Math.min(10_000, xp | 0))
  let coins = 0

  if (GRADED.includes(mode) && deckId) {
    // Anti-grind (Duolingo-style): repeating the same deck+mode today earns
    // steeply less, so you can't farm the same set.
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
    const { count } = await supabase.from('study_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('deck_id', deckId).eq('mode', mode).gte('created_at', startOfDay.toISOString())
    const reps = count ?? 0
    const mult = reps === 0 ? 1 : reps === 1 ? 0.4 : 0.15
    finalXp = Math.round(finalXp * mult)
    const flawless = total > 0 && correct === total
    coins = Math.round(finalXp * 0.4) + (flawless ? 3 : 0)
  } else {
    coins = Math.round(finalXp * 0.4)
  }

  // Daily coin cap so you can't grind coins forever; "tests" (quiz/write) get
  // a little extra headroom past the cap.
  if (coins > 0) {
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
    const { data: todayRows } = await supabase.from('study_attempts')
      .select('coins').eq('user_id', user.id).gte('created_at', startOfDay.toISOString())
    const earnedToday = (todayRows ?? []).reduce((s, r) => s + (r.coins ?? 0), 0)
    const cap = DAILY_COIN_CAP + (mode === 'quiz' || mode === 'write' ? TEST_COIN_EXTRA : 0)
    coins = Math.max(0, Math.min(coins, cap - earnedToday))
  }

  await supabase.from('study_attempts').insert({
    deck_id: deckId, user_id: user.id, mode,
    correct: Math.max(0, correct | 0), total: Math.max(0, total | 0),
    xp: finalXp, coins, duration_ms: durationMs ? Math.max(0, durationMs | 0) : null,
  })
  revalidatePath('/study')
  if (deckId) revalidatePath(`/study/${deckId}`)
}

// Current spendable coin balance = coins earned − coins spent on coupons.
async function coinBalance(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const [{ data: earned }, { data: spent }] = await Promise.all([
    supabase.from('study_attempts').select('coins').eq('user_id', userId),
    supabase.from('coupons').select('cost').eq('bought_by', userId),
  ])
  const e = (earned ?? []).reduce((s, r) => s + (r.coins ?? 0), 0)
  const p = (spent ?? []).reduce((s, r) => s + (r.cost ?? 0), 0)
  return e - p
}

export async function buyCoupon(title: string, emoji: string, cost: number): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  const t = title.trim().slice(0, 120)
  const c = Math.max(0, Math.min(100_000, Math.round(cost)))
  if (!t) return { error: 'Give the coupon a title.' }
  if (await coinBalance(supabase, user.id) < c) return { error: 'Not enough coins yet.' }
  const { error } = await supabase.from('coupons').insert({ title: t, emoji: emoji || null, cost: c, bought_by: user.id })
  if (error) return { error: error.message }
  revalidatePath('/study/shop'); revalidatePath('/study')
  return {}
}

export async function redeemCoupon(id: string, undo = false): Promise<void> {
  const { supabase } = await requireUser()
  await supabase.from('coupons').update({ redeemed: !undo, redeemed_at: undo ? null : new Date().toISOString() }).eq('id', id)
  revalidatePath('/study/shop')
}

export async function deleteCoupon(id: string): Promise<void> {
  const { supabase } = await requireUser()
  await supabase.from('coupons').delete().eq('id', id)
  revalidatePath('/study/shop'); revalidatePath('/study')
}

// Transient activity shown on presence cards (e.g. "quizzing"); cleared on exit.
export async function setActivity(activity: string | null): Promise<void> {
  const { supabase, user } = await requireUser()
  await supabase.from('profiles').update({
    activity: activity || null,
    activity_at: activity ? new Date().toISOString() : null,
  }).eq('id', user.id)
}

export async function setXpGoal(goal: number): Promise<void> {
  const { supabase, user } = await requireUser()
  const g = Math.max(50, Math.min(100_000, Math.round(goal)))
  await supabase.from('profiles').update({ xp_goal: g }).eq('id', user.id)
  revalidatePath('/study')
}

// ── Assignments (due dates + turn-in) ──
export async function createAssignment(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()
  const title = (formData.get('title') as string)?.trim()
  const due = (formData.get('due_date') as string)?.trim()
  if (!title || !due) return
  await supabase.from('assignments').insert({ title: title.slice(0, 200), due_date: due, created_by: user.id })
  revalidatePath('/study')
}

const TURN_IN_XP = 25
export async function turnInAssignment(id: string, undo = false): Promise<void> {
  const { supabase, user } = await requireUser()
  const { data: a } = await supabase.from('assignments').select('xp_awarded').eq('id', id).maybeSingle()
  await supabase.from('assignments').update({
    turned_in: !undo,
    turned_in_at: undo ? null : new Date().toISOString(),
  }).eq('id', id)
  // Award XP + coins ONCE ever, on the first turn-in — so undo/redo can't farm it.
  if (!undo && a && !a.xp_awarded) {
    await supabase.from('study_attempts').insert({
      deck_id: null, user_id: user.id, mode: 'assignment', correct: 1, total: 1, xp: TURN_IN_XP, coins: 10,
    })
    await supabase.from('assignments').update({ xp_awarded: true }).eq('id', id)
  }
  revalidatePath('/study')
}

export async function deleteAssignment(id: string): Promise<void> {
  const { supabase } = await requireUser()
  await supabase.from('assignments').delete().eq('id', id)
  revalidatePath('/study')
}

// Leitner spaced repetition: intervals (days) by box level.
const INTERVALS = [1, 2, 4, 7, 15, 30]
export async function reviewCard(cardId: string, correct: boolean): Promise<void> {
  const { supabase, user } = await requireUser()
  const { data: prev } = await supabase.from('study_progress').select('box').eq('user_id', user.id).eq('card_id', cardId).maybeSingle()
  const box = correct ? Math.min((prev?.box ?? 0) + 1, INTERVALS.length - 1) : 0
  const due = new Date()
  due.setDate(due.getDate() + INTERVALS[box])
  await supabase.from('study_progress').upsert({
    user_id: user.id, card_id: cardId, box, due_at: due.toISOString().slice(0, 10), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,card_id' })
}
