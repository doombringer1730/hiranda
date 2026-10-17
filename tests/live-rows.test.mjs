// Applying realtime changes to a list. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyChanges, reconcile, sameRow } from '../src/lib/live-rows.ts'

const byTime = (a, b) => a.created_at.localeCompare(b.created_at)
const msg = (id, t, body = id) => ({ id, created_at: `2026-10-17T10:00:0${t}Z`, body })
const start = () => [msg('a', 1), msg('b', 2), msg('c', 3)]

test('a new row is appended, and the rows already there keep their identity', () => {
  const rows = start()
  const out = applyChanges(rows, [{ type: 'INSERT', row: msg('d', 4) }], byTime)
  assert.deepEqual(out.map(r => r.id), ['a', 'b', 'c', 'd'])
  for (let i = 0; i < 3; i++) assert.equal(out[i], rows[i])
})

test('a late-arriving row lands in time order', () => {
  const out = applyChanges([msg('a', 1), msg('c', 5)], [{ type: 'INSERT', row: msg('b', 3) }], byTime)
  assert.deepEqual(out.map(r => r.id), ['a', 'b', 'c'])
})

test('an edited row is replaced; only that row is a new object', () => {
  const rows = start()
  const edited = { ...rows[1], body: 'edited' }
  const out = applyChanges(rows, [{ type: 'UPDATE', row: edited }], byTime)
  assert.notEqual(out, rows)
  assert.equal(out[0], rows[0])
  assert.equal(out[1], edited)
  assert.equal(out[2], rows[2])
})

test('a deleted row is removed', () => {
  const out = applyChanges(start(), [{ type: 'DELETE', id: 'b' }], byTime)
  assert.deepEqual(out.map(r => r.id), ['a', 'c'])
})

test('nothing changed → the same array (so React skips the render)', () => {
  const rows = start()
  // a delete from another space, an echo of a row we have, an update to an unloaded row
  const out = applyChanges(rows, [
    { type: 'DELETE', id: 'someone-elses' },
    { type: 'INSERT', row: { ...rows[0] } },
    { type: 'UPDATE', row: { ...rows[2] } },
    { type: 'UPDATE', row: msg('old', 0) },
  ], byTime)
  assert.equal(out, rows)
})

test('a burst is applied in one pass, in order', () => {
  const rows = start()
  const out = applyChanges(rows, [
    { type: 'INSERT', row: msg('d', 4) },
    { type: 'UPDATE', row: msg('d', 4, 'fixed typo') },
    { type: 'DELETE', id: 'a' },
    { type: 'INSERT', row: msg('e', 5) },
    { type: 'DELETE', id: 'e' },
  ], byTime)
  assert.deepEqual(out.map(r => [r.id, r.body]), [['b', 'b'], ['c', 'c'], ['d', 'fixed typo']])
  assert.deepEqual(rows.map(r => r.id), ['a', 'b', 'c'], 'input untouched')
})

test('an insert for a row we already have acts as an update (refetch raced the event)', () => {
  const rows = start()
  const out = applyChanges(rows, [{ type: 'INSERT', row: msg('b', 2, 'newer') }], byTime)
  assert.deepEqual(out.map(r => r.body), ['a', 'newer', 'c'])
})

test('an edit that changes the sort key moves the row', () => {
  const out = applyChanges(start(), [{ type: 'UPDATE', row: msg('a', 9) }], byTime)
  assert.deepEqual(out.map(r => r.id), ['b', 'c', 'a'])
})

test('sameRow compares one level deep', () => {
  assert.equal(sameRow({ a: 1, b: null }, { b: null, a: 1 }), true)
  assert.equal(sameRow({ a: 1 }, { a: 1, b: 2 }), false)
  assert.equal(sameRow({ a: 1 }, { a: 2 }), false)
})

test('a refetch that finds nothing new keeps the same array', () => {
  const rows = start()
  assert.equal(reconcile(rows, start()), rows)
})

test('a refetch keeps unchanged rows and swaps in the changed ones', () => {
  const rows = start()
  const fresh = [msg('a', 1), msg('b', 2, 'edited'), msg('c', 3), msg('d', 4)]
  const out = reconcile(rows, fresh)
  assert.equal(out[0], rows[0])
  assert.equal(out[1], fresh[1])
  assert.equal(out[2], rows[2])
  assert.equal(out[3], fresh[3])
  assert.equal(reconcile(null, fresh), fresh)
  assert.deepEqual(reconcile(rows, [rows[0], rows[2]]).map(r => r.id), ['a', 'c'])
})
