'use client'

import { useEffect, useState, useTransition } from 'react'
import { Moon } from 'lucide-react'
import { haptic, toast } from '@/lib/feel'
import { dndOn, inQuietHours, hhmm, fromHhmm, type QuietPrefs } from '@/lib/quiet'
import { getQuietPrefs, setDnd, setQuietHours } from '@/app/quiet-actions'

const myTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' } }

// Next 8:00 in this browser's time zone.
export function nextMorning() {
  const d = new Date(); d.setHours(8, 0, 0, 0)
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
  return d.toISOString()
}
const FOREVER = () => new Date(Date.now() + 3600 * 86_400_000).toISOString()
const untilText = (iso: string) => {
  const d = new Date(iso)
  if (d.getTime() - Date.now() > 300 * 86_400_000) return 'until you turn it off'
  const sameDay = d.toDateString() === new Date().toDateString()
  return `until ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${sameDay ? '' : ' tomorrow'}`
}

export default function QuietSettings() {
  const [prefs, setPrefs] = useState<QuietPrefs | null | undefined>(undefined)
  const partnerName = 'your partner'
  const [pending, start] = useTransition()
  const [from, setFrom] = useState('23:00')
  const [to, setTo] = useState('08:00')

  useEffect(() => {
    let live = true
    getQuietPrefs().then(r => {
      if (!live) return
      setPrefs(r?.mine ?? null)
      if (r?.mine?.quiet_start != null) setFrom(hhmm(r.mine.quiet_start))
      if (r?.mine?.quiet_end != null) setTo(hhmm(r.mine.quiet_end))
    })
    return () => { live = false }
  }, [])

  if (prefs === undefined) return <div className="skeleton h-28" />
  const dnd = dndOn(prefs)
  const hoursOn = prefs?.quiet_start != null && prefs?.quiet_end != null

  function dndUntil(iso: string | null) {
    haptic()
    start(async () => {
      const res = await setDnd(iso)
      if ('error' in res && res.error) { toast(res.error); return }
      setPrefs(p => ({ ...(p ?? { quiet_start: null, quiet_end: null, tz: null }), dnd_until: iso }))
      toast(iso ? 'Do Not Disturb is on 🌙' : 'Do Not Disturb is off')
    })
  }

  function saveHours(on: boolean, f = from, t = to) {
    start(async () => {
      const res = await setQuietHours(on ? fromHhmm(f) : null, on ? fromHhmm(t) : null, myTz())
      if ('error' in res && res.error) { toast(res.error); return }
      setPrefs(p => ({ ...(p ?? { dnd_until: null, tz: null }), quiet_start: on ? fromHhmm(f) : null, quiet_end: on ? fromHhmm(t) : null, tz: myTz() }))
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-amber-50 text-sm flex items-center gap-2"><Moon size={15} className="text-amber-300" /> Do Not Disturb</p>
          {dnd && <button onClick={() => dndUntil(null)} disabled={pending} className="text-xs text-amber-300 hover:text-amber-200">Turn off</button>}
        </div>
        {dnd ? (
          <p className="text-stone-400 text-xs mt-1">On {untilText(prefs!.dnd_until!)}. Notifications are held — you’ll see everything when you open Hiranda.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[['For an hour', () => new Date(Date.now() + 3600_000).toISOString()], ['Until morning', nextMorning], ['Until I turn it off', FOREVER]].map(([label, fn]) => (
              <button key={label as string} onClick={() => dndUntil((fn as () => string)())} disabled={pending}
                className="rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-[13px] px-3 py-1.5">{label as string}</button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-amber-50 text-sm">Quiet hours every night</span>
          <input type="checkbox" checked={hoursOn} onChange={e => saveHours(e.target.checked)} className="h-5 w-9 accent-amber-600" />
        </label>
        {hoursOn && (
          <div className="flex items-center gap-2 mt-2 text-sm text-stone-300">
            <input type="time" value={from} onChange={e => { setFrom(e.target.value); saveHours(true, e.target.value, to) }} className="rounded-lg bg-stone-950/60 border border-stone-800 px-2 py-1.5 text-amber-50" />
            <span className="text-stone-500">to</span>
            <input type="time" value={to} onChange={e => { setTo(e.target.value); saveHours(true, from, e.target.value) }} className="rounded-lg bg-stone-950/60 border border-stone-800 px-2 py-1.5 text-amber-50" />
            {inQuietHours(prefs) && <span className="text-xs text-amber-300 ml-1">quiet now</span>}
          </div>
        )}
      </div>

      <p className="text-stone-500 text-xs leading-relaxed">
        While you’re quiet, {partnerName} sees a 🌙 and can still send an <span className="text-red-300">urgent</span> message that comes through (up to 3 a day — for real emergencies). Your phone’s own Focus mode can still silence notifications.
      </p>
    </div>
  )
}
