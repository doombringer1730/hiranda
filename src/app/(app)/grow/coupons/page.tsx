import { redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { awardMilestones } from '../actions'
import CouponsClient, { type Coupon } from './coupons-client'

export default async function CouponsPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  await awardMilestones()
  const [{ data: coupons }, { data: catalog }, people] = await Promise.all([
    ctx.supabase.from('coupons').select('id, title, emoji, bought_by, given_by, rarity, source, redeemed, redeemed_at, revealed_at, done_at, created_at').order('created_at', { ascending: false }),
    ctx.supabase.from('coupon_catalog').select('emoji, title').eq('rarity', 'common'),
    getPeople(),
  ])
  return (
    <CouponsClient
      myId={ctx.user.id}
      partnerId={ctx.partnerId}
      partnerName={people.get(ctx.partnerId)?.first ?? 'your partner'}
      coupons={(coupons ?? []) as Coupon[]}
      ideas={(catalog ?? []) as { emoji: string; title: string }[]}
    />
  )
}
