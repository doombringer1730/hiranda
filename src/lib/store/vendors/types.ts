// What every gift supplier (Gelato, CJ Dropshipping, Goody) implements.

export type VendorName = 'gelato' | 'cj' | 'goody' | 'printful' | 'printify'

/** How a catalog product is made. Empty ids mean "not picked yet": the
 *  product is then fulfilled by hand from /store/admin. */
export type VendorSpec =
  | { name: 'gelato'; productUid: string }
  // `from`: CJ's US warehouse (days) or international, 'CN' (1–2 weeks, far more choice).
  | { name: 'cj'; items: { vid: string; quantity: number }[]; from?: 'US' | 'CN' }
  | { name: 'goody'; productId: string; variants?: string[] }
  // Print on demand with the couple's names design (see /api/store/print),
  // rendered at `art` pixels — match the product's print area.
  | { name: 'printful'; variantId: number; placement: string; art: ArtSize }
  | { name: 'printify'; blueprintId: number; printProviderId: number; variantId: number; position: string; art: ArtSize }
  // A partner shop (e.g. on Etsy) makes and ships it: paid orders show up in
  // /store/admin with a link to place the order with them.
  | { name: 'partner'; partner: string; url?: string }

export type ArtSize = { w: number; h: number }

/** The recipient's delivery address, read with the service role. */
export type ShipTo = {
  firstName: string
  lastName: string
  line1: string
  line2: string | null
  city: string
  /** Two-letter state code for the US. */
  region: string | null
  postalCode: string
  country: string
  phone: string | null
}

export type VendorOrder = {
  /** Our store_orders id — sent as the supplier's order reference. */
  id: string
  note: string | null
  senderFirst: string
  recipientFirst: string
}

/** Where a supplier says the order is. `problem` is shown to the owner. */
export type VendorState = {
  status: 'fulfilling' | 'shipped' | 'delivered'
  trackingUrl?: string | null
  problem?: string | null
}

export interface Vendor {
  name: VendorName
  label: string
  /** Keys are set. */
  configured(): boolean
  /** Sandbox / draft mode: nothing is made or charged. */
  testMode(): boolean
  /** Is this spec filled in enough to order? */
  ready(spec: VendorSpec): boolean
  /** Hand the order over; returns the supplier's order id. */
  submit(order: VendorOrder, spec: VendorSpec, to: ShipTo): Promise<string>
  /** Ask the supplier where an order is. */
  status(vendorOrderId: string): Promise<VendorState>
  /** Check the keys work; returns a short description of the account. */
  ping(): Promise<string>
  /** Register our tracking webhook through the supplier's API, if it has one. */
  connectWebhook?(): Promise<string>
}

export class VendorError extends Error {}
