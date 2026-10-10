import { createClient } from '@/lib/supabase/server'
import FeedbackButtons from './feedback-buttons'

// Ask once you've had a few days with Hiranda. Answer and it never asks
// again; "not now" brings it back in two weeks.
const ASK_AFTER_DAYS = 3
const SNOOZE_DAYS = 14

export default async function FeedbackCard({ joinedAt }: { joinedAt: string }) {
  const now = new Date().getTime()
  if (now - new Date(joinedAt).getTime() < ASK_AFTER_DAYS * 86_400_000) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('feedback')
    .select('rating, created_at').order('created_at', { ascending: false }).limit(20)
  if (error) return null // before migration 042
  const rows = (data ?? []) as { rating: number | null; created_at: string }[]
  if (rows.some(r => r.rating !== null)) return null
  if (rows.some(r => now - new Date(r.created_at).getTime() < SNOOZE_DAYS * 86_400_000)) return null
  return <FeedbackButtons />
}
