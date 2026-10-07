import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { siteUrl } from './vendors/contact'
import { VendorError } from './vendors/types'

// Signed links to a gift's print files, for print partners (Gelato) to fetch.
// Only someone holding the link can read the note printed on the card.

// 'front'/'back': the A5 gift card. 'design': the couple's names artwork for
// print-on-demand products, at a size the product asks for.
export type PrintSide = 'front' | 'back' | 'design'
export const MAX_ART = 9000

const secret = () => process.env.STORE_PRINT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const sign = (orderId: string, side: string, size: string) =>
  createHmac('sha256', secret()).update(`print:${orderId}:${side}:${size}`).digest('hex').slice(0, 40)

export function printFileUrl(orderId: string, side: PrintSide, art?: { w: number; h: number }) {
  if (!secret()) throw new VendorError('Set SUPABASE_SERVICE_ROLE_KEY (or STORE_PRINT_SECRET) in Vercel — print files need it')
  const size = art ? `${Math.round(art.w)}x${Math.round(art.h)}` : ''
  return `${siteUrl()}/api/store/print/${orderId}?side=${side}${size ? `&size=${size}` : ''}&sig=${sign(orderId, side, size)}`
}

export function printSignatureOk(orderId: string, side: string, size: string, sig: string | null) {
  if (!secret() || !sig || !['front', 'back', 'design'].includes(side)) return false
  const want = Buffer.from(sign(orderId, side, size))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}
