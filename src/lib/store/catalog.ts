// The Hiranda Store catalog — edit freely.
//
// Gifts are sold by Hiranda through Stripe. A gift with a `vendor` is sent to
// that supplier automatically once paid (see lib/store/fulfil.ts). The ones
// here are built in; more are added from /store/admin/catalog (the
// store_products table, merged in by lib/store/products.ts). A gift without one — or whose
// ids are still empty — shows up in /store/admin for you to ship by hand.
// Prices are in cents, USD. Keep each price above the supplier's cost plus
// shipping plus Stripe's fee (~3%).
// 'partner' gifts are affiliate links to other shops (no payment here).
//
// Nothing can be bought until STORE_ENABLED=1 and Stripe is configured.

import type { VendorSpec } from './vendors/types'

export type Product = {
  key: string
  title: string
  blurb: string
  emoji: string
  priceCents: number
  /** Ships to the recipient's saved address. */
  ships: true
  /** Shown to the buyer before paying. */
  fineprint?: string
  /** Who makes and ships it. Omit to ship it yourself. */
  vendor?: VendorSpec
  /** Which Store section it's shown in (default 'gift'). */
  category?: Category
  /** A product photo (https) — shown instead of the emoji. */
  image?: string
  /** e.g. "Arrives in about 1–2 weeks". */
  delivery?: string
}

export type Category = 'cuddly' | 'jewelry' | 'cozy' | 'gift' | 'keepsake'

/** Where a gift ships from, as shoppers see it: printed or stocked in the US,
 *  or sent internationally (slower, more choice). */
export const shipsFrom = (p: Pick<Product, 'vendor'>): 'US' | 'International' =>
  p.vendor?.name === 'cj' && p.vendor.from === 'CN' ? 'International' : 'US'

/** Store sections, in order. */
export const CATEGORIES: { key: Category; title: string }[] = [
  { key: 'gift', title: 'Little gifts' },
  { key: 'cuddly', title: 'Something to hug' },
  { key: 'jewelry', title: 'To wear and think of you' },
  { key: 'cozy', title: 'Cozy days apart' },
  { key: 'keepsake', title: 'Keepsakes with your names' },
]

// Built-in gifts. Most of the Store now comes from /store/admin/catalog.
// (Sweets via Goody can come back here once Goody approves direct send:
//   vendor: { name: 'goody', productId: '<id from the Suppliers page>' }.)
export const PRODUCTS: Product[] = [
  {
    key: 'letter',
    title: 'A card in the mail',
    blurb: 'Write it here — we print it in handwriting on a thick A5 card and mail it.',
    emoji: '💌',
    priceCents: 900,
    ships: true,
    fineprint: 'Our print partner prints your note, so they’ll see the words.',
    // A5 flat card, 350 gsm silk, printed both sides (front: "for <name>", back: your note).
    vendor: { name: 'gelato', productUid: 'cards_pf_a5_pt_350-gsm-coated-silk_cl_4-4_ver' },
  },
  // Keepsakes — printed by Printful with both your first names and the year
  // you got together (see /api/store/print). Printful cost (Oct 2026) +
  // ~US shipping noted per item; keep prices well above it.
  {
    key: 'blanket',
    title: 'Our blanket',
    blurb: 'A soft sherpa throw (50″×60″) with your two names on it — for movie nights, together or apart.',
    emoji: '🛋️',
    priceCents: 7900, // ≈ $36 + ~$11 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 17482, placement: 'default', art: { w: 6000, h: 7200 } },
  },
  {
    key: 'mug',
    title: 'Our mug',
    blurb: 'Your names on a glossy 11 oz mug, for the morning question.',
    emoji: '☕',
    priceCents: 2400, // ≈ $6 + ~$8 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 1320, placement: 'default', art: { w: 2700, h: 1050 } },
  },
  {
    key: 'print',
    title: 'Our names, on the wall',
    blurb: 'A 12″×16″ matte print with your names and your year — ready for a frame.',
    emoji: '🖼️',
    priceCents: 2900, // ≈ $11 + ~$7 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 1349, placement: 'default', art: { w: 3600, h: 4800 } },
  },
]

/** A built-in product (server code should use lib/store/products.ts, which
 *  also knows the ones added from the admin catalog). */
export const builtInProduct = (key: string) => PRODUCTS.find(p => p.key === key) ?? null

export type PartnerGift = { key: string; title: string; blurb: string; emoji: string; cta: string; url: string }

// Affiliate gifts from other shops (e.g. flowers delivered same-day). Add your
// affiliate links here; the section hides while this is empty.
export const PARTNER_GIFTS: PartnerGift[] = [
  // { key: 'flowers', title: 'Flowers, same day', blurb: 'Delivered across the country.', emoji: '💐', cta: 'Send flowers', url: 'https://…affiliate link…' },
]

/** Countries gifts can ship to for now. */
export const SHIP_TO = ['US'] as const

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
