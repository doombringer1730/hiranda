import { notFound, redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { stopByKey, routeState, SAFETY_NOTE } from '@/lib/grow-map'
import { hasPlus } from '@/lib/plus'
import { loadProgress, routeOpen } from '../../map-data'
import LessonClient from './lesson-client'

export default async function LessonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const stop = stopByKey(key)
  if (!stop) notFound()
  const ctx = await coupleContext()
  if (!ctx) redirect('/')

  const [{ done, notes, firstDoneAt }, people, plus, { data: answers }] = await Promise.all([
    loadProgress(ctx),
    getPeople(),
    hasPlus(),
    stop.predict
      ? ctx.supabase.from('lesson_answers').select('user_id, mine, guess').eq('couple_id', ctx.couple.id).eq('lesson_key', key)
      : Promise.resolve({ data: [] as { user_id: string; mine: number; guess: number }[] }),
  ])
  if (!routeOpen(stop.route.key, firstDoneAt, plus)) redirect('/plus')

  const route = stop.route
  const minePrev = route.stops[stop.index - 1]
  // Stops go in order for each of you: finish the one before first.
  if (minePrev && !done.get(minePrev.key)?.has(ctx.user.id) && !done.get(key)?.has(ctx.user.id)) redirect(`/grow/lesson/${minePrev.key}`)

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
      partnerName={people.get(ctx.partnerId)?.first ?? 'your partner'}
      done={{ me: iDid, them: theyDid }}
      // Their reflection stays private until you've finished too.
      notes={{ mine: notes.get(key)?.get(ctx.user.id) ?? null, theirs: iDid ? notes.get(key)?.get(ctx.partnerId) ?? null : null }}
      answers={{ mine: myAnswer ? { mine: myAnswer.mine, guess: myAnswer.guess } : null, theirs: theirAnswer ? { mine: theirAnswer.mine, guess: theirAnswer.guess } : null }}
      next={next && next.key !== key ? { key: next.key, title: next.title } : null}
    />
  )
}
