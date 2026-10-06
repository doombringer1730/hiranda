'use server'

import { createClient } from '@/lib/supabase/server'

// Has a partner joined this user's space yet?
export async function isPaired() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('couple').select('user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .not('user2_id', 'is', null).limit(1)
  return !!data?.length
}
