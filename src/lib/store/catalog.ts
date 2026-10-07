// The Hiranda Store catalog — edit freely.
//
// 'made' gifts are sold by Hiranda through Stripe and fulfilled by you (or,
// later, a print/gift partner): you see paid orders at /store/admin with the
// recipient's address, ship them, and add tracking. Prices are in cents, USD.
// 'partner' gifts are affiliate links to other shops (no payment here).
//
// Nothing can be bought until STORE_ENABLED=1 and Stripe is configured, so
// set up your suppliers first.

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
}

export const PRODUCTS: Product[] = [
  {
    key: 'letter',
    title: 'A real letter in the mail',
    blurb: 'Write it here — we print it on thick cream paper, seal it, and mail it.',
    emoji: '💌',
    priceCents: 600,
    ships: true,
    fineprint: 'Hiranda prints your note to mail it, so we’ll see the words.',
  },
  {
    key: 'rose',
    title: 'A preserved rose & a card',
    blurb: 'One rose that lasts for years, with your note handwritten on the card.',
    emoji: '🌹',
    priceCents: 2800,
    ships: true,
  },
  {
    key: 'sweets',
    title: 'Something sweet',
    blurb: 'A small box of chocolates and a card in your words.',
    emoji: '🍫',
    priceCents: 2400,
    ships: true,
  },
  {
    key: 'care',
    title: 'A little care package',
    blurb: 'Tea, a candle, a cozy pair of socks — for the hard weeks apart.',
    emoji: '🧸',
    priceCents: 3800,
    ships: true,
  },
]

export const productByKey = (key: string) => PRODUCTS.find(p => p.key === key) ?? null

export type PartnerGift = { key: string; title: string; blurb: string; emoji: string; cta: string; url: string }

// Affiliate gifts from other shops (e.g. flowers delivered same-day). Add your
// affiliate links here; the section hides while this is empty.
export const PARTNER_GIFTS: PartnerGift[] = [
  // { key: 'flowers', title: 'Flowers, same day', blurb: 'Delivered across the country.', emoji: '💐', cta: 'Send flowers', url: 'https://…affiliate link…' },
]

/** Countries gifts can ship to for now. */
export const SHIP_TO = ['US'] as const

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
