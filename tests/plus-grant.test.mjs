// Which store updates may overwrite a Plus grant. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storeMayReplace, givesPlus } from '../src/lib/plus-grant.ts'

const now = new Date('2026-10-17T12:00:00Z')
const later = '2026-12-01T00:00:00Z'
const earlier = '2026-10-01T00:00:00Z'

const grant = (end, status = 'active') => ({ source: 'grant', status, current_period_end: end })
const store = (status, end = later, source = 'stripe') => ({ source, status, current_period_end: end })

test('a forever grant is never replaced by a store', () => {
  for (const s of ['active', 'trialing', 'past_due', 'canceled', 'expired']) {
    assert.equal(storeMayReplace(grant(null), store(s), now), false, s)
    assert.equal(storeMayReplace(grant(null), store(s, null, 'apple'), now), false, s)
  }
})

test('a running timed grant gives way to a subscription that gives Plus', () => {
  assert.equal(storeMayReplace(grant(later), store('active'), now), true)
  assert.equal(storeMayReplace(grant(later), store('trialing'), now), true)
  assert.equal(storeMayReplace(grant(later), store('past_due'), now), true)
  assert.equal(storeMayReplace(grant(later), store('active', null, 'apple'), now), true)
})

test('a running timed grant is not erased by an ended subscription', () => {
  assert.equal(storeMayReplace(grant(later), store('canceled'), now), false)
  assert.equal(storeMayReplace(grant(later), store('expired'), now), false)
  // "Restore purchases" finding an old Apple purchase that already ran out
  assert.equal(storeMayReplace(grant(later), store('expired', earlier, 'apple'), now), false)
  // says active, but its period is already over
  assert.equal(storeMayReplace(grant(later), store('active', earlier), now), false)
})

test('an ended or switched-off grant can be replaced by anything', () => {
  assert.equal(storeMayReplace(grant(earlier), store('expired'), now), true)
  assert.equal(storeMayReplace(grant(earlier), store('active'), now), true)
  assert.equal(storeMayReplace(grant(null, 'expired'), store('active'), now), true)
  assert.equal(storeMayReplace(grant(later, 'canceled'), store('canceled'), now), true)
})

test('store rows and no row at all are always replaceable', () => {
  assert.equal(storeMayReplace(null, store('expired'), now), true)
  assert.equal(storeMayReplace(store('active'), store('canceled'), now), true)
  assert.equal(storeMayReplace(store('active', later, 'apple'), store('expired', earlier, 'apple'), now), true)
})

test('the grant ending is the boundary', () => {
  const end = now.toISOString()
  assert.equal(givesPlus(grant(end), now), false)
  assert.equal(storeMayReplace(grant(end), store('expired'), now), true)
  assert.equal(storeMayReplace(grant(end), store('expired'), new Date(now.getTime() - 1)), false)
})
