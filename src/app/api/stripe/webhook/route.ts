import type Stripe from 'stripe'
import { getStripe, recordStripeSubscription, stripeConfigured } from '@/lib/billing'

// Stripe → Hiranda Plus. Configure in Stripe → Developers → Webhooks with
// this URL and the events below; put the signing secret in STRIPE_WEBHOOK_SECRET.
const EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeConfigured() || !secret) return new Response('Not configured', { status: 503 })

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return new Response('Bad signature', { status: 400 })
  }
  if (!EVENTS.has(event.type)) return Response.json({ ok: true })

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.subscription) {
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        await recordStripeSubscription(await stripe.subscriptions.retrieve(id))
      }
    } else {
      await recordStripeSubscription(event.data.object as Stripe.Subscription)
    }
  } catch {
    return new Response('Failed', { status: 500 }) // Stripe retries
  }
  return Response.json({ ok: true })
}
