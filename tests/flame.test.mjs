// Flame 2.0 rules. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flameState } from '../src/lib/flame.ts'

const TODAY = new Date('2026-10-20T15:00:00Z')
// Days back from TODAY (0 = today) → a set of YYYY-MM-DD keys.
const fed = (...ago) => new Set(ago.map(n => { const d = new Date(TODAY); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }))
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

test('every day together counts, and today waits until it is over', () => {
  assert.equal(flameState(fed(...range(1, 10)), TODAY).days, 10)
  assert.equal(flameState(fed(...range(0, 9)), TODAY).days, 10)
  assert.equal(flameState(fed(...range(1, 10)), TODAY).fedToday, false)
})

test('a single missed day between two days together mends itself', () => {
  const s = flameState(fed(...range(1, 5), ...range(7, 12)), TODAY)
  assert.equal(s.days, 11)
  assert.equal(s.cozyLeft, 2)
})

test('cozy days cover a longer gap, two a month', () => {
  const s = flameState(fed(...range(1, 5), ...range(8, 12)), TODAY)
  assert.equal(s.days, 10)
  assert.deepEqual(s.cozyUsed, ['2026-10-14', '2026-10-13'])
  assert.equal(s.cozyLeft, 0)
})

test('the flame only rests after a real gap, and never goes negative', () => {
  const s = flameState(fed(...range(10, 20)), TODAY)
  assert.equal(s.resting, true)
  assert.equal(s.days, 0)
  assert.equal(s.cozyLeft, 2)
  assert.equal(flameState(new Set(), TODAY).days, 0)
})

test('yesterday missed with nothing yet today keeps the run going', () => {
  const s = flameState(fed(...range(2, 6)), TODAY)
  assert.equal(s.days, 5)
  assert.equal(s.resting, false)
})
