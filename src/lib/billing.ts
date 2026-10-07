import 'server-only'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// Where Plus gets recorded. Each store tells us about a couple's
// subscription (Stripe via its webhook; Apple via RevenueCat's webhook or a
// sync right after purchase) and we mirror it into couple_plus with the
// service role. A founders' grant is never overwritten by a store.
//
// Env (Vercel):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY      — web checkout
//   REVENUECAT_SECRET_KEY, REVENUECAT_WEBHOOK_AUTH  — Apple (in-app purchase)
//   NEXT_PUBLIC_REVENUECAT_IOS_KEY                  — the app's public SDK key
//   SUPABASE_SERVICE_ROLE_KEY                       — to write couple_plus

export const PLUS_ENTITLEMENT = 'plus'

export function stripeConfigured() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY)
}

let stripe: Stripe | null = null
export function getStripe() {
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!)
  return stripe
}

type PlusRow = {
  couple_id: string
  source: 'apple' | 'stripe'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
  product: string | null
  current_period_end: string | null
  external_id: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function record(row: PlusRow) {
  if (!UUID.test(row.couple_id)) return
  const db = createAdminClient()
  const { data: existing } = await db.from('couple_plus').select('source').eq('couple_id', row.couple_id).maybeSingle()
  if (existing?.source === 'grant') return
  await db.from('couple_plus').upsert({ ...row, updated_at: new Date().toISOString() })
}

// ── Stripe ──

const STRIPE_STATUS: Record<string, PlusRow['status']> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'canceled',
}

export async function recordStripeSubscription(sub: Stripe.Subscription) {
  const coupleId = sub.metadata?.couple_id
  if (!coupleId) return
  const item = sub.items.data[0]
  // The period end lives on the item in newer Stripe API versions.
  const end = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end
  await record({
    couple_id: coupleId,
    source: 'stripe',
    status: STRIPE_STATUS[sub.status] ?? 'expired',
    product: item?.price?.id ?? null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    external_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
  })
}

// ── Apple, through RevenueCat (the app's user id there is the couple id) ──

export function revenueCatConfigured() {
  return !!process.env.REVENUECAT_SECRET_KEY
}

type Entitlement = { expires_date: string | null; product_identifier: string }

export async function syncApplePlus(coupleId: string) {
  if (!revenueCatConfigured() || !UUID.test(coupleId)) return
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${coupleId}`, {
    headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}` },
    cache: 'no-store',
  })
  if (!res.ok) return
  const body = (await res.json()) as { subscriber?: { entitlements?: Record<string, Entitlement> } }
  const ent = body.subscriber?.entitlements?.[PLUS_ENTITLEMENT]
  if (!ent) {
    // Nothing at Apple: only expire a row that Apple itself had granted.
    const db = createAdminClient()
    await db.from('couple_plus').update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('couple_id', coupleId).eq('source', 'apple')
    return
  }
  const active = !ent.expires_date || new Date(ent.expires_date) > new Date()
  await record({
    couple_id: coupleId,
    source: 'apple',
    status: active ? 'active' : 'expired',
    product: ent.product_identifier,
    current_period_end: ent.expires_date,
    external_id: coupleId,
  })
}
