'use server'

import { createClient } from '@/lib/supabase/server'
import { sendTo } from '@/lib/push'
import { apnsConfigured, sendApns } from '@/lib/apns'

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

// Per-device privacy: hide names and titles on this device's lock screen.
export async function getNotificationPrivacy(endpoint: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('push_subscriptions').select('private').eq('endpoint', endpoint).maybeSingle()
  return !!data?.private
}

export async function setNotificationPrivacy(endpoint: string, value: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('push_subscriptions').update({ private: value }).eq('endpoint', endpoint).eq('user_id', user.id)
}

const TEST = { title: 'It works! 🔔', body: 'This is what a Hiranda notification looks like.', url: '/settings', tag: 'test' }

// "Send me a test": goes to every device of the signed-in user — browsers and
// the iPhone app — so you can check notifications actually arrive
// (respecting each browser's privacy setting).
export async function sendTestNotification(): Promise<{ sent: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sent: 0, error: 'Not signed in' }
  const [{ data: subs }, { data: tokens }] = await Promise.all([
    supabase.from('push_subscriptions').select('endpoint, p256dh, auth, private').eq('user_id', user.id),
    supabase.from('native_push_tokens').select('token').eq('user_id', user.id),
  ])
  if (!subs?.length && !tokens?.length) return { sent: 0, error: 'Turn notifications on for this device first.' }
  let sent = 0, error: string | undefined
  if (subs?.length) {
    const res = await sendTo(subs, TEST)
    if (res.gone.length) await supabase.from('push_subscriptions').delete().in('endpoint', res.gone).eq('user_id', user.id)
    sent += res.sent; error = res.error
  }
  if (tokens?.length) {
    if (!apnsConfigured()) error = 'iPhone notifications aren’t set up on the server yet.'
    const res = await sendApns(tokens.map(t => t.token), TEST)
    if (res.gone.length) await supabase.from('native_push_tokens').delete().in('token', res.gone).eq('user_id', user.id)
    sent += res.sent
  }
  return { sent, error: sent ? undefined : error }
}

// The iPhone app's APNs device token, claimed for the signed-in user.
export async function saveNativePushToken(token: string) {
  if (!/^[0-9a-f]{64,200}$/.test(token)) return { error: 'Invalid token' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('register_native_push_token', { p_token: token })
  return error ? { error: 'Could not save' } : {}
}

export async function removeNativePushToken(token: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('native_push_tokens').delete().eq('token', token).eq('user_id', user.id)
}
