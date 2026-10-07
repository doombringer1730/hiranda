// Do Not Disturb + nightly quiet hours. Pure helpers, used on the server (to
// hold back notifications) and in the app (to show "on Do Not Disturb").

export type QuietPrefs = {
  dnd_until: string | null
  quiet_start: number | null // minutes after midnight, in their own time zone
  quiet_end: number | null
  tz: string | null
}

// Minutes after midnight right now in a time zone.
function minutesIn(tz: string, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now)
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
    const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
    return h * 60 + m
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes()
  }
}

export function inQuietHours(p: QuietPrefs | null | undefined, now = new Date()) {
  if (!p || p.quiet_start == null || p.quiet_end == null || p.quiet_start === p.quiet_end) return false
  const m = minutesIn(p.tz || 'UTC', now)
  // Windows can wrap midnight (23:00 → 08:00).
  return p.quiet_start < p.quiet_end ? m >= p.quiet_start && m < p.quiet_end : m >= p.quiet_start || m < p.quiet_end
}

export function dndOn(p: QuietPrefs | null | undefined, now = new Date()) {
  return !!p?.dnd_until && new Date(p.dnd_until).getTime() > now.getTime()
}

export function isQuiet(p: QuietPrefs | null | undefined, now = new Date()) {
  return dndOn(p, now) || inQuietHours(p, now)
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const fromHhmm = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
