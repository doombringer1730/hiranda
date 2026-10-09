import { notFound, redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { hasPlus } from '@/lib/plus'
import { trailByKey, openDay, FREE_TRAIL_DAYS } from '@/lib/trails'
import TrailClient from './trail-client'

export default async function TrailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const trail = trailByKey(key)
  if (!trail) notFound()
  const ctx = await coupleContext()
  if (!ctx) redirect('/')

  const [{ data: rows }, { data: stamp }, people, plus] = await Promise.all([
    ctx.supabase.from('trail_progress').select('user_id, day, note').eq('couple_id', ctx.couple.id).eq('trail_key', key),
    ctx.supabase.from('trail_stamps').select('earned_at').eq('couple_id', ctx.couple.id).eq('trail_key', key).maybeSingle(),
    getPeople(),
    hasPlus(),
  ])
  const doneBy = new Map<number, Set<string>>()
  for (const r of rows ?? []) doneBy.set(r.day, (doneBy.get(r.day) ?? new Set()).add(r.user_id))
  const open = openDay(trail, doneBy, ctx.user.id, ctx.partnerId)

  const days = trail.days.map((d, i) => {
    const n = i + 1
    const mine = rows?.find(r => r.day === n && r.user_id === ctx.user.id) ?? null
    const theirs = rows?.find(r => r.day === n && r.user_id === ctx.partnerId) ?? null
    return {
      ...d, n,
      state: n < open ? 'together' as const : n === open ? 'open' as const : 'later' as const,
      plusOnly: n > FREE_TRAIL_DAYS && !plus,
      mine: mine ? { note: mine.note as string | null } : null,
      // Their note stays private until you've finished that day too.
      theirs: theirs ? { note: mine ? theirs.note as string | null : null } : null,
    }
  })

  return (
    <TrailClient
      trail={{ key: trail.key, title: trail.title, emoji: trail.emoji, color: trail.color, blurb: trail.blurb }}
      days={days}
      open={open}
      stamped={!!stamp}
      partnerName={people.get(ctx.partnerId)?.first ?? 'your partner'}
    />
  )
}
