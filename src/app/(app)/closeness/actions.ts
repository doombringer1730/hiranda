'use server'

import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'

// Your private closeness check-in. Never shared, never sent to your partner.
export async function checkIn(score: number) {
  if (![1, 2, 3, 4, 5].includes(score)) return { error: 'Pick one' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { error } = await ctx.supabase.from('closeness_checkins').insert({ user_id: ctx.user.id, couple_id: ctx.couple.id, score })
  if (error) return { error: 'Couldn’t save. Try again?' }
  revalidatePath('/')
  revalidatePath('/closeness')
  return { ok: true }
}
