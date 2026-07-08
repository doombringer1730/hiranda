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
  deckId: string, mode: 'quiz' | 'match' | 'review', correct: number, total: number, xp: number, durationMs?: number,
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
