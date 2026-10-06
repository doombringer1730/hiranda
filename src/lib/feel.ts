'use client'

// Small "feel" helpers: haptic ticks and a confetti burst.

// iOS Safari has no vibrate API, but toggling a native <input switch> fires
// the system haptic (iOS 18+). Android uses navigator.vibrate. Must be called
// from inside a user gesture; silently does nothing elsewhere.
let switchLabel: HTMLLabelElement | null = null
export function haptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8)
      return
    }
    if (!switchLabel) {
      switchLabel = document.createElement('label')
      switchLabel.setAttribute('aria-hidden', 'true')
      switchLabel.style.display = 'none'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      switchLabel.appendChild(input)
      document.body.appendChild(switchLabel)
    }
    switchLabel.click()
  } catch {
    // best effort
  }
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A short confetti burst from a point (defaults to screen centre).
export function celebrate(origin?: { x: number; y: number } | Element | null, { count = 34, spread = 1 } = {}) {
  if (typeof document === 'undefined' || reducedMotion()) return
  let x = window.innerWidth / 2, y = window.innerHeight / 2
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2
  } else if (origin) { x = origin.x; y = origin.y }

  const css = getComputedStyle(document.documentElement)
  const colors = ['--color-amber-400', '--color-amber-500', '--color-amber-200', '--color-stone-300']
    .map(v => css.getPropertyValue(v).trim()).filter(Boolean)
  colors.push('#f472b6', '#38bdf8', '#34d399')

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'
  document.body.appendChild(layer)

  const N = count
  for (let i = 0; i < N; i++) {
    const p = document.createElement('span')
    const size = 5 + Math.random() * 6
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() < 0.5 ? 1 : 0.45)}px;border-radius:${Math.random() < 0.4 ? '50%' : '2px'};background:${colors[i % colors.length]}`
    layer.appendChild(p)
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.5
    const speed = (90 + Math.random() * 150) * spread
    const dx = Math.cos(angle) * speed, dy = Math.sin(angle) * speed - 120 * spread
    p.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 260 * spread}px)) rotate(${Math.random() * 900}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })
  }
  setTimeout(() => layer.remove(), 1800)
}
