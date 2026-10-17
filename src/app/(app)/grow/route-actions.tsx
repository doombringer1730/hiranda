'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { haptic, toast } from '@/lib/feel'
import type { Access } from '@/lib/grow-map'
import { notYetRoute, sayYesToRoute, suggestRoute } from './actions'

// The quiet controls on a hard-topic route: suggest it, take it back, or
// answer a suggestion. "Not yet" is as easy as yes, and leaves no trace.
export default function RouteActions({ routeKey, access, partner }: { routeKey: string; access: Access; partner: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: (k: string) => Promise<{ ok?: boolean; error?: string }>) => () => {
    haptic()
    start(async () => {
      const res = await fn(routeKey)
      if (res.error) toast(res.error)
      router.refresh()
    })
  }
  const button = 'h-8 px-3 rounded-full text-[12px] font-medium transition-colors disabled:opacity-50'

  return (
    <div className="mt-2 ml-7 flex flex-wrap items-center gap-2">
      {access === 'suggest' && (
        <>
          <button disabled={pending} onClick={run(suggestRoute)} className={`${button} bg-[var(--paper-ink)] text-[var(--paper)]`}>Suggest to {partner}</button>
          <span className="text-[11px] text-[var(--paper-muted)]">A tender topic: it opens when you both say yes.</span>
        </>
      )}
      {access === 'you-suggested' && (
        <>
          <span className="text-[12px] text-[var(--paper-muted)]">You suggested this. It opens if {partner} says yes.</span>
          <button disabled={pending} onClick={run(notYetRoute)} className={`${button} text-[var(--paper-muted)] underline underline-offset-2`}>Take it back</button>
        </>
      )}
      {access === 'they-suggested' && (
        <>
          <span className="text-[12px] text-[var(--paper-ink)]">{partner} suggested this.</span>
          <button disabled={pending} onClick={run(sayYesToRoute)} className={`${button} bg-[var(--paper-ink)] text-[var(--paper)]`}>Open it together</button>
          <button disabled={pending} onClick={run(notYetRoute)} className={`${button} border border-[rgb(43_38_32/0.25)] text-[var(--paper-ink)]`}>Not yet</button>
        </>
      )}
    </div>
  )
}
