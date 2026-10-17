import 'server-only'
import { gelato } from './gelato'
import { printful } from './printful'
import type { Vendor, VendorName } from './types'

// Two print-on-demand suppliers: Printful (keepsakes with your names) and
// Gelato (the card, Polaroid prints and the photo book).
export const VENDORS: Record<VendorName, Vendor> = { gelato, printful }
export { VendorError } from './types'
export type { ShipTo, VendorSpec, VendorState } from './types'
