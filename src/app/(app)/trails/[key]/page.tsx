import { redirect } from 'next/navigation'
import { routeByKey, stopKeyForTrailDay } from '@/lib/grow-map'

// Old trail links (notifications, bookmarks) land on that route's map stop.
export default async function TrailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const first = stopKeyForTrailDay(key, 1)
  const route = routeByKey(key)
  redirect(first ? `/grow/lesson/${route?.stops[0].key ?? first}` : '/grow')
}
