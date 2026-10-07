import webpush from 'web-push'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isQuiet, type QuietPrefs } from '@/lib/quiet'

export type PushMessage = {
  title: string
  body: string
  url: string
  // Notifications with the same tag replace each other (e.g. one per game),
  // so a run of moves doesn't stack up a pile of alerts.
  tag?: string
  // Urgent messages get through Do Not Disturb and stay on screen.
  urgent?: boolean
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

type Sub = { endpoint: string; p256dh: string; auth: string; private?: boolean }

// What a device with "Hide details on lock screen" shows instead: no names,
// no titles — just a nudge. Tapping still opens the right page.
const PRIVATE_TEXT = { title: 'Hiranda', body: 'Something new from your partner 💗' }

// Sends one message to a set of devices; returns endpoints that are gone.
export async function sendTo(subs: Sub[], msg: PushMessage) {
  if (!configure()) return { sent: 0, gone: [] as string[], error: 'Notifications aren’t configured on this server.' }
  const gone: string[] = []
  let sent = 0
  await Promise.all(subs.map(async s => {
    const payload = JSON.stringify(s.private ? { ...msg, ...PRIVATE_TEXT } : msg)
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 })
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) gone.push(s.endpoint)
    }
  }))
  return { sent, gone }
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
      // Your partner's Do Not Disturb / quiet hours: hold it back (they'll
      // still see it in the app) unless it's urgent.
      if (!msg.urgent) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: prefs } = await supabase.from('notify_prefs')
          .select('dnd_until, quiet_start, quiet_end, tz').neq('user_id', user?.id ?? '').maybeSingle()
        if (isQuiet(prefs as QuietPrefs | null)) return
      }
      const { data: subs } = await supabase.rpc('partner_push_subscriptions')
      if (!subs?.length) return
      const { gone } = await sendTo(subs as Sub[], msg)
      // Devices that unsubscribed or expired — forget them.
      for (const endpoint of gone) await supabase.rpc('prune_partner_push_subscription', { p_endpoint: endpoint })
    } catch {
      // Notifications are best-effort.
    }
  })
}
