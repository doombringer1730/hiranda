// The Grow map: content rules, old progress, and the Plus rule. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROUTES, ALL_STOPS, stopByKey, stopKeyForTrailDay, routeState, freeBranch, routeIsFree, withName } from '../src/lib/grow-map.ts'

// What the old Path and Trails had, so their progress keeps counting.
const OLD_PATH_KEYS = ['maps', 'toward', 'thanks', 'repair', 'new'].flatMap(u => [1, 2, 3, 4].map(n => `${u}_${n}`))
const OLD_TRAILS = ['money', 'love', 'distance', 'home', 'family', 'repair'] // five days each

const words = s => s.trim().split(/\s+/).length

test('every stop key is unique and fits lesson_progress (≤ 40 chars)', () => {
  const keys = ALL_STOPS.map(s => s.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const k of keys) assert.ok(k.length <= 40, k)
  assert.equal(new Set(ROUTES.map(r => r.key)).size, ROUTES.length)
})

test('every route has stops, and base camp is free', () => {
  for (const r of ROUTES) assert.ok(r.stops.length >= 3, r.key)
  assert.deepEqual(ROUTES.filter(r => r.kind === 'base').map(r => r.key), ['maps', 'toward', 'thanks'])
  assert.ok(ROUTES.find(r => r.key === 'repair').free, 'repair is always free')
})

test('guesses are well formed, and rewritten Learn cards stay short', () => {
  for (const s of ALL_STOPS) {
    if (s.guess) {
      assert.ok(s.guess.options.length >= 2, s.key)
      assert.ok(Number.isInteger(s.guess.answer) && s.guess.answer >= 0 && s.guess.answer < s.guess.options.length, s.key)
      assert.ok(s.guess.reveal.length > 0, s.key)
    }
    if (s.predict) assert.ok(s.predict.options.length >= 2 && s.predict.q.includes('{p}') && s.predict.self && !s.predict.self.includes('{p}'), s.key)
    // Cards rewritten for the map (they have a guess or a prediction) keep Learn ≤ 40 words.
    if (s.guess || s.predict) assert.ok(words(s.learn) <= 40, `${s.key}: ${words(s.learn)} words`)
    assert.ok(s.do.text && s.reflect && s.source, s.key)
  }
})

test('predictions never ask about hurt, satisfaction or conflict', () => {
  for (const s of ALL_STOPS) if (s.predict) {
    assert.doesNotMatch(s.predict.q + s.predict.self, /hurt|satisf|angry|upset|fight|fault|unhappy|rate/i, s.key)
  }
})

test('every old Path lesson is still a stop, so progress counts', () => {
  for (const k of OLD_PATH_KEYS) assert.ok(stopByKey(k), k)
})

test('every old Trail day maps onto a stop', () => {
  for (const t of OLD_TRAILS) for (let d = 1; d <= 5; d++) assert.ok(stopKeyForTrailDay(t, d), `${t} day ${d}`)
  assert.equal(stopKeyForTrailDay('repair', 1), 'repair_2') // the duplicate lesson
  assert.equal(stopKeyForTrailDay('nope', 1), null)
})

test('route state: your next stop, and what you finished together', () => {
  const r = ROUTES.find(r => r.key === 'maps')
  const done = new Map([['maps_1', new Set(['me', 'you'])], ['maps_2', new Set(['me'])]])
  const st = routeState(r, done, 'me', 'you')
  assert.equal(st.mine, 2)
  assert.equal(st.both, 1)
  assert.equal(st.next.key, 'maps_3')
  assert.equal(st.started, true)
  assert.equal(st.finished, false)
  assert.equal(routeState(r, new Map(), 'me', 'you').next.key, 'maps_1')
})

test('Plus: base camp and repair are free; the first branch you start is free in full', () => {
  const route = k => ROUTES.find(r => r.key === k)
  const none = new Map()
  assert.equal(freeBranch(none), null)
  for (const r of ROUTES) assert.equal(routeIsFree(r, none), true, `${r.key} before anything is started`)

  const started = new Map([['money', 200], ['love', 100], ['maps', 50], ['repair', 10]])
  assert.equal(freeBranch(started), 'love') // earliest non-free branch; base and repair don't count
  assert.equal(routeIsFree(route('love'), started), true)
  assert.equal(routeIsFree(route('money'), started), false)
  assert.equal(routeIsFree(route('distance'), started), false)
  assert.equal(routeIsFree(route('maps'), started), true)
  assert.equal(routeIsFree(route('repair'), started), true)
})

test('names fill in', () => {
  assert.equal(withName('What would {p} pick?', 'Sam'), 'What would Sam pick?')
})
