import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/push'

// Store plumbing that runs without a signed-in user (the Stripe webhook) or
// for the owner (admin). Uses the service role.

export function storeEnabled() {
  return process.env.STORE_ENABLED === '1' && !!process.env.STRIPE_SECRET_KEY
}

/** Emails allowed into /store/admin (comma-separated STORE_ADMIN_EMAILS). */
export function isStoreAdmin(email: string | null | undefined) {
  if (!email) return false
  const list = (process.env.STORE_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}

async function firstName(db: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await db.from('profiles').select('display_name').eq('id', id).maybeSingle()
  return data?.display_name?.split(' ')[0] || 'Your partner'
}

// Stripe says a gift was paid for: move it on and tell both ends.
export async function markGiftPaid(orderId: string, sessionId: string) {
  const db = createAdminClient()
  const { data: order } = await db.from('store_orders')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', orderId).eq('stripe_session_id', sessionId).eq('status', 'pending')
    .select('id, sender_id, recipient_id, title').maybeSingle()
  if (!order) return // already handled, or not ours

  const from = await firstName(db, order.sender_id)
  await notifyUser(order.recipient_id, {
    title: `🎁 ${from} sent you something`,
    body: 'It’s on its way — we’ll let you know when it ships.',
    url: '/',
    tag: `gift-${order.id}`,
  })

  // Let the shop owners know there's an order to fulfil.
  const admins = (process.env.STORE_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (admins.length) {
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
    for (const u of data?.users ?? []) {
      if (u.email && admins.includes(u.email.toLowerCase())) {
        await notifyUser(u.id, { title: 'New Hiranda Store order', body: order.title, url: '/store/admin', tag: 'store-admin' })
      }
    }
  }
}
