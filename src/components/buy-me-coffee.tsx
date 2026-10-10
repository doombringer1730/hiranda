'use client'

import { Coffee } from 'lucide-react'
import { useIsNativeApp } from '@/lib/native'

// NEXT_PUBLIC_BUY_ME_COFFEE_URL overrides it (set it to an empty value to hide the card).
const url = process.env.NEXT_PUBLIC_BUY_ME_COFFEE_URL ?? 'https://buymeacoffee.com/huddy'

// A tip jar for whoever runs Hiranda. Web only: inside the iPhone app a tip
// that unlocks nothing still has to go through Apple (App Store rule 3.1.1),
// so the link never shows there.
// `compact` is the quiet one-line version Home shows under the sponsor card.
export default function BuyMeCoffee({ compact = false }: { compact?: boolean }) {
  const native = useIsNativeApp()
  if (!url || native) return null
  if (compact) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 px-4 py-3 hover:border-stone-700 transition-colors">
        <Coffee size={16} className="text-amber-400 shrink-0" />
        <p className="flex-1 text-stone-400 text-sm">Hiranda is made by one person — <span className="text-amber-300">buy me a coffee</span> to keep it going.</p>
      </a>
    )
  }
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
