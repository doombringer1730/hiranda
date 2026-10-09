'use server'

import { revalidatePath } from 'next/cache'
import { coupleContext } from '@/lib/couple'
import { notifyPartner, myFirstName } from '@/lib/push'

// The one-time Plus intro: start the free week, or "maybe later". Either way
// it's marked seen, so it never comes back on its own.

async function markSeen() {
  const ctx = await coupleContext()
  if (!ctx) return null
  await ctx.supabase.from('plus_intro_seen').upsert({ user_id: ctx.user.id })
  return ctx
}

export async function startFreeWeek(): Promise<{ endsAt?: string; error?: string }> {
  const ctx = await markSeen()
  if (!ctx) return { error: 'Not signed in' }
  const { data, error } = await ctx.supabase.rpc('start_plus_trial')
  if (error || !data) return { error: 'Your free week couldn’t start. You may already have Plus.' }
  notifyPartner(async () => ({
    title: `${await myFirstName()} started your free week of Plus ✨`,
    body: 'Everything in Plus, for both of you, for 7 days. No card, and it just ends.',
    url: '/plus',
    tag: 'plus-trial',
  }))
  revalidatePath('/', 'layout')
  return { endsAt: data as string }
}

export async function dismissPlusIntro() {
  await markSeen()
  revalidatePath('/')
}
