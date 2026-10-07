import 'server-only'
import { cjDropshipping } from './cj'
import { gelato } from './gelato'
import { goody } from './goody'
import { printful } from './printful'
import { printify } from './printify'
import type { Vendor, VendorName } from './types'

export const VENDORS: Record<VendorName, Vendor> = { gelato, printful, printify, cj: cjDropshipping, goody }
export { VendorError } from './types'
export type { ShipTo, VendorSpec, VendorState } from './types'
