'use client'

import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'

// The Theater's own copy of "are we inside the iPhone app?" (the sandbox
// can't import @/lib/native). The browser extension can't run in the app, so
// watch parties fall back to the countdown there.
export function isNativeApp() {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

const noop = () => () => {}
/** Hydration-safe: false during SSR and the first render, then the truth. */
export function useIsNativeApp() {
  return useSyncExternalStore(noop, isNativeApp, () => false)
}
