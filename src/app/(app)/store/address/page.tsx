import { redirect } from 'next/navigation'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import AddressForm from './address-form'
import type { Address } from '../actions'

export const metadata = { title: 'Your delivery address' }

export default async function AddressPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const { data } = await ctx.supabase.from('store_addresses')
    .select('full_name, line1, line2, city, region, postal_code, country, phone').eq('user_id', ctx.user.id).maybeSingle()
  return (
    <div className="px-4 pt-6 pb-12 max-w-lg mx-auto">
      <PageHeader eyebrow="Hiranda Store" title="Your address" />
      <p className="text-stone-400 text-sm mt-2 mb-6">Where gifts to you are delivered. Your partner never sees it — only the store, to ship what they send.</p>
      <AddressForm initial={(data as Address | null) ?? null} />
    </div>
  )
}
