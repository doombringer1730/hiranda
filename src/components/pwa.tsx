'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

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
    if (standalone || dismissed) return

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
