// Prints made from a couple's own memories: Polaroid-style prints and a
// hardcover photo book. Picked in Memories, which sends the couple to
// /store/print?kind=polaroids|book&photos=<photo id>,<photo id>,…
// (ids from the photos table, in order). Safe to import anywhere.

export type PrintKind = 'polaroids' | 'book'

export const PRINT_KINDS: Record<PrintKind, {
  /** The catalog product (lib/store/catalog.ts) that makes it. */
  productKey: string
  max: number
  title: (n: number) => string
  /** Price in cents for n photos. Keep it above Gelato's cost plus shipping. */
  priceCents: (n: number) => number
}> = {
  polaroids: {
    productKey: 'polaroids',
    max: 50,
    title: n => `${n} Polaroid print${n === 1 ? '' : 's'}`,
    // $5.99 + $1.29 a print: 10 prints ≈ $18.99.
    priceCents: n => endIn99(599 + n * 129),
  },
  book: {
    productKey: 'photo-book',
    max: 200,
    title: n => `Our photo book · ${n} photo${n === 1 ? '' : 's'}`,
    // One photo a page. $39.99 up to the 30-page minimum, then $0.99 a page.
    priceCents: n => endIn99(3999 + Math.max(0, n - BOOK_MIN_PAGES) * 99),
  },
}

/** Gelato's hardcover books start at 30 inner pages, in even counts. */
export const BOOK_MIN_PAGES = 30
export const bookPages = (photos: number) => {
  const n = Math.max(BOOK_MIN_PAGES, photos)
  return n % 2 ? n + 1 : n
}

const endIn99 = (cents: number) => Math.ceil(cents / 100) * 100 - 1

export const isPrintKind = (k: string | null | undefined): k is PrintKind => k === 'polaroids' || k === 'book'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** "id,id,…" → unique photo ids in the order given, at most `max`. */
export function parsePhotoIds(raw: string | null | undefined, max: number) {
  const ids = (raw ?? '').split(',').map(s => s.trim()).filter(s => UUID.test(s))
  return [...new Set(ids)].slice(0, max)
}
