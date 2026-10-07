import { coupleContext } from '@/lib/couple'
import { plusDetails } from '@/lib/plus'
import { stripeConfigured } from '@/lib/billing'
import PlusClient from './plus-client'

export const metadata = { title: 'Hiranda Plus' }

export default async function PlusPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [ctx, details, { welcome }] = await Promise.all([coupleContext(), plusDetails(), searchParams])
  return (
    <PlusClient
      details={details}
      coupleId={ctx?.couple.id ?? null}
      webReady={stripeConfigured()}
      appKey={process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? null}
      welcome={welcome === '1'}
    />
  )
}
