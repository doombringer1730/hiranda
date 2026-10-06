import webpush from 'web-push'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type PushMessage = {
  title: string
  body: string
  url: string
  // Notifications with the same tag replace each other (e.g. one per game),
  // so a run of moves doesn't stack up a pile of alerts.
  tag?: string
}

let configured: boolean | null = null
function configure() {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  configured = !!(pub && priv)
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@hiranda.app', pub!, priv!)
  return configured
}

// The caller's display first name, for "Riley played…" style messages.
export async function myFirstName() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Your partner'
  const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  return data?.display_name?.split(' ')[0] || 'Your partner'
}

// Fire-and-forget: sends to every device the caller's partner opted in on,
// after the response has gone out. Never throws, never slows the action.
export function notifyPartner(message: PushMessage | (() => Promise<PushMessage | null>)) {
  if (!configure()) return
  after(async () => {
    try {
      const msg = typeof message === 'function' ? await message() : message
      if (!msg) return
      const supabase = await createClient()
      const { data: subs } = await supabase.rpc('partner_push_subscriptions')
      if (!subs?.length) return
      const payload = JSON.stringify(msg)
      await Promise.all((subs as { endpoint: string; p256dh: string; auth: string }[]).map(async s => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 })
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          // The device unsubscribed or the subscription expired — forget it.
          if (status === 404 || status === 410) await supabase.rpc('prune_partner_push_subscription', { p_endpoint: s.endpoint })
        }
      }))
    } catch {
      // Notifications are best-effort.
    }
  })
}
