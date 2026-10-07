'use client'

import { useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPlugin } from '@/lib/native'

// "Sign in with Apple" — the iPhone app's native Apple sheet, exchanged for a
// Supabase session (Supabase → Authentication → Providers → Apple must list
// the app's bundle id). Renders only in an app build that has the plugin.

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

export default function AppleButton({ next = '/' }: { next?: string }) {
  const available = useSyncExternalStore(() => () => {}, () => hasPlugin('SignInWithApple'), () => false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!available) return null

  async function go() {
    setBusy(true); setError(null)
    try {
      const [{ SignInWithApple }, { App }] = await Promise.all([import('@capacitor-community/apple-sign-in'), import('@capacitor/app')])
      const { id: bundleId } = await App.getInfo()
      // Apple embeds the hashed nonce in its token; Supabase checks it against the raw one.
      const nonce = crypto.randomUUID()
      const { response } = await SignInWithApple.authorize({
        clientId: bundleId,
        redirectURI: location.origin,
        scopes: 'email name',
        nonce: await sha256Hex(nonce),
      })
      const { error } = await createClient().auth.signInWithIdToken({ provider: 'apple', token: response.identityToken, nonce })
      if (error) throw error
      // Same landing as every other sign-in; the middleware asks for 2FA if it's on.
      location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/'
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? ''
      // Closing Apple's sheet isn't an error worth showing.
      if (!/cancel|1001/i.test(msg)) setError('Sign in with Apple didn’t work — try again.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-black text-white font-medium px-4 py-3 border border-white/15 hover:bg-black/85 disabled:opacity-60 transition-colors"
      >
        <svg width="16" height="19" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
          <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-77 0-104 41-167 41s-106-58-156-128C44 790 0 671 0 557 0 375 118 279 235 279c62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 64zM556 174c29-35 50-83 50-132 0-7-1-14-2-19-48 2-104 32-138 71-27 30-52 78-52 128 0 8 1 15 2 18 3 0 8 1 13 1 43 0 97-29 127-67z"/>
        </svg>
        {busy ? 'Opening Apple…' : 'Sign in with Apple'}
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  )
}
