'use client'

import { Bell, BellRing } from 'lucide-react'
import { usePushNotifications } from '@/components/pwa'

// Most people share the link and close the tab. A ping when their partner
// joins is what brings them back (sent from the join flow — see /join).
export default function NotifyWhenJoined() {
  const { state, busy, enable } = usePushNotifications()
  if (state === 'on') {
    return <p className="flex items-center justify-center gap-2 text-stone-400 text-xs"><BellRing size={14} className="text-amber-400" /> We’ll ping you the moment they join.</p>
  }
  if (state !== 'off') return null
  return (
    <button onClick={enable} disabled={busy}
      className="w-full flex items-center justify-center gap-2 rounded-xl border border-stone-800 bg-stone-900/60 hover:border-stone-700 disabled:opacity-50 px-4 py-3 text-sm text-stone-200 transition-colors">
      <Bell size={15} className="text-amber-400" /> Tell me when they join
    </button>
  )
}
