// Print-file links: who can fetch them, and for how long. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { signPrint, verifyPrint, SUPPLIER_TTL, ADMIN_TTL, LEGACY_UNTIL } from '../src/lib/store/print-sign.ts'

const KEY = 'k'.repeat(40), SERVICE = 'service-role-key', OTHER = 'x'.repeat(40)
const keys = { current: KEY, legacy: [KEY, SERVICE] }
const order = '0f0e0d0c-0000-4000-8000-000000000001'
const now = Date.parse('2026-10-17T12:00:00Z')
const nowS = Math.floor(now / 1000)

// The old format, exactly as print.ts made it before expiries.
const legacySig = (key, side, size = '') => createHmac('sha256', key).update(`print:${order}:${side}:${size}`).digest('hex').slice(0, 40)
const link = (exp, side = 'front', size = '', key = KEY) =>
  ({ orderId: order, side, size, exp: String(exp), sig: signPrint(key, order, side, size, exp) })

test('a fresh supplier link works for 30 days, then stops', () => {
  const exp = nowS + SUPPLIER_TTL
  assert.equal(verifyPrint(keys, link(exp), now), true)
  assert.equal(verifyPrint(keys, link(exp), now + (SUPPLIER_TTL - 60) * 1000), true)
  assert.equal(verifyPrint(keys, link(exp), now + (SUPPLIER_TTL + 1) * 1000), false)
})

test('an admin link lasts an hour', () => {
  const exp = nowS + ADMIN_TTL
  assert.equal(verifyPrint(keys, link(exp, 'book', '2400x3000'), now + 59 * 60_000), true)
  assert.equal(verifyPrint(keys, link(exp, 'book', '2400x3000'), now + 61 * 60_000), false)
})

test('changing the expiry, order, side or size breaks the signature', () => {
  const good = link(nowS + 3600, 'design', '1000x1000')
  assert.equal(verifyPrint(keys, { ...good, exp: String(nowS + 999_999) }, now), false)
  assert.equal(verifyPrint(keys, { ...good, orderId: order.replace('1', '2') }, now), false)
  assert.equal(verifyPrint(keys, { ...good, side: 'front' }, now), false)
  assert.equal(verifyPrint(keys, { ...good, size: '9000x9000' }, now), false)
  assert.equal(verifyPrint(keys, { ...good, sig: good.sig.replace(/^./, c => (c === 'a' ? 'b' : 'a')) }, now), false)
  assert.equal(verifyPrint(keys, { ...good, sig: null }, now), false)
})

test('only the print key signs new links', () => {
  assert.equal(verifyPrint(keys, link(nowS + 3600, 'front', '', SERVICE), now), false)
  assert.equal(verifyPrint(keys, link(nowS + 3600, 'front', '', OTHER), now), false)
  assert.equal(verifyPrint({ current: '', legacy: [SERVICE] }, link(nowS + 3600), now), false)
})

test('no link can be made to last longer than a month', () => {
  assert.equal(verifyPrint(keys, link(nowS + 40 * 86_400), now), false)
  assert.equal(verifyPrint(keys, { ...link(nowS + 3600), exp: '-5' }, now), false)
  assert.equal(verifyPrint(keys, { ...link(nowS + 3600), exp: '1e12' }, now), false)
})

test('links from before expiries keep working until the cutoff, with either old key', () => {
  for (const k of [SERVICE, KEY]) {
    const old = { orderId: order, side: 'back', size: '', exp: null, sig: legacySig(k, 'back') }
    assert.equal(verifyPrint(keys, old, now), true, k)
    assert.equal(verifyPrint(keys, old, LEGACY_UNTIL), false, k)
  }
  const forged = { orderId: order, side: 'back', size: '', exp: null, sig: legacySig(OTHER, 'back') }
  assert.equal(verifyPrint(keys, forged, now), false)
})

test('unknown sides are refused', () => {
  assert.equal(verifyPrint(keys, link(nowS + 3600, 'secrets'), now), false)
  assert.equal(verifyPrint(keys, link(nowS + 3600, 'photo-1000'), now), false)
})
