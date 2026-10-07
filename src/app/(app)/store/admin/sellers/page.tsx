import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Mail } from 'lucide-react'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { createAdminClient } from '@/lib/supabase/admin'
import { isStoreAdmin } from '@/lib/store/server'
import { StatusButtons } from './status-buttons'

export const metadata = { title: 'Seller applications' }

const PRICE: Record<string, string> = { 'under-25': 'Under $25', '25-50': '$25–50', '50-100': '$50–100', '100-plus': '$100+' }
const BADGE: Record<string, string> = {
  new: 'bg-amber-900/50 text-amber-200', contacted: 'bg-stone-800 text-stone-300',
  approved: 'bg-emerald-900/50 text-emerald-200', declined: 'bg-stone-900 text-stone-500',
}

// Businesses that applied at /sell, newest first (STORE_ADMIN_EMAILS only).
export default async function SellersPage() {
  const ctx = await coupleContext()
  if (!ctx || !isStoreAdmin(ctx.user.email)) notFound()
  const { data: apps } = await createAdminClient().from('seller_applications')
    .select('id, created_at, business_name, contact_name, email, website, what_you_sell, price_range, ships_from, status')
    .order('created_at', { ascending: false }).limit(200)

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <Link href="/store/admin" className="inline-flex items-center gap-1.5 text-stone-400 text-sm mb-3 hover:text-stone-200"><ArrowLeft size={15} /> Orders</Link>
      <PageHeader eyebrow="Sell on Hiranda" title="Seller applications" />
      <p className="text-stone-500 text-sm mt-2 mb-6">
        From your public page, <Link href="/sell" className="text-amber-400 underline underline-offset-4">/sell</Link> — share it with shops you’d love to have.
      </p>
      {!apps?.length && <p className="text-stone-500 text-sm py-12 text-center">No applications yet.</p>}
      <div className="flex flex-col gap-4">
        {apps?.map(a => (
          <div key={a.id} className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-stone-100 font-medium">{a.business_name}</p>
                <p className="text-stone-500 text-xs">{a.contact_name} · {new Date(a.created_at).toLocaleDateString()}{a.ships_from ? ` · ${a.ships_from}` : ''}{a.price_range ? ` · ${PRICE[a.price_range] ?? a.price_range}` : ''}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] ${BADGE[a.status] ?? BADGE.new}`}>{a.status}</span>
            </div>
            <p className="text-sm text-stone-300 whitespace-pre-wrap">{a.what_you_sell}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href={`mailto:${a.email}?subject=${encodeURIComponent('Selling on Hiranda')}`} className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300"><Mail size={14} /> {a.email}</a>
              {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-stone-300 hover:text-stone-100"><ExternalLink size={14} /> Their shop</a>}
            </div>
            <StatusButtons id={a.id} status={a.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
