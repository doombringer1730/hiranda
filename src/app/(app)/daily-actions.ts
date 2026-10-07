'use server'

import { createClient } from '@/lib/supabase/server'

export type DailyPrompt = {
  prompt: { id: string; type: string; text: string; option_a: string | null; option_b: string | null }
  myResponse: string | null
  partnerResponse: string | null
}

const TYPES = ['question', 'would_you_rather', 'this_or_that', 'most_likely']

// FNV-1a — a stable hash so both partners land on the same prompt.
function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

// Today's shared question. `day` is the caller's local date (YYYY-MM-DD) so
// the question turns over at their midnight, not the server's.
//
// The pick is deterministic: prompts neither partner had answered before
// `day`, sorted, indexed by hash(couple + day). Answers given during the day
// don't change the pool, so both partners keep seeing the same prompt.
export async function getDailyPrompt(day: string): Promise<DailyPrompt | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const dayStart = new Date(`${day}T00:00:00Z`)
  // Local dates are at most ~14h from UTC; reject anything wilder.
  if (Number.isNaN(dayStart.getTime()) || Math.abs(dayStart.getTime() - Date.now()) > 2 * 86_400_000) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: couples } = await supabase
    .from('couple').select('id, user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1)
  const couple = couples?.[0]
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null
  if (!couple || !partnerId) return null

  const [{ data: prompts }, { data: earlier }] = await Promise.all([
    supabase.from('prompts').select('id, type, text, option_a, option_b, depth').in('type', TYPES).order('id'),
    supabase.from('prompt_responses').select('prompt_id')
      .in('user_id', [user.id, partnerId]).lt('responded_at', dayStart.toISOString()),
  ])
  if (!prompts?.length) return null
  // Only decks you've both opened (Deeper/Deepest questions are opt-in).
  const { data: openDepth } = await supabase.rpc('couple_depth')

  const used = new Set((earlier ?? []).map(r => r.prompt_id))
  const allowed = prompts.filter(p => (p.depth ?? 1) <= ((openDepth as number | null) ?? 1))
  const fresh = allowed.filter(p => !used.has(p.id))
  const pool = fresh.length ? fresh : allowed
  const prompt = pool[hash(`${couple.id}:${day}`) % pool.length]

  const { data: responses } = await supabase
    .from('prompt_responses').select('user_id, response').eq('prompt_id', prompt.id)

  return {
    prompt,
    myResponse: responses?.find(r => r.user_id === user.id)?.response ?? null,
    partnerResponse: responses?.find(r => r.user_id === partnerId)?.response ?? null,
  }
}
