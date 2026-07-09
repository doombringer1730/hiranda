import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PartyPopper } from 'lucide-react'
import ReviewClient from './review-client'

// Interleaved spaced-repetition review across ALL decks — due cards mixed
// together (interleaving + spaced repetition, the two highest-utility methods).
export default async function ReviewAllPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: cards }, { data: progress }] = await Promise.all([
    supabase.from('study_cards').select('id, term, definition'),
    supabase.from('study_progress').select('card_id, due_at').eq('user_id', user.id),
  ])

  const dueAt = new Map((progress ?? []).map(p => [p.card_id, p.due_at]))
  const due = (cards ?? [])
    .filter(c => { const d = dueAt.get(c.id); return !d || d <= today })
    .sort(() => Math.random() - 0.5) // interleave across decks

  if (due.length === 0) {
    return (
      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
        <Link href="/study" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm mb-10"><ArrowLeft size={15} /> Study</Link>
        <div className="text-center py-16">
          <PartyPopper size={40} className="mx-auto text-indigo-400 mb-4" />
          <p className="text-amber-100 font-medium">All caught up!</p>
          <p className="text-stone-500 text-sm mt-1">No cards due for review right now.</p>
        </div>
      </div>
    )
  }

  return <ReviewClient cards={due} />
}
