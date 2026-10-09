import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { trialState } from '@/lib/plus'
import PlusIntro from './plus-intro'

const DAY = 86_400_000

// On Home: the one-time Plus intro for a newly paired couple, and, in the last
// two days of a free week, one quiet note that it's about to end.
export default async function PlusWelcome({ userId, partnerName }: { userId: string; partnerName: string }) {
  const supabase = await createClient()
  const [trial, { data: seen }] = await Promise.all([
    trialState(),
    supabase.from('plus_intro_seen').select('user_id').eq('user_id', userId).maybeSingle(),
  ])

  if (trial.offer && !seen) return <PlusIntro partnerName={partnerName} />

  if (trial.endsAt) {
    const left = new Date(trial.endsAt).getTime() - new Date().getTime()
    if (left > 2 * DAY) return null
    const day = new Date(trial.endsAt).toLocaleDateString('en-US', { weekday: 'long' })
    return (
      <Link href="/plus" className="paper rounded-[6px] px-5 py-4 -rotate-[0.3deg] flex items-center gap-4 mb-3">
        <span className="text-3xl" aria-hidden>✨</span>
        <span className="min-w-0">
          <span className="block font-hand text-[23px] leading-tight text-[var(--paper-ink)]">Your free week of Plus ends {day}.</span>
          <span className="block text-sm text-[var(--paper-muted)]">Nothing renews on its own. If you’d like to keep it, pick a plan.</span>
        </span>
      </Link>
    )
  }
  return null
}
