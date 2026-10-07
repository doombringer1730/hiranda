'use client'

import { PushNotifications } from '@capacitor/push-notifications'

// iPhone-app notifications (APNs). The device token is kept on the phone so
// the app can tell the server when it changes and forget it on "off".
const KEY = 'hiranda:apns-token'
type NativeState = 'on' | 'off' | 'denied'

export function storedToken() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export async function nativePushState(): Promise<NativeState> {
  const { receive } = await PushNotifications.checkPermissions()
  if (receive === 'denied') return 'denied'
  return receive === 'granted' && storedToken() ? 'on' : 'off'
}

// Ask iOS for this device's token (prompting for permission only if asked to).
function register(): Promise<string | null> {
  return new Promise(resolve => {
    let done = false
    const handles: Promise<{ remove: () => Promise<void> }>[] = []
    const finish = (token: string | null) => {
      if (done) return
      done = true
      handles.forEach(h => h.then(x => x.remove()).catch(() => {}))
      resolve(token)
    }
    handles.push(PushNotifications.addListener('registration', t => finish(t.value)))
    handles.push(PushNotifications.addListener('registrationError', () => finish(null)))
    PushNotifications.register().catch(() => finish(null))
    setTimeout(() => finish(null), 15000)
  })
}

async function save(token: string) {
  const { saveNativePushToken } = await import('@/app/push-actions')
  const res = await saveNativePushToken(token.toLowerCase())
  if (res.error) return false
  try { localStorage.setItem(KEY, token.toLowerCase()) } catch {}
  return true
}

export async function enableNativePush(): Promise<NativeState> {
  let { receive } = await PushNotifications.checkPermissions()
  if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await PushNotifications.requestPermissions()).receive
  if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'off'
  const token = await register()
  return token && (await save(token)) ? 'on' : 'off'
}

export async function disableNativePush(): Promise<NativeState> {
  const token = storedToken()
  try { localStorage.removeItem(KEY) } catch {}
  if (token) {
    const { removeNativePushToken } = await import('@/app/push-actions')
    await removeNativePushToken(token)
  }
  await PushNotifications.unregister().catch(() => {})
  return 'off'
}

// On launch: tokens can change (restore, reinstall) — re-register quietly and
// tell the server if it did. Only for devices that already said yes.
export async function refreshNativePush() {
  const previous = storedToken()
  if (!previous) return
  const { receive } = await PushNotifications.checkPermissions()
  if (receive !== 'granted') return
  const token = await register()
  if (token && token.toLowerCase() !== previous) await save(token)
}
