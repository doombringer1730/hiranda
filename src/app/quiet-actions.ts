'use server'

import { createClient } from '@/lib/supabase/server'
import type { QuietPrefs } from '@/lib/quiet'

const FIELDS = 'user_id, dnd_until, quiet_start, quiet_end, tz'

// Yours and your partner's Do Not Disturb settings.
export async function getQuietPrefs(): Promise<{ mine: QuietPrefs | null; partner: QuietPrefs | null } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('notify_prefs').select(FIELDS)
  const rows = (data ?? []) as (QuietPrefs & { user_id: string })[]
  return { mine: rows.find(r => r.user_id === user.id) ?? null, partner: rows.find(r => r.user_id !== user.id) ?? null }
}

async function save(patch: Partial<QuietPrefs>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('notify_prefs')
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() })
  return error ? { error: 'Couldn’t save — try again' } : { ok: true }
}

// Do Not Disturb until a time (ISO), or off (null).
export async function setDnd(untilIso: string | null) {
  if (untilIso !== null) {
    const t = new Date(untilIso).getTime()
    if (Number.isNaN(t) || t < Date.now() || t > Date.now() + 3650 * 86_400_000) return { error: 'Bad time' }
  }
  return save({ dnd_until: untilIso })
}

// Nightly quiet hours in your own time zone (minutes after midnight), or off.
export async function setQuietHours(start: number | null, end: number | null, tz: string | null) {
  const ok = (m: number | null) => m === null || (Number.isInteger(m) && m >= 0 && m < 1440)
  if (!ok(start) || !ok(end)) return { error: 'Bad time' }
  return save({ quiet_start: start, quiet_end: end, tz: tz?.slice(0, 64) ?? null })
}
