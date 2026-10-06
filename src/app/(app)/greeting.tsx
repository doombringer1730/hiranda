'use client'

import { useSyncExternalStore } from 'react'

// The greeting and date depend on the viewer's clock, so they're worked out in
// the browser — the server runs on UTC and would say "good morning" at night.
// On the server (and the first paint) it renders without them.
const subscribe = () => () => {}

function greeting(h: number) {
  if (h < 5) return 'still up'
  if (h < 12) return 'good morning'
  if (h < 18) return 'good afternoon'
  return 'good evening'
}

function useNow() {
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 60_000), () => null)
}

export function TodayLine() {
  const minute = useNow()
  if (minute === null) return <>&nbsp;</>
  return <>{new Date(minute * 60_000).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</>
}

export function Greeting() {
  const minute = useNow()
  if (minute === null) return <>hello</>
  // Friends: Joey drops by now and then (stable for a given minute).
  if (minute % 13 === 0) return <>how you doin’</>
  return <>{greeting(new Date(minute * 60_000).getHours())}</>
}
