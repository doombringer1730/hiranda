import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Does the signed-in user's couple have Plus? One check per request.
export const hasPlus = cache(async (): Promise<boolean> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('couple_has_plus')
    return data === true
  } catch {
    return false
  }
})

export type PlusDetails = { active: boolean; source: 'apple' | 'stripe' | 'grant' | null; status: string | null; renews: string | null }

// For the Plus page: where it came from and when it renews.
export async function plusDetails(): Promise<PlusDetails> {
  const supabase = await createClient()
  const [active, { data }] = await Promise.all([
    hasPlus(),
    supabase.from('couple_plus').select('source, status, current_period_end').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return { active, source: data?.source ?? null, status: data?.status ?? null, renews: data?.current_period_end ?? null }
}
