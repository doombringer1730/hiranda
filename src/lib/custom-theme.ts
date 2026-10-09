// Your own theme (Plus): pick a background hue, an accent hue, and light or
// dark. It's built on the same OKLCH lightness ramp as the preset themes (see
// globals.css), so the contrast holds whatever colours you pick; only the
// hues change. Stored in couple.theme as "custom-<bg>-<accent>-<d|l>", and
// rendered as the matching preset (Mocha for dark, Cloud for light) with the
// palette vars overridden inline, so shadows, grain and form controls follow.

export type CustomTheme = { bg: number; accent: number; light: boolean }

const KEY = /^custom-(\d{1,3})-(\d{1,3})-([dl])$/

const STONE = ['950', '900', '800', '700', '600', '500', '400', '300', '200', '100', '50'] as const
const AMBER = ['950', '900', '800', '700', '600', '500', '400', '300', '200', '100', '50'] as const

// Lightness and chroma per shade, taken from the presets (Preppy for dark,
// Cloud for light). Dark themes leave stone-200..50 to Tailwind's defaults.
const DARK = {
  stone: [[0.165, 0.018], [0.204, 0.022], [0.263, 0.023], [0.335, 0.023], [0.475, 0.021], [0.635, 0.017], [0.746, 0.013], [0.855, 0.01]],
  amber: [[0.225, 0.05], [0.306, 0.068], [0.415, 0.09], [0.535, 0.112], [0.625, 0.118], [0.715, 0.112], [0.775, 0.096], [0.835, 0.074], [0.895, 0.042], [0.945, 0.024], [0.972, 0.011]],
}
const LIGHT = {
  stone: [[0.956, 0.008], [0.988, 0.004], [0.925, 0.009], [0.871, 0.01], [0.739, 0.011], [0.515, 0.012], [0.44, 0.013], [0.341, 0.012], [0.286, 0.011], [0.236, 0.01], [0.197, 0.009]],
  amber: [[0.968, 0.013], [0.915, 0.034], [0.775, 0.086], [0.655, 0.109], [0.566, 0.115], [0.476, 0.109], [0.416, 0.094], [0.355, 0.071], [0.296, 0.039], [0.246, 0.023], [0.219, 0.011]],
}

export const DEFAULT_CUSTOM: CustomTheme = { bg: 265, accent: 350, light: false }

export function parseCustomTheme(theme: string | null | undefined): CustomTheme | null {
  const m = theme?.match(KEY)
  if (!m) return null
  const bg = Number(m[1]), accent = Number(m[2])
  if (bg > 359 || accent > 359) return null
  return { bg, accent, light: m[3] === 'l' }
}

export function customThemeKey(t: CustomTheme): string {
  const hue = (h: number) => ((Math.round(h) % 360) + 360) % 360
  return `custom-${hue(t.bg)}-${hue(t.accent)}-${t.light ? 'l' : 'd'}`
}

/** The preset a custom theme sits on: it brings the light/dark physics. */
export function baseTheme(t: CustomTheme): 'coffee' | 'cloud' {
  return t.light ? 'cloud' : 'coffee'
}

const ok = ([l, c]: number[], h: number) => `oklch(${l} ${c} ${h})`

/** The palette vars to set on <html>. */
export function customThemeVars(t: CustomTheme): Record<string, string> {
  const ramp = t.light ? LIGHT : DARK
  const vars: Record<string, string> = {}
  ramp.stone.forEach((lc, i) => { vars[`--color-stone-${STONE[i]}`] = ok(lc, t.bg) })
  ramp.amber.forEach((lc, i) => { vars[`--color-amber-${AMBER[i]}`] = ok(lc, t.accent) })
  return vars
}

/** Background, accent and text colours for a small preview swatch. */
export function customSwatch(t: CustomTheme) {
  const ramp = t.light ? LIGHT : DARK
  return {
    bg: ok(ramp.stone[0], t.bg),
    accent: ok(ramp.amber[t.light ? 3 : 4], t.accent),
    text: ok(ramp.amber[10], t.accent),
  }
}
