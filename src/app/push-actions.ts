'use server'

import { createClient } from '@/lib/supabase/server'

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } }

export async function savePushSubscription(sub: Sub) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return { error: 'Invalid subscription' }
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: 'endpoint' },
  )
  return error ? { error: 'Could not save' } : {}
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
}
