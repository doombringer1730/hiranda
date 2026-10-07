'use client'

import { useEffect } from 'react'
import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'

// Keeps the iPhone home-screen widget ("312 days of you two") current: Home
// hands it the couple's start date and names. A no-op in browsers and in app
// builds that predate the widget (the call just rejects quietly).
type WidgetData = { since: string | null; partner: string | null; me: string | null }
const WidgetBridge = registerPlugin<{ update(data: WidgetData): Promise<void> }>('WidgetBridge')

export function WidgetSync({ since, partner, me }: WidgetData) {
  useEffect(() => {
    if (isNativeApp()) WidgetBridge.update({ since, partner, me }).catch(() => {})
  }, [since, partner, me])
  return null
}
