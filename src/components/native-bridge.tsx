'use client'

import { useEffect } from 'react'
import { APP_SCHEME, hasPlugin, isNativeApp } from '@/lib/native'

// Glue between the website and the iPhone app. Renders nothing; in a normal
// browser it does nothing at all.
//  - marks <html data-native> so CSS can tell where it's running
//  - keeps the status bar text readable on light and dark themes
//  - finishes sign-ins that come back through hiranda://auth/callback
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return
    const root = document.documentElement
    root.dataset.native = 'ios'
    const cleanups: (() => void)[] = []

    if (hasPlugin('StatusBar')) {
      const sync = async () => {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        const light = isLight(getComputedStyle(document.body).backgroundColor)
        // Style.Light = dark text (for light backgrounds), Style.Dark = light text.
        await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {})
      }
      sync()
      const observer = new MutationObserver(sync)
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
      cleanups.push(() => observer.disconnect())
    }

    if (hasPlugin('App')) {
      let removed = false
      let remove: (() => void) | undefined
      import('@capacitor/app').then(({ App }) =>
        App.addListener('appUrlOpen', ({ url }) => {
          const parsed = safeUrl(url)
          if (!parsed || parsed.protocol !== `${APP_SCHEME}:`) return
          // hiranda://auth/callback?code=… → finish on the website's own callback,
          // which has the sign-in cookie from when the flow started.
          if (parsed.host === 'auth' && parsed.pathname === '/callback') {
            if (hasPlugin('Browser')) import('@capacitor/browser').then(({ Browser }) => Browser.close().catch(() => {}))
            location.href = `/api/auth/callback${parsed.search}`
          }
        }),
      ).then(handle => {
        remove = () => { handle.remove() }
        if (removed) remove()
      })
      cleanups.push(() => { removed = true; remove?.() })
    }

    return () => cleanups.forEach(fn => fn())
  }, [])

  return null
}

function safeUrl(url: string) {
  try { return new URL(url) } catch { return null }
}

// Is this computed background colour light? Themes are OKLCH, which browsers
// may report as oklch(L C H) — L is perceptual lightness — or as rgb().
function isLight(color: string) {
  const ok = color.match(/^oklch\(\s*([\d.]+)(%?)/)
  if (ok) return Number(ok[1]) / (ok[2] ? 100 : 1) > 0.6
  const m = color.match(/\d+(\.\d+)?/g)
  if (!m || m.length < 3) return false
  const [r, g, b] = m.slice(0, 3).map(Number)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}
