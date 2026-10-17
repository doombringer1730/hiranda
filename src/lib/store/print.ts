import 'server-only'
import { siteUrl } from './vendors/contact'
import { VendorError } from './vendors/types'
import { SUPPLIER_TTL, signPrint, verifyPrint } from './print-sign'

// Signed links to a gift's print files, for print partners (Gelato) to fetch.
// Only someone holding the link can read the note printed on the card, and
// only until it expires (print-sign.ts): 30 days for suppliers by default.

// 'front'/'back': the A5 gift card. 'design': the couple's names artwork for
// print-on-demand products, at a size the product asks for. 'photo-<n>': the
// order's nth photo as a Polaroid-style print. 'book': the photo book as one
// PDF (cover, then pages).
export type PrintSide = 'front' | 'back' | 'design' | 'book' | `photo-${number}`
export const MAX_ART = 9000

// Its own key: links never reuse (or reveal anything about) the service role.
const printKey = () => process.env.STORE_PRINT_SECRET ?? ''

/** Can links be made? (STORE_PRINT_SECRET is set and long enough.) */
export const printLinksReady = () => printKey().length >= 32

/** A link to one print file, good for `ttl` seconds (30 days by default). */
export function printFileUrl(orderId: string, side: PrintSide, art?: { w: number; h: number }, ttl = SUPPLIER_TTL) {
  if (!printLinksReady()) throw new VendorError('Set STORE_PRINT_SECRET in Vercel (32+ random characters) — print files need it')
  const size = art ? `${Math.round(art.w)}x${Math.round(art.h)}` : ''
  const exp = Math.floor(Date.now() / 1000) + ttl
  return `${siteUrl()}/api/store/print/${orderId}?side=${side}${size ? `&size=${size}` : ''}&exp=${exp}&sig=${signPrint(printKey(), orderId, side, size, exp)}`
}

export function printSignatureOk(orderId: string, side: string, size: string, exp: string | null, sig: string | null) {
  const current = printLinksReady() ? printKey() : ''
  // Links from before expiries were signed with whichever key was set then.
  const legacy = [process.env.STORE_PRINT_SECRET ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '']
  return verifyPrint({ current, legacy }, { orderId, side, size, exp, sig })
}
