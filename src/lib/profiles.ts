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
