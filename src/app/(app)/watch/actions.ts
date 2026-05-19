'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getCoupleData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
  const { data } = await db
    .from('couple')
    .select('jellyfin_url, jellyfin_api_key, real_debrid_api_key, torbox_api_key')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  return data
}

export async function createWatchSession(title: string, storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session, error } = await supabase
    .from('watch_sessions')
    .insert({ title, storage_path: storagePath, source_type: 'upload', created_by: user.id })
    .select()
    .single()

  if (error || !session) return { error: error?.message ?? 'Failed to create session' }
  revalidatePath('/watch')
  return { sessionId: session.id }
}

export async function createWatchSessionFromUrl(title: string, url: string, fallbackUrls: string[] = [], thumbnailUrl?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session, error } = await supabase
    .from('watch_sessions')
    .insert({ title, storage_path: '', source_type: 'url', source_url: url, fallback_urls: fallbackUrls, thumbnail_url: thumbnailUrl ?? null, created_by: user.id })
    .select()
    .single()

  if (error || !session) return { error: error?.message ?? 'Failed to create session' }
  revalidatePath('/watch')
  return { sessionId: session.id }
}

export async function createWatchSessionLocal(title: string, filename: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session, error } = await supabase
    .from('watch_sessions')
    .insert({ title, storage_path: '', source_type: 'local', source_hint: filename, created_by: user.id })
    .select()
    .single()

  if (error || !session) return { error: error?.message ?? 'Failed to create session' }
  revalidatePath('/watch')
  return { sessionId: session.id }
}

export async function updateWatchSession(id: string, title: string, thumbnailUrl: string | null) {
  const supabase = await createClient()
  await supabase
    .from('watch_sessions')
    .update({ title: title.trim(), thumbnail_url: thumbnailUrl || null })
    .eq('id', id)
  revalidatePath('/watch')
}

export async function deleteWatchSession(id: string, storagePath: string | null) {
  const supabase = await createClient()
  if (storagePath) await supabase.storage.from('videos').remove([storagePath])
  await supabase.from('watch_sessions').delete().eq('id', id)
  revalidatePath('/watch')
  redirect('/watch')
}
