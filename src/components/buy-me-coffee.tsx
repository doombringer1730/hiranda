'use client'

import { Coffee } from 'lucide-react'
import { useIsNativeApp } from '@/lib/native'

const url = process.env.NEXT_PUBLIC_BUY_ME_COFFEE_URL

// A tip jar for whoever runs Hiranda. Web only: inside the iPhone app a tip
// that unlocks nothing still has to go through Apple (App Store rule 3.1.1),
// so the link never shows there. Hidden too until the URL is set.
export default function BuyMeCoffee() {
  const native = useIsNativeApp()
  if (!url || native) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900 p-5 hover:border-amber-800/60 transition-colors"
    >
      <Coffee size={18} className="text-amber-400 shrink-0" />
      <div className="flex-1">
        <p className="text-amber-100 font-medium">Buy me a coffee</p>
        <p className="text-stone-400 text-sm">Hiranda is made by one person. If it makes your days a little closer, a coffee keeps it going.</p>
      </div>
      <span className="text-stone-500 text-sm">↗</span>
    </a>
  )
}
