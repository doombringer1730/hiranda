'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getOrCreateCouple() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
  const { data: existing } = await db
    .from('couple')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  if (existing) return existing

  const { data: created } = await db
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

export async function saveTorBoxSettings(apiKey: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ torbox_api_key: apiKey || null })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/settings')
}

export async function saveRealDebridSettings(apiKey: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ real_debrid_api_key: apiKey || null })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/settings')
}

export async function saveUsername(username: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clean = username.trim().toLowerCase()
  if (!/^[a-z0-9_-]{3,20}$/.test(clean))
    return { error: 'Must be 3–20 characters: letters, numbers, _ or -' }

  const { error } = await supabase
    .from('profiles')
    .update({ username: clean })
    .eq('id', user.id)
    .is('username', null)

  if (error) {
    if (error.code === '23505') return { error: 'That username is already taken.' }
    return { error: error.message }
  }

  revalidatePath('/settings')
  return {}
}

export async function saveAvatarUrl(avatarUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  revalidatePath('/settings')
}

export async function saveTheme(theme: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('couple')
    .update({ theme })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  revalidatePath('/', 'layout')
}
