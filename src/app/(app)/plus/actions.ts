'use server'

import { headers } from 'next/headers'
import { coupleContext } from '@/lib/couple'
import { getStripe, stripeConfigured, syncApplePlus } from '@/lib/billing'
import { hasPlus, plusDetails } from '@/lib/plus'
import { PLUS_TRIAL_DAYS, type PlusPlan } from '@/lib/plus-config'

async function origin() {
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
}

// Web: Stripe Checkout for the couple. Never offered inside the iPhone app.
export async function startCheckout(plan: PlusPlan): Promise<{ url?: string; error?: string }> {
  if (!stripeConfigured()) return { error: 'Plus isn’t available to buy yet.' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Plus is for a couple — invite your partner first.' }
  if (await hasPlus()) return { error: 'You already have Plus.' }
  const price = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY! : process.env.STRIPE_PRICE_MONTHLY!
  const base = await origin()
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer_email: ctx.user.email ?? undefined,
    client_reference_id: ctx.couple.id,
    allow_promotion_codes: true,
    subscription_data: { trial_period_days: PLUS_TRIAL_DAYS, metadata: { couple_id: ctx.couple.id } },
    metadata: { couple_id: ctx.couple.id },
    success_url: `${base}/plus?welcome=1`,
    cancel_url: `${base}/plus`,
  })
  return session.url ? { url: session.url } : { error: 'Couldn’t open checkout — try again.' }
}

// Web: Stripe's page to change plan, update card or cancel.
export async function openBillingPortal(): Promise<{ url?: string; error?: string }> {
  if (!stripeConfigured()) return { error: 'Billing isn’t set up yet.' }
  const ctx = await coupleContext()
  if (!ctx) return { error: 'Not signed in' }
  const { data } = await ctx.supabase.from('couple_plus').select('source, external_id').eq('couple_id', ctx.couple.id).maybeSingle()
  if (data?.source !== 'stripe' || !data.external_id) return { error: 'This Plus wasn’t bought on the web.' }
  const portal = await getStripe().billingPortal.sessions.create({ customer: data.external_id, return_url: `${await origin()}/plus` })
  return { url: portal.url }
}

// App: after an Apple purchase or restore, read the truth from RevenueCat.
export async function syncApplePurchase(): Promise<{ active: boolean }> {
  const ctx = await coupleContext()
  if (!ctx) return { active: false }
  await syncApplePlus(ctx.couple.id)
  return { active: (await plusDetails()).active }
}
