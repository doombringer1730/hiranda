'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ProfilePatch = {
  display_name?: string
  bio?: string | null
  status_text?: string | null
  accent_color?: string | null
  avatar_url?: string | null
  banner_url?: string | null
}

const HEX = /^#[0-9a-fA-F]{6}$/

// Update the current user's own profile. Files (avatar/banner) are uploaded to
// storage client-side; this persists the resulting URLs + text fields.
export async function saveProfile(patch: ProfilePatch): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const update: ProfilePatch = {}

  if (patch.display_name !== undefined) {
    const name = patch.display_name.trim()
    if (!name) return { error: 'Name can’t be empty.' }
    update.display_name = name.slice(0, 60)
  }
  if (patch.bio !== undefined) update.bio = patch.bio?.trim().slice(0, 190) || null
  if (patch.status_text !== undefined) update.status_text = patch.status_text?.trim().slice(0, 80) || null
  if (patch.accent_color !== undefined) {
    if (patch.accent_color && !HEX.test(patch.accent_color)) return { error: 'Invalid color.' }
    update.accent_color = patch.accent_color || null
  }
  if (patch.avatar_url !== undefined) update.avatar_url = patch.avatar_url
  if (patch.banner_url !== undefined) update.banner_url = patch.banner_url

  if (Object.keys(update).length === 0) return {}

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/settings')
  return {}
}
