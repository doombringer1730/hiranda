import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, stripeConfigured } from '@/lib/billing'

// Finished coupons take a little off Plus: each one you mark done credits the
// couple's Stripe customer balance, which Stripe takes off the next renewal
// invoice automatically. Credit waiting on a renewal is capped, so it stays a
// small thank-you, not a currency.
export const COUPON_CREDIT_CENTS = 50
export const COUPON_CREDIT_CAP_CENTS = 200

/** Credit the couple for one finished coupon. Returns the cents credited (0 when not on Stripe Plus or at the cap). */
export async function creditFinishedCoupon(coupleId: string, couponId: string): Promise<number> {
  if (!stripeConfigured()) return 0
  const { data: plus } = await createAdminClient().from('couple_plus')
    .select('source, status, external_id').eq('couple_id', coupleId).maybeSingle()
  if (plus?.source !== 'stripe' || !['active', 'trialing', 'past_due'].includes(plus.status) || !plus.external_id?.startsWith('cus_')) return 0
  try {
    const stripe = getStripe()
    const customer = await stripe.customers.retrieve(plus.external_id)
    if (customer.deleted) return 0
    const waiting = Math.max(0, -(customer.balance ?? 0)) // a negative balance is credit
    const amount = Math.min(COUPON_CREDIT_CENTS, COUPON_CREDIT_CAP_CENTS - waiting)
    if (amount <= 0) return 0
    await stripe.customers.createBalanceTransaction(plus.external_id, {
      amount: -amount, currency: 'usd', description: 'Hiranda: a coupon finished together',
      metadata: { coupon_id: couponId, couple_id: coupleId },
    }, { idempotencyKey: `coupon-credit-${couponId}` })
    return amount
  } catch (e) {
    console.error('coupon credit failed', e)
    return 0
  }
}
