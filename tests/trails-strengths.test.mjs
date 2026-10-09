// Trails and "what you're good at". Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRAILS, openDay } from '../src/lib/trails.ts'
import { readStrengths, strengthsLine, AREAS } from '../src/lib/strengths.ts'

const trail = TRAILS[0]
const done = (...pairs) => {
  const m = new Map()
  for (const [day, who] of pairs) m.set(day, (m.get(day) ?? new Set()).add(who))
  return m
}

test('every trail has five days, and keys match the database list', () => {
  assert.deepEqual(TRAILS.map(t => t.key), ['money', 'love', 'distance', 'home', 'family', 'repair'])
  for (const t of TRAILS) assert.equal(t.days.length, 5)
})

test('a day opens only once you have both finished the one before', () => {
  assert.equal(openDay(trail, done(), 'a', 'b'), 1)
  assert.equal(openDay(trail, done([1, 'a']), 'a', 'b'), 1)
  assert.equal(openDay(trail, done([1, 'a'], [1, 'b']), 'a', 'b'), 2)
  const all = [1, 2, 3, 4, 5].flatMap(d => [[d, 'a'], [d, 'b']])
  assert.equal(openDay(trail, done(...all), 'a', 'b'), 6)
})

test('strengths are the top two areas at or above their bar', () => {
  const s = readStrengths({ goodNews: 6, thanks: 3, questions: 1 }, 30)
  assert.deepEqual(s.good, ['celebrating each other’s good news', 'saying thank you'])
  assert.equal(strengthsLine(s.good), 'You two are great at celebrating each other’s good news and saying thank you.')
})

test('a short month scales the bar down', () => {
  assert.equal(readStrengths({ goodNews: 1 }, 15).good.length, 1)
  assert.equal(readStrengths({ goodNews: 1 }, 30).good.length, 0)
})

test('the idea to try comes from a quiet area and changes with the seed', () => {
  const counts = Object.fromEntries(AREAS.map(a => [a.key, a.per30 * 2]))
  counts.letters = 0; counts.watch = 0
  const ideas = new Set([0, 1].map(seed => readStrengths(counts, 30, seed).next?.key))
  assert.deepEqual([...ideas].sort(), ['letters', 'watch'])
  assert.equal(strengthsLine([]), null)
})
