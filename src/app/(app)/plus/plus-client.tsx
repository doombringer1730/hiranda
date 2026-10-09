'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { PLUS_PERKS, PLUS_PRICES, PLUS_TRIAL_DAYS, type PlusPlan } from '@/lib/plus-config'
import type { PlusDetails } from '@/lib/plus'
import TestCardHint from '@/components/test-card-hint'
import { hasPlugin, useIsNativeApp } from '@/lib/native'
import { celebrate } from '@/lib/feel'
import { primaryButton } from '@/components/ui'
import { openBillingPortal, startCheckout, syncApplePurchase } from './actions'
import { startFreeWeek } from './intro-actions'
import { useRouter } from 'next/navigation'

type ApplePackage = { identifier: string; packageType: string; product: { priceString: string } }

// The Plus page. In a browser it sells through Stripe; inside the iPhone app it
// only ever uses Apple's in-app purchase (App Store rule 3.1.1).
export default function PlusClient({ details, coupleId, webReady, testMode, appKey, welcome, freeWeek }: {
  details: PlusDetails; coupleId: string | null; webReady: boolean; testMode: boolean; appKey: string | null; welcome: boolean; freeWeek: boolean
}) {
  const router = useRouter()
  const native = useIsNativeApp()
  const [plan, setPlan] = useState<PlusPlan>('yearly')
  const [active, setActive] = useState(details.active)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [apple, setApple] = useState<Record<PlusPlan, ApplePackage | null> | null>(null)
  const appleReady = native && !!appKey && !!coupleId && hasPlugin('Purchases')

  useEffect(() => { if (welcome && active) celebrate() }, [welcome, active])

  // App: load Apple's localized prices (the couple id is the RevenueCat user).
  useEffect(() => {
    if (!appleReady) return
    let live = true
    ;(async () => {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      await Purchases.configure({ apiKey: appKey!, appUserID: coupleId! })
      const offerings = await Purchases.getOfferings()
      const pkgs = (offerings.current?.availablePackages ?? []) as unknown as ApplePackage[]
      if (live) setApple({ monthly: pkgs.find(p => p.packageType === 'MONTHLY') ?? null, yearly: pkgs.find(p => p.packageType === 'ANNUAL') ?? null })
    })().catch(() => { if (live) setApple({ monthly: null, yearly: null }) })
    return () => { live = false }
  }, [appleReady, appKey, coupleId])

  const price = (p: PlusPlan) => (native ? apple?.[p]?.product.priceString : null) ?? PLUS_PRICES[p].label

  function buy() {
    setMsg(null)
    start(async () => {
      if (native) {
        const pkg = apple?.[plan]
        if (!pkg) { setMsg('Plus isn’t available in the app yet.'); return }
        try {
          const { Purchases } = await import('@revenuecat/purchases-capacitor')
          await Purchases.purchasePackage({ aPackage: pkg as never })
          const res = await syncApplePurchase()
          setActive(res.active)
          if (res.active) celebrate()
        } catch (e) {
          if (!(e as { userCancelled?: boolean })?.userCancelled) setMsg('The purchase didn’t go through — you weren’t charged.')
        }
        return
      }
      const res = await startCheckout(plan)
      if (res.url) location.href = res.url
      else setMsg(res.error ?? 'Something went wrong')
    })
  }

  // A free week, no card: once per couple, and it simply ends.
  function tryFree() {
    setMsg(null)
    start(async () => {
      const res = await startFreeWeek()
      if (res.error) { setMsg(res.error); return }
      celebrate()
      router.refresh()
    })
  }

  function restore() {
    setMsg(null)
    start(async () => {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor')
        await Purchases.restorePurchases()
        const res = await syncApplePurchase()
        setActive(res.active)
        setMsg(res.active ? 'Plus restored 💛' : 'No Plus purchase found for this Apple ID.')
      } catch { setMsg('Couldn’t restore — try again.') }
    })
  }

  function manage() {
    setMsg(null)
    start(async () => {
      if (details.source === 'apple') { location.href = 'https://apps.apple.com/account/subscriptions'; return }
      const res = await openBillingPortal()
      if (res.url) location.href = res.url
      else setMsg(res.error ?? 'Something went wrong')
    })
  }

  const canBuy = native ? appleReady && !!apple?.[plan] : webReady
  // The free week (no card): Plus is on, and picking a plan keeps it going.
  const onTrial = !!details.trialEnds
  const trialEnd = details.trialEnds ? new Date(details.trialEnds).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : null

  return (
    <div className="max-w-xl mx-auto px-4 pt-8 pb-16 flex flex-col gap-7">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 text-amber-400 text-[11px] uppercase tracking-[0.22em]"><Sparkles size={13} /> Hiranda Plus</p>
        <h1 className="font-serif text-4xl text-amber-50 mt-2 leading-tight">{onTrial ? 'Your free week of Plus.' : active ? 'You two have Plus.' : 'More of you two.'}</h1>
        <p className="font-hand text-[22px] text-amber-400 mt-1">{onTrial ? `on the house until ${trialEnd}.` : active ? 'thank you for keeping the lights on 💛' : 'one plan, both of you.'}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {PLUS_PERKS.map(p => (
          <li key={p.title} className="flex gap-3 rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
            <span className="text-2xl leading-none" aria-hidden="true">{p.emoji}</span>
            <div>
              <p className="text-amber-50 text-sm font-medium">{p.title}</p>
              <p className="text-stone-400 text-sm">{p.text}</p>
            </div>
            {active && !onTrial && <Check size={16} className="ml-auto text-amber-500 shrink-0" />}
          </li>
        ))}
      </ul>

      {active && !onTrial ? (
        <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 text-center flex flex-col items-center gap-3">
          <p className="text-stone-300 text-sm">
            {details.source === 'grant' ? 'Founders’ Plus — on the house, forever.'
              : details.renews ? `Renews ${new Date(details.renews).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.`
              : 'Active.'}
          </p>
          {details.source && details.source !== 'grant' && (
            <button onClick={manage} disabled={pending} className="text-amber-400 hover:text-amber-300 text-sm underline underline-offset-4">Manage subscription</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {onTrial && (
            <p className="text-stone-300 text-sm text-center leading-relaxed">
              Your free week ends {trialEnd}. Nothing renews and nothing is charged: if you’d like to keep Plus, pick a plan below.
            </p>
          )}
          {freeWeek && (
            <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 text-center flex flex-col items-center gap-2">
              <p className="text-amber-50 font-medium">Try Plus free for a week</p>
              <p className="text-stone-400 text-sm">No card. It simply ends after {PLUS_TRIAL_DAYS} days, and everything you made stays yours.</p>
              <button onClick={tryFree} disabled={pending} className={`${primaryButton} mt-1`}>Start our free week</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Plan">
            {(['yearly', 'monthly'] as const).map(p => (
              <button key={p} role="radio" aria-checked={plan === p} onClick={() => setPlan(p)}
                className={`rounded-2xl border p-4 text-left transition-colors ${plan === p ? 'border-amber-600 bg-amber-950/30' : 'border-stone-800 bg-stone-900/60 hover:border-stone-700'}`}>
                <p className="text-stone-400 text-xs uppercase tracking-[0.18em]">{p === 'yearly' ? 'Yearly' : 'Monthly'}</p>
                <p className="font-serif text-2xl text-amber-50 mt-1">{price(p)}<span className="text-stone-500 text-sm font-sans"> / {PLUS_PRICES[p].per}</span></p>
                {p === 'yearly' && <p className="text-amber-400 text-xs mt-0.5">{PLUS_PRICES.yearly.note}</p>}
              </button>
            ))}
          </div>

          <button onClick={buy} disabled={pending || !canBuy} className={`${primaryButton} h-12 text-base w-full`}>
            {pending ? <Loader2 size={18} className="animate-spin" /> : null}
            {!canBuy ? 'Coming soon' : onTrial ? 'Keep Plus' : `Try it free for ${PLUS_TRIAL_DAYS} days`}
          </button>

          <p className="text-stone-500 text-xs text-center leading-relaxed">
            {PLUS_TRIAL_DAYS}-day free trial, then {price(plan)} per {PLUS_PRICES[plan].per} for your couple. Renews automatically until you cancel
            {native ? ' — payment is charged to your Apple ID, and you can cancel anytime in Settings → Apple ID → Subscriptions, at least 24 hours before it renews.' : ' — cancel anytime from this page.'}
          </p>
          {!native && webReady && testMode && <TestCardHint />}
          {native && appleReady && (
            <button onClick={restore} disabled={pending} className="text-stone-400 hover:text-stone-200 text-sm mx-auto">Restore purchases</button>
          )}
        </div>
      )}

      {msg && <p className="text-center text-sm text-stone-300" role="status">{msg}</p>}

      <p className="text-stone-600 text-xs text-center">
        <Link href="/terms" className="hover:text-stone-400">Terms</Link> · <Link href="/privacy" className="hover:text-stone-400">Privacy</Link>
      </p>
    </div>
  )
}
