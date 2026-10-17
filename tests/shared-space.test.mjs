// What the shared space accepts from the partner's devices. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanPlace, pickMeta, samePlace, roomFromPath, cleanTyping, cleanLove, describePlace } from '../src/lib/shared-space-state.ts'

test('places are checked and trimmed', () => {
  assert.deepEqual(cleanPlace({ room: 'memories', item: 'abc', label: 'Lisbon' }), { room: 'memories', item: 'abc', label: 'Lisbon' })
  assert.deepEqual(cleanPlace({ room: 'home' }), { room: 'home' })
  assert.equal(cleanPlace({ room: 'Memories!' }), null)
  assert.equal(cleanPlace({ room: '<img src=x>' }), null)
  assert.equal(cleanPlace({ room: 42 }), null)
  assert.equal(cleanPlace('memories'), null)
  assert.equal(cleanPlace(null), null)
  assert.equal(cleanPlace({ room: 'memories', label: 'x'.repeat(500) }).label.length, 120)
  assert.deepEqual(cleanPlace({ room: 'memories', item: 7, label: '' }), { room: 'memories' })
})

test('the partner on two devices: the one on screen wins, then the newest', () => {
  const phone = { place: { room: 'chat' }, visible: false, at: 300 }
  const laptop = { place: { room: 'memories', item: 'm1' }, visible: true, at: 100 }
  assert.equal(pickMeta([phone, laptop]).place.room, 'memories')
  assert.equal(pickMeta([{ ...laptop, visible: false }, phone]).place.room, 'chat')
  assert.equal(pickMeta([]), null)
  assert.equal(pickMeta(undefined), null)
  assert.equal(pickMeta(['junk', null]), null)
  const m = pickMeta([{ place: { room: 'nope!' }, visible: 'yes', at: 'soon', name: 'Sam' }])
  assert.deepEqual(m, { place: null, visible: false, at: 0, name: 'Sam' })
})

test('typing pings are checked', () => {
  assert.deepEqual(cleanTyping({ item: 'question:1', on: true }), { item: 'question:1', on: true })
  assert.equal(cleanTyping({ item: 'question:1', on: 'yes' }), null)
  assert.equal(cleanTyping({ item: '', on: true }), null)
  assert.equal(cleanTyping(null), null)
})

test('rooms come from the path', () => {
  assert.equal(roomFromPath('/'), 'home')
  assert.equal(roomFromPath('/memories/123'), 'memories')
  assert.equal(roomFromPath('/bucket-list'), 'bucket-list')
  assert.equal(roomFromPath('/Weird_Path'), 'home')
})

test('places compare by value; descriptions read naturally', () => {
  assert.equal(samePlace({ room: 'a', item: 'b' }, { room: 'a', item: 'b' }), true)
  assert.equal(samePlace({ room: 'a' }, { room: 'a', item: 'b' }), false)
  assert.equal(samePlace(null, null), true)
  assert.equal(describePlace({ room: 'memories' }), 'in Memories')
  assert.equal(describePlace({ room: 'memories', item: 'x', label: 'Lisbon' }), 'looking at “Lisbon”')
  assert.equal(describePlace({ room: 'new-thing' }), 'in new thing')
  assert.equal(describePlace(null), null)
})

test('hearts from the partner are checked', () => {
  assert.deepEqual(cleanLove({ at: 1760700000000 }), { at: 1760700000000 })
  assert.equal(cleanLove({ at: '1760700000000' }), null)
  assert.equal(cleanLove({ at: Infinity }), null)
  assert.equal(cleanLove({}), null)
  assert.equal(cleanLove(null), null)
})
