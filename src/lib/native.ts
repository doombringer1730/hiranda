'use client'

import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'

// True inside the iPhone app (the Capacitor shell in /ios), false in a browser.
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

// A plugin can be missing when the installed app predates it (the website
// updates instantly, the app only when it's rebuilt) — always check first.
export function hasPlugin(name: string) {
  return isNativeApp() && Capacitor.isPluginAvailable(name)
}

// The app's own URL scheme (Info.plist → CFBundleURLTypes). Sign-in providers
// send you back to hiranda://auth/callback, which reopens the app.
export const APP_SCHEME = 'hiranda'

const noop = () => () => {}
/** Hydration-safe: false during SSR and the first render, then the truth. */
export function useIsNativeApp() {
  return useSyncExternalStore(noop, isNativeApp, () => false)
}

/** The iOS share sheet: native in the app (once the build has the plugin), Web Share elsewhere. */
export async function shareSheet(opts: { title: string; text: string; url: string }) {
  if (hasPlugin('Share')) {
    const { Share } = await import('@capacitor/share')
    await Share.share({ ...opts, dialogTitle: opts.title })
    return
  }
  await navigator.share(opts)
}
