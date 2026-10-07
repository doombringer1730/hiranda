import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { coupleContext } from '@/lib/couple'
import { getActivePrompt, getPromptState, getDepthState } from '../actions'
import GameClient from '../game-client'
import DeckPicker from './deck-picker'
import { hasPlus } from '@/lib/plus'
import WhyItWorks from '@/components/why-it-works'

type PromptType = 'question' | 'would_you_rather' | 'this_or_that' | 'most_likely'
const GAMES: Record<PromptType, { title: string; eyebrow: string }> = {
  question: { title: 'Questions', eyebrow: 'Answers unlock together' },
  would_you_rather: { title: 'Would You Rather', eyebrow: 'Pick one — no fence-sitting' },
  this_or_that: { title: 'This or That', eyebrow: 'Quick-fire, gut answers' },
  most_likely: { title: 'Most Likely To', eyebrow: 'Point at each other' },
}
const isType = (t?: string): t is PromptType => !!t && t in GAMES

// One quick game per page (each is its own box on the Games shelf).
// ?t=<type>&deck=<1-3> picks the game and question deck; ?p=<prompt id>
// opens that exact prompt — from "Your move" or a notification.
export default async function QuickQuestionsPage({ searchParams }: { searchParams: Promise<{ p?: string; t?: string; deck?: string }> }) {
  const ctx = await coupleContext()
  if (!ctx) redirect('/games')
  const { p, t, deck: deckParam } = await searchParams

  const deep = p && /^[0-9a-f-]{36}$/i.test(p) ? await getPromptState(p) : null
  const type: PromptType = deep && isType(deep.prompt.type) ? deep.prompt.type : isType(t) ? t : 'question'

  let deck: number | undefined
  let depthState: Awaited<ReturnType<typeof getDepthState>> = null
  if (type === 'question') {
    depthState = await getDepthState()
    let fromPrompt: number | undefined
    if (deep) {
      const { data } = await ctx.supabase.from('prompts').select('depth').eq('id', deep.prompt.id).maybeSingle()
      fromPrompt = data?.depth ?? 1
    }
    deck = fromPrompt ?? (Number(deckParam) >= 1 && Number(deckParam) <= 3 ? Number(deckParam) : 1)
  }
  const locked = type === 'question' && !!deck && deck > (depthState?.both ?? 1)

  const initial = locked ? null : deep ?? await getActivePrompt(type, deck)
  const { data: partner } = await ctx.supabase.from('profiles').select('display_name').eq('id', ctx.partnerId).maybeSingle()
  const partnerName = partner?.display_name?.split(' ')[0] ?? 'your partner'
  const game = GAMES[type]

  return (
    <div className="px-4 pt-6 max-w-2xl mx-auto pb-12">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-4"><ArrowLeft size={16} /> Games</Link>
      <p className="text-stone-400 text-[11px] uppercase tracking-[0.3em]">{game.eyebrow}</p>
      <h1 className="font-serif text-[44px] leading-none text-amber-50 mt-2 mb-6">{game.title}<span className="text-amber-500">.</span></h1>

      {type === 'question' && depthState && deck && (
        <DeckPicker deck={deck} mine={depthState.mine} theirs={depthState.theirs} both={depthState.both} partnerName={partnerName} plus={await hasPlus()} />
      )}

      {!locked && (
        <GameClient
          key={`${type}-${deck ?? 0}`}
          tabs={[{ type, label: game.title, initial }]}
          deck={deck}
          partnerName={partnerName}
          myId={ctx.user.id}
          partnerId={ctx.partnerId}
        />
      )}

      {type === 'question' ? (
        <WhyItWorks className="mt-10" source="Aron et al., 1997">
          Closeness grows from back-and-forth sharing that gets a little more personal each time — and only works when you both want to go there. That’s why deeper decks open only when you both opt in.
        </WhyItWorks>
      ) : (
        <WhyItWorks className="mt-10" source="Gottman">
          Knowing the small stuff — favourites, quirks, what they’d pick — builds the “love map” couples lean on when life gets busy.
        </WhyItWorks>
      )}
    </div>
  )
}
