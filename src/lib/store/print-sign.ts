import { createHmac, timingSafeEqual } from 'node:crypto'

// Signing and checking print-file links (print.ts builds them, the
// /api/store/print route checks them). Pure apart from the hash, so tests can
// run it with their own keys and clock.
//
// A link is good for orderId + side + size until `exp` (unix seconds), and
// only with the key in STORE_PRINT_SECRET. Older links had no expiry and were
// signed with SUPABASE_SERVICE_ROLE_KEY when STORE_PRINT_SECRET wasn't set;
// they keep working until LEGACY_UNTIL so gifts already with suppliers can
// still be printed, then stop.

export const SUPPLIER_TTL = 30 * 86_400 // seconds: print partners may fetch files days later
export const ADMIN_TTL = 60 * 60 // the admin page's links: an hour is plenty
const MAX_TTL = 31 * 86_400 // no valid link is ever longer-lived than this
export const LEGACY_UNTIL = Date.parse('2026-12-01T00:00:00Z')

const SIDE = /^(front|back|design|book|photo-\d{1,3})$/
const EXP = /^\d{1,12}$/

const hmac = (key: string, msg: string) => createHmac('sha256', key).update(msg).digest('hex').slice(0, 40)

export const signPrint = (key: string, orderId: string, side: string, size: string, exp: number) =>
  hmac(key, `print:v2:${orderId}:${side}:${size}:${exp}`)

const signLegacy = (key: string, orderId: string, side: string, size: string) =>
  hmac(key, `print:${orderId}:${side}:${size}`)

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export type PrintKeys = { current: string; legacy: string[] }

export function verifyPrint(
  keys: PrintKeys,
  link: { orderId: string; side: string; size: string; exp: string | null; sig: string | null },
  now = Date.now(),
) {
  const { orderId, side, size, exp, sig } = link
  if (!sig || !SIDE.test(side)) return false

  if (exp !== null) {
    if (!keys.current || !EXP.test(exp)) return false
    const ms = Number(exp) * 1000
    if (ms < now || ms > now + MAX_TTL * 1000) return false
    return same(signPrint(keys.current, orderId, side, size, Number(exp)), sig)
  }

  // A link from before expiries existed.
  if (now >= LEGACY_UNTIL) return false
  return keys.legacy.filter(Boolean).some(k => same(signLegacy(k, orderId, side, size), sig))
}
