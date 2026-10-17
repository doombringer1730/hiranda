import { notFound, redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { stopByKey, routeState, SAFETY_NOTE } from '@/lib/grow-map'
import { hasPlus } from '@/lib/plus'
import { loadProgress, accessOf } from '../../map-data'
import LessonClient from './lesson-client'

export default async function LessonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const stop = stopByKey(key)
  if (!stop) notFound()
  const ctx = await coupleContext()
  if (!ctx) redirect('/')

  const [map, people, plus, { data: answers }] = await Promise.all([
    loadProgress(ctx),
    getPeople(),
    hasPlus(),
    stop.predict
      ? ctx.supabase.from('lesson_answers').select('user_id, mine, guess').eq('couple_id', ctx.couple.id).eq('lesson_key', key)
      : Promise.resolve({ data: [] as { user_id: string; mine: number; guess: number }[] }),
  ])
  const access = accessOf(stop.route.key, map, plus, ctx.user.id)
  if (access === 'plus') redirect('/plus')
  // Hard topics open only with a yes from each of you (suggest it on the map).
  if (access !== 'open') redirect('/grow')
  const { done, notes } = map

  const route = stop.route
  // Stops go in order for each of you: a stop further along than your next one
  // sends you straight to your next one (one redirect, never a chain).
  const myNext = routeState(route, done, ctx.user.id, ctx.partnerId).next
  if (!done.get(key)?.has(ctx.user.id) && myNext && route.stops.indexOf(myNext) < stop.index) redirect(`/grow/lesson/${myNext.key}`)

  const iDid = !!done.get(key)?.has(ctx.user.id)
  const theyDid = !!done.get(key)?.has(ctx.partnerId)
  const myAnswer = answers?.find(a => a.user_id === ctx.user.id) ?? null
  // The read rule only returns theirs once yours exists (migration 051).
  const theirAnswer = answers?.find(a => a.user_id === ctx.partnerId) ?? null
  const next = routeState(route, done, ctx.user.id, ctx.partnerId).next

  return (
    <LessonClient
      stop={{
        key: stop.key, title: stop.title, guess: stop.guess ?? null, learn: stop.learn, source: stop.source,
        caveat: stop.caveat ?? null, predict: stop.predict ?? null, do: stop.do, reflect: stop.reflect,
      }}
      route={{ key: route.key, title: route.title, emoji: route.emoji, color: route.color, safety: route.key === 'repair' ? SAFETY_NOTE : null }}
      position={{ n: stop.index + 1, of: route.stops.length }}
      myName={people.get(ctx.user.id)?.first || 'You'}
      partnerName={people.get(ctx.partnerId)?.first ?? 'your partner'}
      done={{ me: iDid, them: theyDid }}
      // Their reflection stays private until you've finished too.
      notes={{ mine: notes.get(key)?.get(ctx.user.id) ?? null, theirs: iDid ? notes.get(key)?.get(ctx.partnerId) ?? null : null }}
      answers={{ mine: myAnswer ? { mine: myAnswer.mine, guess: myAnswer.guess } : null, theirs: theirAnswer ? { mine: theirAnswer.mine, guess: theirAnswer.guess } : null }}
      next={next && next.key !== key ? { key: next.key, title: next.title } : null}
    />
  )
}
