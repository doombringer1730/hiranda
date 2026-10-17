import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookHeart, Ticket } from 'lucide-react'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { MILESTONES } from '@/lib/path'
import { ROUTES } from '@/lib/grow-map'
import PageHeader from '@/components/page-header'
import WhyItWorks from '@/components/why-it-works'
import { hasPlus } from '@/lib/plus'
import { awardMilestones, getReviewDeck } from './actions'
import { loadProgress, routeOpen } from './map-data'
import TrailMap from './trail-map'

// Grow: the map is the page. Pick any route together; each stop is a few
// cards (guess, learn, a sealed prediction about each other, something to
// do, a line to reflect). No scores, no streaks, no coupons for lessons.
// Love Map review, coupons and the passport sit in a slim strip and below.
export default async function GrowPage() {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const { supabase, user, couple, partnerId } = ctx

  // Stamps still come from the things you do together elsewhere in Hiranda.
  const justStamped = await awardMilestones()

  const [people, plus, { done, firstDoneAt }, review, { data: earned }, { data: progressRows }, { data: coupons }] = await Promise.all([
    getPeople(),
    hasPlus(),
    loadProgress(ctx),
    getReviewDeck(),
    supabase.from('milestones').select('key').eq('couple_id', couple.id),
    supabase.rpc('milestone_progress'),
    supabase.from('coupons').select('bought_by, redeemed, revealed_at'),
  ])

  const me = people.get(user.id), partner = people.get(partnerId)
  const person = (p: typeof me, fallback: string) => ({ first: p?.first || fallback, accent: p?.accent ?? '#b45309', avatar: p?.avatar ?? null })
  const earnedSet = new Set((earned ?? []).map(e => e.key))
  const progress = new Map(((progressRows ?? []) as { track: string; value: number }[]).map(p => [p.track, p.value]))
  const mine = (coupons ?? []).filter(c => c.bought_by === user.id)
  const toReveal = mine.filter(c => !c.revealed_at).length
  const toUse = mine.filter(c => !c.redeemed).length
  const strip = 'tile px-3.5 py-3 flex items-center gap-2.5 min-w-0'

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <PageHeader eyebrow="Grow together" title="Grow" />
      <p className="text-stone-400 text-sm mt-2 mb-5">Little routes to walk together, at your own pace. Pick one that fits; nothing breaks if you wander off.</p>

      {justStamped.length > 0 && (
        <Link href="/grow/coupons" className="paper rounded-[6px] px-5 py-4 mb-5 flex items-center gap-4 animate-rise -rotate-[0.5deg]">
          <span className="text-4xl">{MILESTONES.find(x => x.key === justStamped[0])?.emoji ?? '🎟️'}</span>
          <span className="min-w-0">
            <span className="block font-hand text-[26px] leading-tight text-[var(--paper-ink)]">New stamp! You both earned a coupon.</span>
            <span className="block text-sm text-[var(--paper-muted)]">{MILESTONES.find(x => x.key === justStamped[0])?.title}: tap to reveal yours</span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <Link href="/grow/review" className={strip}>
          <BookHeart size={18} className="text-amber-400 shrink-0" />
          <span className="min-w-0">
            <span className="block text-amber-50 text-sm truncate">Love Map</span>
            <span className="block text-stone-400 text-xs truncate">{review?.dueTotal ? `${review.dueTotal} to look back on` : 'answer questions to fill it'}</span>
          </span>
        </Link>
        <Link href="/grow/coupons" className={strip}>
          <Ticket size={18} className="text-amber-400 shrink-0" />
          <span className="min-w-0">
            <span className="block text-amber-50 text-sm truncate">Coupons</span>
            <span className="block text-stone-400 text-xs truncate">{toReveal ? `${toReveal} to reveal` : `${toUse} to use`}</span>
          </span>
        </Link>
      </div>

      <TrailMap
        routes={ROUTES} done={done}
        me={person(me, 'You')} partner={person(partner, 'Them')}
        meId={user.id} partnerId={partnerId}
        isOpen={r => routeOpen(r.key, firstDoneAt, plus)}
      />
      {!plus && (
        <p className="text-stone-500 text-xs mt-3 text-center">
          Base camp and Fighting fair are always free, and so is the first branch you start. <Link href="/plus" className="text-amber-400 hover:text-amber-300">Plus</Link> opens every branch.
        </p>
      )}

      {/* Passport: stamps for the things you do together around Hiranda */}
      <details className="mt-10 group">
        <summary className="cursor-pointer list-none flex items-baseline justify-between">
          <span className="font-serif text-[26px] text-amber-50">Passport</span>
          <span className="text-stone-400 text-xs">{earnedSet.size} of {MILESTONES.length} stamps <span className="group-open:hidden">· show</span></span>
        </summary>
        <p className="text-stone-400 text-sm mt-2 mb-5">Stamps for the things you do together around Hiranda.</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {MILESTONES.map((ms, i) => {
            const got = earnedSet.has(ms.key)
            const have = progress.get(ms.track) ?? 0
            return (
              <div key={ms.key} className={`relative aspect-square rounded-full grid place-items-center text-center p-2 ${got ? 'border-[3px] border-double' : 'border-2 border-dashed border-stone-700 opacity-60'}`}
                style={got ? { borderColor: ms.rarity === 'legendary' ? '#d4a531' : ms.rarity === 'rare' ? '#5b8fd6' : 'var(--color-amber-600)', rotate: `${[-8, 5, -3, 9, -6, 4][i % 6]}deg` } : undefined}
                title={got ? `${ms.title}: earned` : `${ms.title}: ${have}/${ms.threshold}`}>
                <span>
                  <span className={`block text-2xl ${got ? '' : 'grayscale'}`}>{ms.emoji}</span>
                  <span className={`block text-[9px] leading-tight mt-1 ${got ? 'text-amber-100' : 'text-stone-500'}`}>{got ? ms.title : `${Math.min(have, ms.threshold)}/${ms.threshold}`}</span>
                </span>
              </div>
            )
          })}
        </div>
      </details>

      <WhyItWorks className="mt-10" source="Gottman; Aron et al., 1997; Gable et al., 2004; Algoe, 2012">
        Each stop is built on a finding about couples, and most of them are links, not proof. The point isn’t a score:
        it’s small, real things you do for each other, and learning a little more about each other’s world.
      </WhyItWorks>
    </div>
  )
}
