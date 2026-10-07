'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { celebrate, haptic } from '@/lib/feel'
import { confirmArrived } from '@/app/(app)/store/actions'

export type IncomingGift = { id: string; status: string; tracking_url: string | null }

// "A gift from Hudson is on its way" — what it is stays a surprise until it
// arrives. Tapping "It arrived!" thanks them and clears the card.
export default function IncomingGiftCard({ gift, from }: { gift: IncomingGift; from: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const shipped = gift.status === 'shipped'
  return (
    <div className="paper rounded-[6px] px-5 py-4 -rotate-[0.4deg] flex items-center gap-4">
      <span className="text-4xl" aria-hidden="true">{shipped ? '📦' : '🎁'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-hand text-[24px] leading-tight text-[var(--paper-ink)]">{from} sent you something.</p>
        <p className="text-sm text-[var(--paper-muted)]">
          {shipped ? 'It’s shipped — keep an eye on the mailbox.' : 'It’s on its way. No peeking.'}
          {shipped && gift.tracking_url && <> <a href={gift.tracking_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Track it</a></>}
        </p>
      </div>
      <button
        disabled={pending}
        onClick={e => start(async () => { haptic(); celebrate(e.currentTarget); await confirmArrived(gift.id); router.refresh() })}
        className="shrink-0 h-9 px-3 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-xs font-medium disabled:opacity-60"
      >
        It arrived!
      </button>
    </div>
  )
}
