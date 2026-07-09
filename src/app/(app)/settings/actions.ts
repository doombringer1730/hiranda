'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { hashPasscode, THEATER_COOKIE } from '@/lib/theater'

// ── Theater passcode gate ──
export async function setTheaterPasscode(passcode: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const p = passcode.trim()
  if (p.length < 4) return { error: 'Use at least 4 characters.' }
  const hash = hashPasscode(p)
  const { error } = await supabase.from('couple').update({ theater_passcode_hash: hash })
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
  if (error) return { error: error.message }
  ;(await cookies()).set(THEATER_COOKIE, hash, { httpOnly: true, sameSite: 'lax', path: '/' })
  revalidatePath('/settings')
  return {}
}

export async function unlockTheater(passcode: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: couple } = await supabase.from('couple').select('theater_passcode_hash')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle()
  const hash = couple?.theater_passcode_hash
  if (!hash) return { error: 'No passcode set yet.' }
  if (hashPasscode(passcode) !== hash) return { error: 'Wrong passcode.' }
  ;(await cookies()).set(THEATER_COOKIE, hash, { httpOnly: true, sameSite: 'lax', path: '/' })
  revalidatePath('/settings'); revalidatePath('/watch')
  return {}
}

export async function lockTheater(): Promise<void> {
  ;(await cookies()).delete(THEATER_COOKIE)
  revalidatePath('/settings')
}

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

export async function disconnectSpotify() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .update({
      spotify_access_token: null,
      spotify_refresh_token: null,
      spotify_token_expires_at: null,
      spotify_display_name: null,
    })
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
