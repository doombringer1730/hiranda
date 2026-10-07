'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { hasPlugin, isNativeApp } from '@/lib/native'

// Registers the service worker (production only — it would fight dev reloads).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  }, [])
  return null
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'hiranda:install-dismissed'

// "Add Hiranda to your home screen" — Android/desktop Chrome get a one-tap
// install; iPhone Safari (no install API) gets the Share → Add steps.
// Hidden once installed, or after it's dismissed on this device.
export function InstallCard() {
  const [mode, setMode] = useState<'prompt' | 'ios' | null>(null)
  const [deferred, setDeferred] = useState<InstallEvent | null>(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch {}
    if (standalone || dismissed || isNativeApp()) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); setMode('prompt') }
    const onInstalled = () => setMode(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    const t = ios ? setTimeout(() => setMode('ios'), 0) : undefined
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      if (t) clearTimeout(t)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setMode(null)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setMode(null)
  }

  if (!mode) return null

  return (
    <div className="relative flex items-center gap-4 rounded-2xl border border-stone-800 bg-stone-900/70 p-4 pr-10 animate-page-in">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-amber-50 text-sm font-medium">Put Hiranda on your home screen</p>
        {mode === 'prompt' ? (
          <p className="text-stone-500 text-xs mt-0.5">Opens like an app — full screen, one tap away.</p>
        ) : (
          <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
            In Safari, tap <Share size={12} className="inline -mt-0.5 text-stone-300" aria-label="Share" /> then{' '}
            <span className="text-stone-300">Add to Home Screen</span>.
          </p>
        )}
      </div>
      {mode === 'prompt' && (
        <button
          onClick={install}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 px-3.5 text-sm font-medium text-amber-50 transition-colors"
        >
          <Download size={15} /> Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ minHeight: 0 }}
        className="absolute top-2 right-2 p-1.5 text-stone-600 hover:text-stone-300 transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  )
}

// ── Push notifications ──

