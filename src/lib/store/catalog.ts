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
// 'aliexpress' gifts are bought by hand on AliExpress for each paid order.
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
  /** Something the sender picks, like a size. */
  options?: ProductOptions
}

/** e.g. { name: 'Size', values: [{ label: 'M', vid: '…' }] } — `vid` picks the
 *  exact CJ variant; for partners the label is passed on with the order. */
export type ProductOptions = { name: string; kind?: SizeKind; values: { label: string; vid?: string }[] }

/** Which of the recipient's saved sizes a product uses (default 'top'). */
export type SizeKind = 'top' | 'bottom' | 'shoe'
export const SIZE_KINDS: { key: SizeKind; label: string; choices: string[] }[] = [
  { key: 'top', label: 'Tops & sets', choices: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { key: 'bottom', label: 'Bottoms', choices: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { key: 'shoe', label: 'Shoes (US)', choices: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'] },
]
/** "2XL" and "XXL" are the same size. */
export const sameSize = (a: string, b: string) => a.toUpperCase().replace(/^2XL$/, 'XXL') === b.toUpperCase().replace(/^2XL$/, 'XXL')

export type Category = 'her' | 'him' | 'cuddly' | 'jewelry' | 'cozy' | 'gift' | 'keepsake'

/** Where a gift ships from, as shoppers see it: printed or stocked in the US,
 *  or sent internationally (slower, more choice). */
export const shipsFrom = (p: Pick<Product, 'vendor'>): 'US' | 'International' =>
  (p.vendor?.name === 'cj' && p.vendor.from === 'CN') || p.vendor?.name === 'aliexpress' ? 'International' : 'US'

/** The partner shop that makes it, if any — credited on the product. */
export const madeBy = (p: Pick<Product, 'vendor'>) => p.vendor?.name === 'partner' ? p.vendor.partner : null

/** Store sections, in order. */
export const CATEGORIES: { key: Category; title: string }[] = [
  { key: 'her', title: 'For her' },
  { key: 'him', title: 'For him' },
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
    image: '/store/mockups/letter.jpg',
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
    image: '/store/mockups/blanket.jpg',
    priceCents: 7900, // ≈ $36 + ~$11 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    // Printful's area is 7950×9450 (with wrap); same shape at 80% keeps the
    // render light, and Printful scales it to cover.
    vendor: { name: 'printful', variantId: 17482, placement: 'default', art: { w: 6360, h: 7560 } },
  },
  {
    key: 'mug',
    title: 'Our mug',
    blurb: 'Your names on a glossy 11 oz mug, for the morning question.',
    emoji: '☕',
    image: '/store/mockups/mug.jpg',
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
    image: '/store/mockups/print.jpg',
    priceCents: 2900, // ≈ $11 + ~$7 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 1349, placement: 'default', art: { w: 3600, h: 4800 } },
  },
  {
    key: 'framed',
    title: 'Our names, framed',
    blurb: 'A 12″×16″ museum-matte print in a black wooden frame, ready to hang.',
    emoji: '🖼️',
    image: '/store/mockups/framed.jpg',
    priceCents: 7900, // ≈ $32 + ~$11 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 1350, placement: 'default', art: { w: 3600, h: 4800 } },
  },
  {
    key: 'canvas',
    title: 'Our names on canvas',
    blurb: 'A gallery-wrapped 11″×14″ canvas for the wall you share — or will.',
    emoji: '🖼️',
    image: '/store/mockups/canvas.jpg',
    priceCents: 5900, // ≈ $17 + ~$10 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 19298, placement: 'default', art: { w: 5100, h: 4200 } },
  },
  {
    key: 'pillow',
    title: 'Our pillow',
    blurb: 'A soft 18″×18″ premium pillow with your names, stuffing included.',
    emoji: '🛏️',
    image: '/store/mockups/pillow.jpg',
    priceCents: 5900, // ≈ $19 + ~$11 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 9515, placement: 'front', art: { w: 2850, h: 2850 } },
  },
  {
    key: 'ornament',
    title: 'Our heart ornament',
    blurb: 'A glossy ceramic heart with your names, to hang somewhere you’ll see it.',
    emoji: '🤍',
    image: '/store/mockups/ornament.jpg',
    priceCents: 2900, // ≈ $8 + ~$6 shipping
    ships: true,
    category: 'keepsake',
    fineprint: 'Printed with both your first names and the year you got together.',
    vendor: { name: 'printful', variantId: 23144, placement: 'front', art: { w: 978, h: 972 } },
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
