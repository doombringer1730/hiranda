// "What you're good at". Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readStrengths, strengthsLine, AREAS } from '../src/lib/strengths.ts'

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
