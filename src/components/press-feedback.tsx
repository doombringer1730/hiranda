'use client'

import { useEffect } from 'react'

// SwiftUI-style press feedback for every tappable surface: it squishes while
// held and springs back on release. Done with the Web Animations API on the
// `scale` property, so it never fights Tailwind transitions or transforms.
// Skipped on /watch and /party (the sync feature) and for reduced motion.
const SPRING = 'linear(0, 0.059, 0.197, 0.377, 0.569, 0.748, 0.889, 1.009, 1.093, 1.142, 1.162, 1.16, 1.143, 1.116, 1.085, 1.054, 1.029, 1.007, 0.99, 0.98, 0.974, 0.973, 0.975, 0.979, 0.984, 0.989, 0.993, 0.997, 1, 1.003, 1.004, 1.004, 1.004, 1.004, 1.003, 1.002, 1.001, 1.001, 1, 1, 1)'

export default function PressFeedback() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let pressed: { el: HTMLElement; to: number; anim: Animation } | null = null

    const target = (e: Event) => {
      if (/^\/(watch|party)(\/|$)/.test(location.pathname)) return null
      const el = (e.target as Element | null)?.closest<HTMLElement>('a, button, [role="button"], [role="tab"], summary')
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return null
      // Only "surfaces" (cards, pills, buttons) — not inline text links.
      if (!/\brounded|\bbg-/.test(el.className || '')) return null
      return el
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const el = target(e)
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      const to = width * height > 40000 ? 0.975 : 0.94
      const anim = el.animate([{ scale: '1' }, { scale: String(to) }], { duration: 110, easing: 'ease-out', fill: 'forwards' })
      pressed = { el, to, anim }
    }
    const up = () => {
      if (!pressed) return
      const { el, to, anim } = pressed
      pressed = null
      anim.cancel()
      el.animate([{ scale: String(to) }, { scale: '1' }], { duration: 700, easing: SPRING })
    }

    document.addEventListener('pointerdown', down, { passive: true })
    document.addEventListener('pointerup', up, { passive: true })
    document.addEventListener('pointercancel', up, { passive: true })
    window.addEventListener('blur', up)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
  }, [])
  return null
}
