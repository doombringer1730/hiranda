import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Coins } from 'lucide-react'
import ShopClient, { type Coupon } from './shop-client'

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).maybeSingle()
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const [{ data: earned }, { data: coupons }, { data: profiles }] = await Promise.all([
    supabase.from('study_attempts').select('coins').eq('user_id', user.id),
    supabase.from('coupons').select('id, title, emoji, cost, bought_by, redeemed, created_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name').in('id', partnerId ? [partnerId] : ['00000000-0000-0000-0000-000000000000']),
  ])

  const earnedCoins = (earned ?? []).reduce((s, r) => s + (r.coins ?? 0), 0)
  const mine = (coupons ?? []).filter(c => c.bought_by === user.id)
  const spent = mine.reduce((s, c) => s + c.cost, 0)
  const balance = earnedCoins - spent
  const partnerName = (profiles ?? [])[0]?.display_name?.split(' ')[0] ?? 'your partner'

  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/study" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm"><ArrowLeft size={15} /> Study</Link>
        <span className="inline-flex items-center gap-1.5 bg-amber-950/40 border border-amber-900/50 rounded-full px-3 py-1.5 text-sm">
          <Coins size={14} className="text-amber-400" /><span className="text-amber-100 font-semibold">{balance.toLocaleString()}</span>
        </span>
      </div>
      <h1 className="font-serif text-3xl text-amber-100 mb-1">Coupon shop</h1>
      <p className="text-stone-500 text-sm mb-6">Spend coins on things {partnerName} has to do for you 💖</p>

      <ShopClient
        balance={balance}
        myCoupons={mine as Coupon[]}
        partnerCoupons={(coupons ?? []).filter(c => c.bought_by === partnerId) as Coupon[]}
        partnerName={partnerName}
      />
    </div>
  )
}
