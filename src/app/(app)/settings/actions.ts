'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getOrCreateCouple() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('couple')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  if (existing) return existing

  const { data: created } = await supabase
    .from('couple')
    .insert({ user1_id: user.id })
    .select()
    .single()

  return created
}

export async function updateTogetherSince(togetherSince: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ together_since: togetherSince || null })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/settings')
}

export async function toggleTimer(show: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ show_timer: show })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/settings')
}

export async function updateDisplayName(name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: name.trim() })

  revalidatePath('/settings')
}

export async function saveJellyfinSettings(jellyfinUrl: string, jellyfinApiKey: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ jellyfin_url: jellyfinUrl || null, jellyfin_api_key: jellyfinApiKey || null })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/settings')
}

export async function saveJellyfinSettings(jellyfinUrl: string, jellyfinApiKey: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ jellyfin_url: jellyfinUrl || null, jellyfin_api_key: jellyfinApiKey || null })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/settings')
}
