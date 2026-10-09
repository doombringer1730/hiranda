'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Gift, Camera, Shuffle } from 'lucide-react'
import { haptic, celebrate, toast } from '@/lib/feel'
import { revealCoupon, spendCoupon, markCouponDone, giveCoupon } from '../actions'

export type Coupon = {
  id: string; title: string; emoji: string | null; bought_by: string; given_by: string | null
  rarity: 'gift' | 'common' | 'rare' | 'legendary'; source: string
  redeemed: boolean; redeemed_at: string | null; revealed_at: string | null; done_at: string | null; created_at: string
}

const RARITY_LABEL = { gift: 'a gift', common: 'common', rare: 'rare', legendary: 'legendary' } as const
const short = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function CouponsClient({ myId, partnerId, partnerName, coupons, ideas, plus }: {
  myId: string; partnerId: string; partnerName: string; coupons: Coupon[]; ideas: { emoji: string; title: string }[]; plus: boolean
}) {
  const router = useRouter()
  const [peeling, setPeeling] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [gift, setGift] = useState('')
  const [giftEmoji, setGiftEmoji] = useState('🎁')
  const [sending, setSending] = useState(false)
  const [ideaAt, setIdeaAt] = useState(0)

  const mine = coupons.filter(c => c.bought_by === myId)
  const toReveal = mine.filter(c => !c.revealed_at && !c.redeemed)
  const toUse = mine.filter(c => c.revealed_at && !c.redeemed)
  const waiting = mine.filter(c => c.redeemed && !c.done_at)
  const owed = coupons.filter(c => c.bought_by === partnerId && c.redeemed && !c.done_at)
  const history = coupons.filter(c => c.done_at).slice(0, 12)

  function reveal(c: Coupon) {
    haptic(); setPeeling(c.id)
    setTimeout(async () => {
      await revealCoupon(c.id)
      if (c.rarity !== 'common' && c.rarity !== 'gift') celebrate(null, { count: c.rarity === 'legendary' ? 70 : 40 })
      setPeeling(null); router.refresh()
    }, 520)
  }

  function spend(c: Coupon) {
    if (!confirm(`Use “${c.title}” now? ${partnerName} will get a heads-up.`)) return
    haptic()
    start(async () => {
      const res = await spendCoupon(c.id)
      if ('error' in res && res.error) { toast(res.error); return }
      toast(`Sent to ${partnerName} 🎟️`); router.refresh()
    })
  }

  function done(c: Coupon) {
    haptic()
    start(async () => {
      const res = await markCouponDone(c.id)
      celebrate(null, { count: 24 })
      if ('credited' in res && res.credited) toast(`Done 💛 $${(res.credited / 100).toFixed(2)} off your next Plus renewal`)
      router.refresh()
    })
  }

  // Ideas fill the coupon in; nothing is sent until you press Give.
  function pickIdea(i: { emoji: string; title: string }) { haptic(); setGiftEmoji(i.emoji); setGift(i.title) }
  function surprise() {
    if (!ideas.length) return
    const next = (ideaAt + 1 + Math.floor(Math.random() * Math.max(1, ideas.length - 1))) % ideas.length
    setIdeaAt(next); pickIdea(ideas[next])
  }

  function give() {
    if (!gift.trim()) return
    haptic()
    start(async () => {
      const res = await giveCoupon(gift, giftEmoji)
      if ('error' in res && res.error) { toast(res.error); return }
      // The ticket tears off and flies to them, then a fresh blank one.
      setSending(true); celebrate(null, { count: 30 })
      setTimeout(() => { setSending(false); setGift(''); setGiftEmoji('🎁'); toast(`Sent to ${partnerName} 💝 they'll scratch to reveal it`); router.refresh() }, 650)
    })
  }

  const preview: Coupon = { id: 'preview', title: gift.trim() || 'Good for one…', emoji: giftEmoji || '🎁', bought_by: partnerId, given_by: myId, rarity: 'gift', source: 'gift', redeemed: false, redeemed_at: null, revealed_at: null, done_at: null, created_at: '' }

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <Link href="/grow" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-4"><ArrowLeft size={16} /> Grow</Link>
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.3em]">Earned together, used on each other</p>
      <h1 className="font-serif text-[44px] leading-none text-amber-50 mt-2">Coupon Book<span className="text-amber-500">.</span></h1>
      <p className="font-hand text-[22px] text-stone-400 mt-2">write one any time. stamps in your passport add surprise ones.</p>
      {plus ? (
        <p className="text-stone-500 text-xs mt-1 mb-8">Each coupon you finish together takes $0.50 off your next Plus renewal, up to $2.</p>
      ) : (
        <Link href="/plus" className="block text-stone-500 hover:text-amber-300 text-xs mt-1 mb-8">With Plus, each coupon you finish together takes $0.50 off your renewal →</Link>
      )}

      {/* Make one: free, any time. The ticket previews as you write. */}
      <section className="tile p-5">
        <p className="flex items-center gap-2 text-amber-200 font-serif text-2xl"><Gift size={20} /> Make {partnerName} a coupon</p>
        <p className="text-stone-400 text-sm mt-1">Free, as many as you like. They scratch it to see what it is.</p>
        <div className={`mt-4 ${sending ? 'animate-send-off' : ''}`}>
          <CouponCard c={preview} />
        </div>
        <div className="flex gap-2 mt-4">
          <input value={giftEmoji} onChange={e => setGiftEmoji(e.target.value)} maxLength={4} aria-label="Emoji" className="w-12 text-center rounded-xl bg-stone-950/60 border border-stone-800 text-lg" />
          <input value={gift} onChange={e => setGift(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') give() }} maxLength={80} placeholder="Good for one…" aria-label="What it's good for"
            className="flex-1 min-w-0 rounded-xl bg-stone-950/60 border border-stone-800 px-3 py-2.5 font-hand text-[21px] text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
          <button onClick={give} disabled={pending || sending || !gift.trim()} className="shrink-0 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm font-medium px-5">
            {pending ? <Loader2 size={15} className="animate-spin" /> : 'Give'}
          </button>
        </div>
        {ideas.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1">
            <button onClick={surprise} className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 px-3 py-1.5 text-[13px]"><Shuffle size={13} /> Surprise me</button>
            {ideas.map(i => (
              <button key={i.title} onClick={() => pickIdea(i)} className="shrink-0 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-200 px-3 py-1.5 text-[13px]">{i.emoji} {i.title}</button>
            ))}
          </div>
        )}
      </section>

      {toReveal.length > 0 && (
        <Section title={`To reveal · ${toReveal.length}`}>
          {toReveal.map(c => (
            <button key={c.id} onClick={() => reveal(c)} className="relative w-full text-left">
              <CouponCard c={c} hidden />
              <span className={`scratch ticket absolute inset-0 rounded-[18px] grid place-items-center ${peeling === c.id ? 'animate-peel' : ''}`}>
                <span className="text-center">
                  <span className="block font-hand text-[26px] leading-none">tap to reveal ✨</span>
                  <span className="block text-[10px] uppercase tracking-[0.2em] mt-1 opacity-70">{RARITY_LABEL[c.rarity]} · {c.source.startsWith('milestone') ? 'from a stamp' : `from ${partnerName}`}</span>
                </span>
              </span>
            </button>
          ))}
        </Section>
      )}

      {owed.length > 0 && (
        <Section title={`${partnerName} is using`}>
          {owed.map(c => (
            <div key={c.id}>
              <CouponCard c={c} />
              <div className="flex items-center gap-3 mt-2 px-1">
                <button onClick={() => done(c)} disabled={pending} className="rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 h-9">Done ✓</button>
                <Link href="/memories/new" className="text-xs text-stone-400 hover:text-amber-300 inline-flex items-center gap-1"><Camera size={12} /> make it a memory</Link>
                <span className="ml-auto text-xs text-stone-500">used {short(c.redeemed_at!)}</span>
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section title={`Yours to use · ${toUse.length}`}>
        {toUse.length === 0 ? (
          <p className="text-stone-500 text-sm">None right now. Stamps in your passport bring surprise ones, and anything {partnerName} makes for you lands here.</p>
        ) : toUse.map(c => (
          <div key={c.id}>
            <CouponCard c={c} />
            <div className="flex items-center gap-3 mt-2 px-1">
              <button onClick={() => spend(c)} disabled={pending} className="rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 h-9">Use it</button>
              <span className="ml-auto text-xs text-stone-500">{c.given_by ? `from ${partnerName}` : 'earned'} · {short(c.created_at)}</span>
            </div>
          </div>
        ))}
      </Section>

      {waiting.length > 0 && (
        <Section title="Waiting on them">
          {waiting.map(c => (
            <div key={c.id} className="opacity-80">
              <CouponCard c={c} />
              <p className="text-xs text-stone-500 mt-2 px-1">Used {short(c.redeemed_at!)} — {partnerName} marks it done.</p>
            </div>
          ))}
        </Section>
      )}

      {history.length > 0 && (
        <Section title="Used and loved">
          {history.map(c => <div key={c.id} className="opacity-60"><CouponCard c={c} /></div>)}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">{title}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function CouponCard({ c, hidden = false }: { c: Coupon; hidden?: boolean }) {
  return (
    <div className={`ticket coupon-${c.rarity} rounded-[18px] flex items-stretch min-h-[92px] shadow-[0_10px_24px_-14px_rgb(0_0_0/0.6)] ${hidden ? 'invisible' : ''}`}>
      <div className="w-[92px] shrink-0 grid place-items-center border-r-2 border-dashed border-black/15 text-[38px]">{c.emoji ?? '🎟️'}</div>
      <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] opacity-60">Good for one · {RARITY_LABEL[c.rarity]}</p>
        <p className="font-hand text-[24px] leading-[1.05] mt-1">{c.title}</p>
      </div>
    </div>
  )
}
