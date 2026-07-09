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

export async function recordAttempt(
  deckId: string | null, mode: 'quiz' | 'match' | 'review' | 'write' | 'learn', correct: number, total: number, xp: number, durationMs?: number,
): Promise<void> {
  const { supabase, user } = await requireUser()
  await supabase.from('study_attempts').insert({
    deck_id: deckId, user_id: user.id, mode,
    correct: Math.max(0, correct | 0), total: Math.max(0, total | 0),
    xp: Math.max(0, Math.min(10_000, xp | 0)), duration_ms: durationMs ? Math.max(0, durationMs | 0) : null,
  })
  revalidatePath('/study')
  revalidatePath(`/study/${deckId}`)
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
  await supabase.from('assignments').update({
    turned_in: !undo,
    turned_in_at: undo ? null : new Date().toISOString(),
  }).eq('id', id)
  // Award XP once, on turn-in (not on undo).
  if (!undo) {
    await supabase.from('study_attempts').insert({
      deck_id: null, user_id: user.id, mode: 'assignment', correct: 1, total: 1, xp: TURN_IN_XP,
    })
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
