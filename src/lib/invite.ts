import { createClient } from '@/lib/supabase/server'

export type InvitePreview = { name: string | null; avatarUrl: string | null; accent: string | null }

// Who sent this invite link — null when the link is unknown or already used.
// Before migration 044 the lookup fails, and the page falls back to "your partner".
export async function invitePreview(token: string): Promise<InvitePreview | null | undefined> {
  if (!/^[0-9a-f]{16,64}$/i.test(token)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('invite_preview', { token })
  if (error) return undefined // lookup unavailable — don't claim the link is bad
  const row = (data as { name: string | null; avatar_url: string | null; accent_color: string | null }[] | null)?.[0]
  return row ? { name: row.name, avatarUrl: row.avatar_url, accent: row.accent_color } : null
}