type PushState = 'loading' | 'unsupported' | 'needs-install' | 'native' | 'off' | 'on' | 'denied'

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIOS() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      // The iPhone app uses Apple's own notifications (APNs) — once the
      // installed build includes the plugin; older builds say "coming soon".
      if (isNativeApp()) {
        if (!hasPlugin('PushNotifications')) { if (live) setState('native'); return }
        const { nativePushState } = await import('@/lib/native-push')
        const next = await nativePushState()
        if (live) setState(next)
        return
      }
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
        && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      // iPhone only allows web push for apps added to the home screen.
      const next: PushState = !supported
        ? (isIOS() && !isStandalone() ? 'needs-install' : 'unsupported')
        : Notification.permission === 'denied' ? 'denied'
        : (await (await navigator.serviceWorker.ready).pushManager.getSubscription()) ? 'on' : 'off'
      if (live) setState(next)
    })().catch(() => { if (live) setState('unsupported') })
    return () => { live = false }
  }, [])

  async function enable() {
    setBusy(true)
    try {
      if (isNativeApp()) {
        const { enableNativePush } = await import('@/lib/native-push')
        setState(await enableNativePush())
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const { savePushSubscription } = await import('@/app/push-actions')
      const res = await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0])
      setState(res.error ? 'off' : 'on')
    } catch {
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      if (isNativeApp()) {
        const { disableNativePush } = await import('@/lib/native-push')
        setState(await disableNativePush())
        return
      }
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
      if (sub) {
        const { removePushSubscription } = await import('@/app/push-actions')
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  return { state, busy, enable, disable }
}

// Settings row.
export function NotificationSettings() {
  const { state, busy, enable, disable } = usePushNotifications()
  const note: Partial<Record<PushState, string>> = {
    'unsupported': 'This browser doesn’t support notifications.',
    'needs-install': 'On iPhone, add Hiranda to your Home Screen first (Share → Add to Home Screen), then turn this on from the app.',
    'native': 'Notifications in the iPhone app are coming in a future update.',
    'denied': isNativeApp()
      ? 'Notifications are off for Hiranda. Turn them on in iPhone Settings → Notifications → Hiranda.'
      : 'Notifications are blocked. Allow them for Hiranda in your phone or browser settings.',
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-stone-400 text-sm">
          {note[state] ?? (state === 'on' ? 'On for this device.' : 'Off for this device.')}
        </p>
        {(state === 'on' || state === 'off') && (
          <Switch on={state === 'on'} busy={busy} label="Notifications" onToggle={state === 'on' ? disable : enable} />
        )}
      </div>
      {state === 'on' && (isNativeApp() ? <TestButton /> : <NotificationExtras />)}
    </div>
  )
}

function Switch({ on, busy, label, onToggle }: { on: boolean; busy?: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative shrink-0 h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-amber-600' : 'bg-stone-700'}`}
      style={{ minHeight: 0 }}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-amber-50 shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

// "Send me a test" — goes to all of your devices.
function TestButton() {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function test() {
    setBusy(true); setMsg(null)
    const { sendTestNotification } = await import('@/app/push-actions')
    const res = await sendTestNotification()
    setBusy(false)
    setMsg(res.error ?? `Sent to ${res.sent} device${res.sent === 1 ? '' : 's'} — check your notifications.`)
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={test} disabled={busy} className="rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 px-4 py-2 text-sm text-stone-200 transition-colors">
        {busy ? 'Sending…' : 'Send me a test'}
      </button>
      {msg && <p className="text-stone-400 text-xs">{msg}</p>}
    </div>
  )
}

// Lock-screen privacy for this device, and a test send.
function NotificationExtras() {
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
      if (!sub || !live) return
      const { getNotificationPrivacy } = await import('@/app/push-actions')
      const value = await getNotificationPrivacy(sub.endpoint)
      if (live) { setEndpoint(sub.endpoint); setHidden(value) }
    })().catch(() => {})
    return () => { live = false }
  }, [])

  async function togglePrivacy() {
    if (!endpoint) return
    const next = !hidden
    setHidden(next)
    const { setNotificationPrivacy } = await import('@/app/push-actions')
    await setNotificationPrivacy(endpoint, next)
  }


  return (
    <div className="flex flex-col gap-3 border-t border-stone-800 pt-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-amber-50 text-sm">Hide details on lock screen</p>
          <p className="text-stone-500 text-xs mt-0.5">Shows “Something new from your partner” instead of names and titles.</p>
        </div>
        <Switch on={hidden} label="Hide details on lock screen" onToggle={togglePrivacy} />
      </div>
      <TestButton />
    </div>
  )
}

const NOTIFY_DISMISS_KEY = 'hiranda:notify-dismissed'

// Home card nudging you to turn notifications on — shown in the installed app
// (or on desktop), not in a phone browser where the install card comes first.
export function NotificationCard() {
  const { state, busy, enable } = usePushNotifications()
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(NOTIFY_DISMISS_KEY) === '1' } catch {}
    const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1
    // In the iPhone app, once the installed build can do native notifications.
    const canAsk = isNativeApp() ? hasPlugin('PushNotifications') : (isStandalone() || !mobile)
    const t = setTimeout(() => setEligible(!dismissed && canAsk), 0)
    return () => clearTimeout(t)
  }, [])

  if (!eligible || state !== 'off') return null

  function dismiss() {
    try { localStorage.setItem(NOTIFY_DISMISS_KEY, '1') } catch {}
    setEligible(false)
  }

  return (
    <div className="relative flex items-center gap-4 rounded-2xl border border-stone-800 bg-stone-900/70 p-4 pr-10 animate-page-in">
      <span className="h-12 w-12 shrink-0 rounded-xl bg-amber-900/40 flex items-center justify-center text-xl">🔔</span>
      <div className="min-w-0 flex-1">
        <p className="text-amber-50 text-sm font-medium">Know when it’s your turn</p>
        <p className="text-stone-500 text-xs mt-0.5">Get a ping when your partner answers, plays a move, or writes something.</p>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="shrink-0 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-3.5 text-sm font-medium text-amber-50 transition-colors"
      >
        Turn on
      </button>
      <button onClick={dismiss} aria-label="Dismiss" style={{ minHeight: 0 }} className="absolute top-2 right-2 p-1.5 text-stone-600 hover:text-stone-300 transition-colors">
        <X size={15} />
      </button>
    </div>
  )
}
