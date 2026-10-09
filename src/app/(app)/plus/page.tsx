import { coupleContext } from '@/lib/couple'
import { plusDetails, trialState } from '@/lib/plus'
import { stripeConfigured, stripeOpenTo, stripeTestMode } from '@/lib/billing'
import PlusClient from './plus-client'

export const metadata = { title: 'Hiranda Plus' }

export default async function PlusPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [ctx, details, trial, { welcome }] = await Promise.all([coupleContext(), plusDetails(), trialState(), searchParams])
  return (
    <PlusClient
      details={details}
      coupleId={ctx?.couple.id ?? null}
      webReady={stripeConfigured() && stripeOpenTo(ctx?.user.email)}
      testMode={stripeTestMode()}
      appKey={process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? null}
      welcome={welcome === '1'}
      freeWeek={!!ctx && trial.offer}
    />
  )
}
