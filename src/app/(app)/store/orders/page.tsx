import Link from 'next/link'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/page-header'
import { EmptyState } from '@/components/ui'
import { coupleContext } from '@/lib/couple'
import { formatPrice } from '@/lib/store/catalog'
import { productLookup } from '@/lib/store/products'
import ProductThumb from '@/components/product-thumb'

export const metadata = { title: 'Gifts you’ve sent' }

const STATUS: Record<string, string> = {
  pending: 'Not paid', paid: 'Getting ready', fulfilling: 'Being made', shipped: 'Shipped',
  delivered: 'Arrived 💝', canceled: 'Canceled', refunded: 'Refunded',
}

export default async function OrdersPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const { data: orders } = await ctx.supabase.from('store_orders')
    .select('id, product_key, title, note, amount_cents, status, tracking_url, created_at, option')
    .eq('sender_id', ctx.user.id).neq('status', 'pending').order('created_at', { ascending: false }).limit(50)
  const product = await productLookup()

  return (
    <div className="px-4 pt-6 pb-12 max-w-lg mx-auto">
      <PageHeader eyebrow="Hiranda Store" title="Gifts you’ve sent" />
      <div className="mt-6 flex flex-col gap-3">
        {!orders?.length && <EmptyState title="No gifts yet." sub="Send something small — it means a lot from far away." href="/store" action="Open the store" />}
        {orders?.map(o => (
          <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
            <ProductThumb product={product(o.product_key)} />
            <div className="flex-1 min-w-0">
              <p className="text-stone-100 text-sm font-medium truncate">{o.title}{o.option ? ` · ${o.option}` : ''}</p>
              <p className="text-stone-500 text-xs">{new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatPrice(o.amount_cents)}</p>
            </div>
            <div className="text-right">
              <p className="text-amber-200 text-xs">{STATUS[o.status] ?? o.status}</p>
              {o.tracking_url && <a href={o.tracking_url} target="_blank" rel="noreferrer" className="text-stone-400 text-[11px] underline underline-offset-2">Track</a>}
            </div>
          </div>
        ))}
      </div>
      <Link href="/store" className="block text-center text-stone-500 hover:text-stone-300 text-sm mt-8">← Back to the store</Link>
    </div>
  )
}
