// Home screen layout rules. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLayout, nextSize, moveItem, DEFAULT_LAYOUT, WIDGETS } from '../src/lib/home-widgets.ts'

test('no saved layout means the default Home', () => {
  assert.deepEqual(normalizeLayout(null), DEFAULT_LAYOUT)
  assert.deepEqual(normalizeLayout('nope'), DEFAULT_LAYOUT)
})

test('the default Home only uses real widgets at sizes they have', () => {
  for (const i of DEFAULT_LAYOUT) assert.ok(WIDGETS[i.id].sizes.includes(i.size), i.id)
})

test('saved layouts drop unknown widgets and repeats, and fix bad sizes', () => {
  assert.deepEqual(
    normalizeLayout([
      { id: 'question', size: 'l' },
      { id: 'rocket', size: 's' },
      { id: 'question', size: 'm' },
      { id: 'heart', size: 'l' }, // heart only comes small
      null,
      { id: 'photos' },
    ]),
    [{ id: 'question', size: 'l' }, { id: 'heart', size: 's' }, { id: 'photos', size: 's' }],
  )
  assert.deepEqual(normalizeLayout([]), [])
})

test('the size button cycles through a widget’s sizes', () => {
  assert.equal(nextSize('memory', 's'), 'm')
  assert.equal(nextSize('memory', 'm'), 'l')
  assert.equal(nextSize('memory', 'l'), 's')
  assert.equal(nextSize('watching', 'm'), 'm')
})

test('moving a widget keeps everything else in order', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(moveItem(['a', 'b'], 1, 9), ['a', 'b'])
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b'])
})
