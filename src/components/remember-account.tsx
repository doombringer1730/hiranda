'use client'

import { useEffect, useSyncExternalStore } from 'react'

// Remembers who last signed in on this device (name, email, how they signed
// in) — nothing secret. The login page uses it to greet them and fill in
// their email; sign-up uses it to say "you already have an account here",
// which is how most duplicate accounts get started.
export type RememberedAccount = { name: string; email: string; provider: string }
const KEY = 'hiranda:last-account'

export function RememberAccount(props: RememberedAccount) {
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(props)) } catch {}
  }, [props.name, props.email, props.provider]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const subscribe = (cb: () => void) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) }

// Raw string snapshot (stable between renders), parsed by the caller.
export function useRememberedAccount(): RememberedAccount | null {
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(KEY) } catch { return null } }, () => null)
  if (!raw) return null
  try { return JSON.parse(raw) as RememberedAccount } catch { return null }
}

export function forgetAccount() {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new StorageEvent('storage', { key: KEY })) } catch {}
}
