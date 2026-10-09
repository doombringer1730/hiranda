import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCustomTheme, customThemeKey, customThemeVars, baseTheme } from '../src/lib/custom-theme.ts'

test('custom theme keys round-trip', () => {
  const t = { bg: 120, accent: 15, light: true }
  assert.equal(customThemeKey(t), 'custom-120-15-l')
  assert.deepEqual(parseCustomTheme('custom-120-15-l'), t)
  assert.equal(customThemeKey({ bg: 360, accent: -10, light: false }), 'custom-0-350-d')
})

test('rejects anything that is not a custom key', () => {
  for (const bad of ['coffee', 'custom-400-10-d', 'custom-10-10-x', 'custom-1-2-d;}', null, undefined]) {
    assert.equal(parseCustomTheme(bad), null)
  }
})

test('builds a full palette on the right base', () => {
  const dark = customThemeVars({ bg: 200, accent: 30, light: false })
  assert.equal(Object.keys(dark).filter(k => k.startsWith('--color-amber-')).length, 11)
  assert.match(dark['--color-stone-950'], /^oklch\(0\.\d+ 0\.\d+ 200\)$/)
  assert.equal(baseTheme({ bg: 0, accent: 0, light: true }), 'cloud')
  const light = customThemeVars({ bg: 200, accent: 30, light: true })
  assert.ok(light['--color-stone-50'])
})
