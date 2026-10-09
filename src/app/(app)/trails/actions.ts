'use server'

import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { hasPlus } from '@/lib/plus'
import { notifyPartner, myFirstName } from '@/lib/push'
import { trailByKey, openDay, FREE_TRAIL_DAYS } from '@/lib/trails'

// Finish a trail day (or update your note on one you've finished). A day opens
// only once you've both finished the one before it.
export async function completeTrailDay(key: string, day: number, note: string) {
  const trail = trailByKey(key)
  if (!trail || !Number.isInteger(day) || day < 1 || day > trail.days.length) return { error: 'Unknown day' }
  if (day > FREE_TRAIL_DAYS && !(await hasPlus())) return { error: 'The rest of this trail comes with Hiranda Plus.' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const text = note.trim().slice(0, 1000) || null

  const { data: rows } = await ctx.supabase.from('trail_progress').select('user_id, day')
    .eq('couple_id', ctx.couple.id).eq('trail_key', key)
  const doneBy = new Map<number, Set<string>>()
  for (const r of rows ?? []) doneBy.set(r.day, (doneBy.get(r.day) ?? new Set()).add(r.user_id))

  if (doneBy.get(day)?.has(ctx.user.id)) {
    await ctx.supabase.from('trail_progress').update({ note: text })
      .eq('user_id', ctx.user.id).eq('trail_key', key).eq('day', day)
    return { ok: true, together: false, stamped: false, updated: true }
  }
  if (day > openDay(trail, doneBy, ctx.user.id, ctx.partnerId)) return { error: 'This day opens once you’ve both finished the one before.' }

  const { error } = await ctx.supabase.from('trail_progress')
    .insert({ couple_id: ctx.couple.id, user_id: ctx.user.id, trail_key: key, day, note: text })
  if (error) return { error: 'Couldn’t save. Try again?' }

  const together = !!doneBy.get(day)?.has(ctx.partnerId)
  const last = day === trail.days.length
  let stamped = false
  if (together && last) {
    const { data } = await ctx.supabase.rpc('finish_trail', { p_trail: key })
    stamped = data === true
  }
  const t = trail.days[day - 1].title
  notifyPartner(async () => ({
    title: stamped ? `You finished ${trail.title} together ${trail.emoji}` : together ? `Day ${day} done, together 💛` : `${await myFirstName()} finished “${t}”`,
    body: stamped ? 'New stamp, and a coupon for each of you.' : together ? (last ? 'That’s the whole trail.' : 'The next day is open whenever you are.') : 'Your turn whenever you’re ready. No rush.',
    url: `/trails/${key}`,
    tag: `trail-${key}`,
  }))
  revalidatePath('/trails')
  revalidatePath(`/trails/${key}`)
  return { ok: true, together, stamped }
}
