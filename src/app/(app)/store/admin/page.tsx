import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Truck } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPrice, productByKey } from '@/lib/store/catalog'
import { isStoreAdmin } from '@/lib/store/server'
import { supplierFor } from '@/lib/store/fulfil'
import { VENDORS } from '@/lib/store/vendors'
import OrderActions from './order-actions'

export const metadata = { title: 'Store orders' }

// The shop owner's fulfilment queue (STORE_ADMIN_EMAILS only). Shows each
// paid gift with the recipient's delivery address and the sender's note.
export default async function StoreAdminPage() {
  const ctx = await coupleContext()
  if (!ctx || !isStoreAdmin(ctx.user.email)) notFound()

  const db = createAdminClient()
  const { data: orders } = await db.from('store_orders')
    .select('id, product_key, title, note, amount_cents, status, tracking_url, created_at, recipient_id, vendor, vendor_order_id, vendor_error')
    .in('status', ['paid', 'fulfilling', 'shipped']).order('created_at', { ascending: true }).limit(100)
  const ids = [...new Set((orders ?? []).map(o => o.recipient_id))]
  const { data: addresses } = ids.length
    ? await db.from('store_addresses').select('user_id, full_name, line1, line2, city, region, postal_code, country, phone').in('user_id', ids)
    : { data: [] }
  const addressOf = new Map((addresses ?? []).map(a => [a.user_id, a]))

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="Hiranda Store" title="Orders to ship" />
        <Link href="/store/admin/suppliers" className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-stone-800 px-3 h-9 text-xs text-stone-300 hover:bg-stone-700"><Truck size={14} /> Suppliers</Link>
      </div>
      <p className="text-stone-500 text-sm mt-2 mb-6">Oldest first. Gifts with a supplier go out on their own; the rest you ship. Refunds happen in your Stripe dashboard.</p>
      {!orders?.length && <p className="text-stone-500 text-sm py-12 text-center">Nothing to ship right now.</p>}
      <div className="flex flex-col gap-4">
        {orders?.map(o => {
          const a = addressOf.get(o.recipient_id)
          const supplier = o.vendor ? VENDORS[o.vendor as keyof typeof VENDORS] : supplierFor(o.product_key)?.vendor
          return (
            <div key={o.id} className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">{productByKey(o.product_key)?.emoji ?? '🎁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-stone-100 font-medium">{o.title}</p>
                  <p className="text-stone-500 text-xs">{new Date(o.created_at).toLocaleString()} · {formatPrice(o.amount_cents)} · {o.status}</p>
                </div>
              </div>
              {supplier && (
                <p className="text-xs text-stone-400">
                  {o.vendor_order_id ? <>Sent to <span className="text-stone-200">{supplier.label}</span> · {o.vendor_order_id}</> : <>Made by <span className="text-stone-200">{supplier.label}</span> · not sent yet</>}
                </p>
              )}
              {o.vendor_error && <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{o.vendor_error}</p>}
              {o.note && <p className="paper rounded-[4px] px-3 py-2 font-hand text-[19px] text-[var(--paper-ink)] whitespace-pre-wrap">{o.note}</p>}
              <div className="text-sm text-stone-300 leading-snug">
                {a ? (<>
                  <p>{a.full_name}</p><p>{a.line1}</p>{a.line2 && <p>{a.line2}</p>}
                  <p>{a.city}{a.region ? `, ${a.region}` : ''} {a.postal_code} · {a.country}</p>
                  {a.phone && <p className="text-stone-500">{a.phone}</p>}
                </>) : <p className="text-red-400">No address on file — the recipient removed it.</p>}
              </div>
              <OrderActions id={o.id} status={o.status} tracking={o.tracking_url}
                supplier={supplier?.label ?? null} sent={!!o.vendor_order_id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
