'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Calm, not ticking: how many days you've had together (when the couple has
// "show timer" on and a start date set).
export function SidebarTimer() {
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let live = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('couple')
        .select('together_since, show_timer')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('user2_id', { nullsFirst: false }).limit(1)
        .maybeSingle()
      if (live && data?.show_timer && data.together_since) {
        setDays(Math.max(0, Math.floor((Date.now() - new Date(data.together_since).getTime()) / 86_400_000)))
      }
    })()
    return () => { live = false }
  }, [])

  if (days === null) return null
  return (
    <div className="mx-1 mb-1 px-3 py-1.5 select-none">
      <p className="font-hand text-[21px] leading-tight text-amber-200">{days.toLocaleString()} days of you two</p>
    </div>
  )
}
