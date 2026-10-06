'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type TimeUnit = { years: number; months: number; days: number; hours: number; minutes: number; seconds: number }

function calcTime(since: Date): TimeUnit {
  const now = new Date()
  let years = now.getFullYear() - since.getFullYear()
  let months = now.getMonth() - since.getMonth()
  let days = now.getDate() - since.getDate()
  let hours = now.getHours() - since.getHours()
  let minutes = now.getMinutes() - since.getMinutes()
  let seconds = now.getSeconds() - since.getSeconds()

  if (seconds < 0) { seconds += 60; minutes-- }
  if (minutes < 0) { minutes += 60; hours-- }
  if (hours < 0) { hours += 24; days-- }
  if (days < 0) {
    months--
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) { months += 12; years-- }

  return { years, months, days, hours, minutes, seconds }
}

function pad(n: number) { return n.toString().padStart(2, '0') }

function useTimer() {
  const [since, setSince] = useState<Date | null>(null)
  const [time, setTime] = useState<TimeUnit | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('couple')
        .select('together_since, show_timer')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .maybeSingle()
      if (data?.show_timer && data.together_since) {
        setSince(new Date(data.together_since))
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!since) return
    setTime(calcTime(since))
    const interval = setInterval(() => setTime(calcTime(since)), 1000)
    return () => clearInterval(interval)
  }, [since])

  return { since, time }
}

/* ── Mobile: a small glass pill above the tab bar on Home only; hides on
   scroll so it never sits over content ── */
export default function CoupleTimer() {
  const { since, time } = useTimer()
  const pathname = usePathname()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!since || !time || pathname !== '/') return null

  return (
    <div className={`md:hidden fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-30 material rounded-full px-3.5 py-2 flex items-baseline gap-2 pointer-events-none select-none transition-all duration-300 ${hidden ? 'opacity-0 translate-y-3' : 'opacity-100'}`}>
      <p className="text-stone-400 text-[11px] leading-none">together</p>
      <p className="text-amber-300 text-[12px] font-semibold tabular-nums leading-none">
        {time.years > 0 && `${time.years}y `}
        {time.months > 0 && `${time.months}mo `}
        {time.days}d {pad(time.hours)}:{pad(time.minutes)}:{pad(time.seconds)}
      </p>
    </div>
  )
}

/* ── Desktop: inline in sidebar ── */
export function SidebarTimer() {
  const { since, time } = useTimer()
  if (!since || !time) return null

  return (
    <div className="mx-1 mb-1 bg-stone-800/50 rounded-xl px-3 py-2 select-none">
      <p className="text-stone-600 text-xs leading-none mb-1">together</p>
      <p className="text-amber-400 text-xs font-semibold tabular-nums leading-none">
        {time.years > 0 && `${time.years}y `}
        {time.months > 0 && `${time.months}mo `}
        {time.days}d {pad(time.hours)}:{pad(time.minutes)}:{pad(time.seconds)}
      </p>
    </div>
  )
}
