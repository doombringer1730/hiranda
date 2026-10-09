import { createClient } from '@/lib/supabase/server'
import { CHECKIN_EVERY_DAYS } from '@/lib/closeness'
import CheckinButtons from './checkin-buttons'

// On Home, about once every four weeks: a quiet, private check-in. Skipping it
// costs nothing; it simply comes back next time.
export default async function CheckinCard({ partnerName }: { partnerName: string }) {
  const supabase = await createClient()
  const since = new Date(new Date().getTime() - CHECKIN_EVERY_DAYS * 86_400_000).toISOString()
  const { count } = await supabase.from('closeness_checkins').select('id', { count: 'exact', head: true }).gte('created_at', since)
  if (count) return null
  return (
    <section className="paper rounded-[8px] px-5 py-4 -rotate-[0.4deg]">
      <CheckinButtons partnerName={partnerName} />
    </section>
  )
}
