import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { togetherStubs } from '@/lib/together'

// The counts behind "what you're good at", between two ISO timestamps.
// Everything here is something you did together or for each other; nothing
// is split by partner.
export async function strengthCounts(supabase: SupabaseClient, from: string, to: string): Promise<Record<string, number>> {
  const n = (r: { count: number | null }) => r.count ?? 0
  const [goodNews, thanks, answers, stubs, memories, taps, letters, someday, draws, lessons, trailDays] = await Promise.all([
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('kind', 'good_news').gte('created_at', from).lt('created_at', to),
    supabase.from('jar_slips').select('id', { count: 'exact', head: true }).eq('jar', 'thanks').gte('created_at', from).lt('created_at', to),
    supabase.from('prompt_responses').select('prompt_id, user_id').gte('responded_at', from).lt('responded_at', to).limit(1000),
    togetherStubs(supabase, from, to),
    supabase.from('memories').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to),
    supabase.from('love_taps').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to),
    supabase.from('letters').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to),
    supabase.from('bucket_list').select('id', { count: 'exact', head: true }).eq('completed', true).gte('completed_at', from).lt('completed_at', to),
    supabase.from('jar_slips').select('id', { count: 'exact', head: true }).eq('jar', 'ours').gte('drawn_at', from).lt('drawn_at', to),
    supabase.from('lesson_progress').select('lesson_key', { count: 'exact', head: true }).gte('completed_at', from).lt('completed_at', to),
    supabase.from('trail_progress').select('day', { count: 'exact', head: true }).gte('completed_at', from).lt('completed_at', to),
  ])
  // Questions you both answered.
  const who = new Map<string, Set<string>>()
  for (const a of answers.data ?? []) who.set(a.prompt_id, (who.get(a.prompt_id) ?? new Set()).add(a.user_id))
  return {
    goodNews: n(goodNews),
    thanks: n(thanks),
    questions: [...who.values()].filter(s => s.size >= 2).length,
    talk: stubs.filter(s => s.kind === 'talk').length,
    watch: stubs.filter(s => s.kind === 'watch').length,
    memories: n(memories),
    taps: n(taps),
    letters: n(letters),
    newThings: n(someday) + n(draws),
    // Lessons and trail days each count once per person; halve for "together".
    grow: Math.floor((n(lessons) + n(trailDays)) / 2),
  }
}
