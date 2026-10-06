import { createClient } from '@/lib/supabase/server'

// The signed-in user and their (paired) couple, for server actions. Null when
// signed out or not yet paired.
export async function coupleContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: couple } = await supabase
    .from('couple').select('id, user1_id, user2_id, together_since')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1).maybeSingle()
  if (!couple?.user1_id || !couple.user2_id) return null
  const partnerId: string = couple.user1_id === user.id ? couple.user2_id : couple.user1_id
  return { supabase, user, couple, partnerId }
}
