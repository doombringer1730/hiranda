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
      { id: 'heart', size: 'l' }, // heart has no large size
      null,
      { id: 'photos' },
    ]),
    [{ id: 'question', size: 'l' }, { id: 'heart', size: 's' }, { id: 'photos', size: 's' }],
  )
  assert.deepEqual(normalizeLayout([]), [])
})

test('the default Home is the original one, Polaroid included', () => {
  assert.deepEqual(DEFAULT_LAYOUT.filter(i => i.size === 'w').map(i => i.id), ['moves', 'question', 'talk', 'memory', 'flame', 'watching'])
})

test('the size button cycles through a widget’s sizes', () => {
  assert.equal(nextSize('memory', 's'), 'm')
  assert.equal(nextSize('memory', 'm'), 'l')
  assert.equal(nextSize('memory', 'l'), 'w')
  assert.equal(nextSize('memory', 'w'), 's')
  assert.equal(nextSize('memory', 'l', ['calendar']), 's') // a stack can't go Full
  assert.equal(nextSize('watching', 'm'), 'w')
  assert.equal(nextSize('watching', 'w'), 'm')
  assert.equal(nextSize('heart', 's'), 'm')
})

test('moving a widget keeps everything else in order', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(moveItem(['a', 'b'], 1, 9), ['a', 'b'])
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b'])
})

test('stacks keep each widget once, only at a size they all have, and tints are checked', () => {
  assert.deepEqual(
    normalizeLayout([
      { id: 'calendar', size: 's', tint: 'rose', stack: ['countdown', 'question', 'calendar', 'nope', 'days'] },
      { id: 'days', size: 's' }, // already in the stack
      { id: 'song', size: 's', tint: 'neon' },
    ]),
    [
      { id: 'calendar', size: 's', tint: 'rose', stack: ['countdown', 'days'] },
      { id: 'song', size: 's' },
    ],
  )
})

test('full-width cards fit like the original Home and never stack', () => {
  assert.deepEqual(normalizeLayout([{ id: 'question', size: 'w', stack: ['talk'] }, { id: 'talk', size: 'w' }]),
    [{ id: 'question', size: 'w' }, { id: 'talk', size: 'w' }])
  assert.deepEqual(normalizeLayout([{ id: 'calendar', size: 'w' }]), [{ id: 'calendar', size: 's' }]) // calendar has no full size
  assert.equal(nextSize('flame', 'm', ['days']), 's') // a stack skips Full
})
