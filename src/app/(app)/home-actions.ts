'use server'

import { createClient } from '@/lib/supabase/server'
import { normalizeLayout } from '@/lib/home-widgets'

// Save the Home screen for both of you.
export async function saveHomeLayout(raw: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: couple } = await supabase
    .from('couple').select('id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1)
    .maybeSingle()
  if (!couple) return { error: 'No space yet' }

  const { error } = await supabase.from('home_layouts').upsert({
    couple_id: couple.id,
    layout: normalizeLayout(raw),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: 'Could not save your Home' }
  return { ok: true }
}
