// Prints from memories: pricing, page counts and the photo list from the URL. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRINT_KINDS, bookPages, parsePhotoIds } from '../src/lib/store/prints.ts'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('prices end in .99 and grow with the photo count', () => {
  assert.equal(PRINT_KINDS.polaroids.priceCents(10), 1899)
  assert.equal(PRINT_KINDS.book.priceCents(12), 3999)
  assert.equal(PRINT_KINDS.book.priceCents(31), 4099)
  for (const k of ['polaroids', 'book']) assert.equal(PRINT_KINDS[k].priceCents(7) % 100, 99)
})

test('books have at least 30 pages, always an even count', () => {
  assert.equal(bookPages(1), 30)
  assert.equal(bookPages(31), 32)
  assert.equal(bookPages(200), 200)
})

test('photo ids: valid, unique, in order, capped', () => {
  assert.deepEqual(parsePhotoIds(`${id(2)},nope,${id(1)},${id(2)}`, 50), [id(2), id(1)])
  assert.equal(parsePhotoIds(Array.from({ length: 60 }, (_, i) => id(i)).join(','), 50).length, 50)
  assert.deepEqual(parsePhotoIds(undefined, 50), [])
})
