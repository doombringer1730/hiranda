'use server'

import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'

// "Enjoying Hiranda?" on Home. rating: 3 love it, 2 it's okay, 1 not really;
// null means "not now" and the card comes back in two weeks.
export async function rateHiranda(rating: number | null) {
  if (rating !== null && ![1, 2, 3].includes(rating)) return { error: 'Pick one' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data, error } = await ctx.supabase.from('feedback')
    .insert({ user_id: ctx.user.id, couple_id: ctx.couple.id, rating })
    .select('id').single()
  if (error) return { error: 'Couldn’t save. Try again?' }
  if (rating === null) revalidatePath('/')
  return { ok: true, id: data.id as string }
}

// The optional "anything we could do better?" note, added to your rating.
export async function addFeedbackNote(id: string, note: string) {
  const text = note.trim().slice(0, 1000)
  if (!text) return { ok: true }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { error } = await ctx.supabase.from('feedback').update({ note: text }).eq('id', id).eq('user_id', ctx.user.id)
  if (error) return { error: 'Couldn’t send. Try again?' }
  revalidatePath('/')
  return { ok: true }
}
