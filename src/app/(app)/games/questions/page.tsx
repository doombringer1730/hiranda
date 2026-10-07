import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { coupleContext } from '@/lib/couple'
import { getActivePrompt, getPromptState } from '../actions'
import GameClient from '../game-client'
import WhyItWorks from '@/components/why-it-works'

type PromptType = 'question' | 'would_you_rather' | 'this_or_that' | 'most_likely'
const TYPES: PromptType[] = ['question', 'would_you_rather', 'this_or_that', 'most_likely']

// Quick questions — four little decks. `?p=<prompt id>` opens that exact
// prompt (from "Your move" or a notification) on its own tab, so "Miri
// answered — your turn" always lands on the question Miri answered.
export default async function QuickQuestionsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await coupleContext()
  if (!ctx) redirect('/games')
  const { p } = await searchParams

  const [deep, ...actives] = await Promise.all([
    p && /^[0-9a-f-]{36}$/i.test(p) ? getPromptState(p) : Promise.resolve(null),
    ...TYPES.map(t => getActivePrompt(t)),
  ])
  const deepType = deep && TYPES.includes(deep.prompt.type as PromptType) ? deep.prompt.type as PromptType : undefined
  const initialFor = (t: PromptType, i: number) => (deep && deepType === t ? deep : actives[i])

  const { data: partner } = await ctx.supabase.from('profiles').select('display_name').eq('id', ctx.partnerId).maybeSingle()
  const partnerName = partner?.display_name?.split(' ')[0] ?? 'your partner'

  const tabs = [
    { type: 'question' as const, label: 'Questions', initial: initialFor('question', 0) },
    { type: 'would_you_rather' as const, label: 'Would You Rather', shortLabel: 'WYR', initial: initialFor('would_you_rather', 1) },
    { type: 'this_or_that' as const, label: 'This or That', shortLabel: 'This/That', initial: initialFor('this_or_that', 2) },
    { type: 'most_likely' as const, label: 'Most Likely To', shortLabel: 'Most Likely', initial: initialFor('most_likely', 3) },
  ]

  return (
    <div className="px-4 pt-6 max-w-2xl mx-auto pb-12">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-4"><ArrowLeft size={16} /> Games</Link>
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.3em]">Answers unlock together</p>
      <h1 className="font-serif text-[44px] leading-none text-amber-50 mt-2 mb-6">Quick Questions<span className="text-amber-500">.</span></h1>
      <GameClient tabs={tabs} initialTab={deepType} partnerName={partnerName} myId={ctx.user.id} partnerId={ctx.partnerId} />
      <WhyItWorks className="mt-10" source="Gottman">
        Knowing the small stuff — favourites, worries, what they’d pick — builds the “love map” that couples lean on when life gets busy.
      </WhyItWorks>
    </div>
  )
}
