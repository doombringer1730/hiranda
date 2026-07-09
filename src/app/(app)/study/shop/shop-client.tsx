'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Coins, Check, Trash2, Plus, Gift, Undo2 } from 'lucide-react'
import { buyCoupon, redeemCoupon, deleteCoupon } from '../actions'

export type Coupon = { id: string; title: string; emoji: string | null; cost: number; bought_by: string; redeemed: boolean; created_at: string }

const PRESETS = [
  { emoji: '💋', title: 'One kiss, no reason', cost: 20 },
  { emoji: '🎧', title: 'Control the aux all day', cost: 30 },
  { emoji: '🎬', title: 'You pick the movie', cost: 40 },
  { emoji: '☕', title: 'Coffee in bed', cost: 60 },
  { emoji: '📵', title: '1 hour phone-free together', cost: 80 },
  { emoji: '😴', title: 'Sleep in — I handle the morning', cost: 100 },
  { emoji: '💆', title: '10-minute massage', cost: 120 },
  { emoji: '🍜', title: 'Cook my favorite meal', cost: 150 },
]

export default function ShopClient({ balance, myCoupons, partnerCoupons, partnerName }: {
  balance: number; myCoupons: Coupon[]; partnerCoupons: Coupon[]; partnerName: string
}) {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [ct, setCt] = useState(''); const [cc, setCc] = useState('50'); const [ce, setCe] = useState('🎁')

  async function buy(emoji: string, title: string, cost: number) {
    if (busy) return
    setBusy(true); setErr(null)
    const res = await buyCoupon(title, emoji, cost)
    setBusy(false)
    if (res.error) { setErr(res.error); return }
    router.refresh()
  }

  const owned = myCoupons.filter(c => !c.redeemed)
  const redeemed = myCoupons.filter(c => c.redeemed)

  return (
    <div className="flex flex-col gap-6">
      {err && <p className="text-red-400 text-sm bg-red-950/30 rounded-lg px-3 py-2">{err}</p>}

      {/* Shop grid */}
      <section>
        <h2 className="text-stone-400 text-xs uppercase tracking-widest mb-3">Buy a coupon</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {PRESETS.map(p => {
            const afford = balance >= p.cost
            return (
              <button key={p.title} onClick={() => buy(p.emoji, p.title, p.cost)} disabled={!afford || busy}
                className="text-left rounded-2xl bg-stone-900/70 border border-stone-800 p-3.5 hover:border-amber-700/50 disabled:opacity-40 transition-colors">
                <div className="text-2xl mb-1.5">{p.emoji}</div>
                <p className="text-amber-100 text-sm leading-snug">{p.title}</p>
                <p className={`text-xs mt-1.5 inline-flex items-center gap-1 ${afford ? 'text-amber-400' : 'text-stone-600'}`}><Coins size={11} /> {p.cost}</p>
              </button>
            )
          })}
        </div>
        <button onClick={() => setCustomOpen(v => !v)} className="mt-3 inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm"><Plus size={14} /> Custom coupon</button>
        {customOpen && (
          <div className="mt-2 rounded-2xl bg-stone-900/70 border border-stone-800 p-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input value={ce} onChange={e => setCe(e.target.value)} maxLength={2} className="w-14 text-center bg-stone-950 border border-stone-800 rounded-xl px-2 py-2.5 text-lg" />
              <input value={ct} onChange={e => setCt(e.target.value)} placeholder="Partner has to…" className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 rounded-xl px-3 flex-1">
                <Coins size={13} className="text-amber-400" />
                <input value={cc} onChange={e => setCc(e.target.value)} type="number" min={0} className="w-full bg-transparent py-2.5 text-amber-50 text-sm focus:outline-none" />
              </div>
              <button onClick={() => buy(ce, ct, parseInt(cc, 10) || 0).then(() => { setCt(''); setCustomOpen(false) })}
                disabled={!ct.trim() || busy} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl px-4">Buy</button>
            </div>
          </div>
        )}
      </section>

      {/* Your coupons */}
      <section>
        <h2 className="text-stone-400 text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5"><Gift size={13} className="text-amber-400" /> Your coupons</h2>
        {owned.length === 0 && redeemed.length === 0 && <p className="text-stone-600 text-sm">None yet — buy one above.</p>}
        <div className="flex flex-col gap-2">
          {owned.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-amber-950/20 border border-amber-900/40 px-4 py-3">
              <span className="text-xl">{c.emoji ?? '🎁'}</span>
              <span className="text-amber-100 text-sm flex-1 min-w-0 truncate">{c.title}</span>
              <button onClick={() => { if (confirm(`Redeem “${c.title}”? ${partnerName} has to make good on it!`)) redeemCoupon(c.id).then(() => router.refresh()) }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded-lg px-3 py-1.5 shrink-0">Redeem</button>
              <button onClick={() => { if (confirm('Delete this coupon? Coins are not refunded.')) deleteCoupon(c.id).then(() => router.refresh()) }} className="text-stone-600 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
          {redeemed.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-stone-900/40 border border-stone-800 px-4 py-3">
              <span className="text-xl grayscale opacity-60">{c.emoji ?? '🎁'}</span>
              <span className="text-stone-500 text-sm flex-1 truncate line-through">{c.title}</span>
              <button onClick={() => redeemCoupon(c.id, true).then(() => router.refresh())} className="text-stone-600 hover:text-stone-300 text-xs inline-flex items-center gap-1 shrink-0"><Undo2 size={12} /> undo</button>
            </div>
          ))}
        </div>
      </section>

      {/* What you owe partner */}
      {partnerCoupons.filter(c => !c.redeemed).length > 0 && (
        <section>
          <h2 className="text-stone-400 text-xs uppercase tracking-widest mb-3">{partnerName} can cash in on you</h2>
          <div className="flex flex-col gap-2">
            {partnerCoupons.filter(c => !c.redeemed).map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-stone-900/60 border border-stone-800 px-4 py-3">
                <span className="text-xl">{c.emoji ?? '🎁'}</span>
                <span className="text-amber-100/90 text-sm flex-1 truncate">{c.title}</span>
                <Check size={14} className="text-stone-700 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
