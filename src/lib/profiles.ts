import { createClient } from '@/lib/supabase/server'

export async function getProfileMap(): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, display_name')
  const map = new Map<string, string>()
  for (const p of data ?? []) {
    map.set(p.id, p.display_name)
  }
  return map
}

export type Person = { name: string; first: string; accent: string; avatar: string | null }

// Everyone you can see (you and your partner), for the little avatar chips
// that replace repeated full names in lists.
export async function getPeople(): Promise<Map<string, Person>> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, display_name, accent_color, avatar_url')
  const map = new Map<string, Person>()
  for (const p of data ?? []) {
    map.set(p.id, { name: p.display_name, first: p.display_name?.split(' ')[0] ?? '', accent: p.accent_color || '#b45309', avatar: p.avatar_url })
  }
  return map
}
