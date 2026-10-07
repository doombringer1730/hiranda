'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Play, Users, Timer, ExternalLink, Clapperboard } from 'lucide-react'
import { startArchiveSession, startPartySession, startYouTubeSession } from '../../../discover-actions'
import type { SyncMode, WatchOption } from '@/theater/catalog/types'
import { MODE_COPY } from '@/theater/catalog/providers'
import { useIsNativeApp } from '@/theater/native'

type Started = { sessionId?: string; error?: string }

function useStart() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function run(action: () => Promise<Started>, path: (id: string) => string) {
    setError(null)
    start(async () => {
      const res = await action()
      if (res.error || !res.sessionId) { setError(res.error ?? 'Something went wrong'); return }
      router.push(path(res.sessionId))
    })
  }
  return { pending, error, run }
}

const primary = 'inline-flex items-center justify-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-amber-50 text-sm font-medium px-5 h-11 transition-colors'
const secondary = 'inline-flex items-center justify-center gap-2 rounded-full bg-stone-800 hover:bg-stone-700 disabled:opacity-60 text-stone-100 text-sm font-medium px-4 h-10 transition-colors'

export function PlayHereButton({ archiveId }: { archiveId: string }) {
  const { pending, error, run } = useStart()
  return (
    <div className="flex flex-col gap-1.5">
      <button className={primary} disabled={pending} onClick={() => run(() => startArchiveSession(archiveId), id => `/watch/${id}`)}>
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Watch together here
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export function TrailerButton({ youTubeId, title, poster }: { youTubeId: string; title: string; poster: string | null }) {
  const { pending, error, run } = useStart()
  return (
    <div className="flex flex-col gap-1.5">
      <button className={secondary} disabled={pending}
        onClick={() => run(() => startYouTubeSession(youTubeId, `${title} — trailer`, poster ?? undefined), id => `/watch/${id}`)}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Clapperboard size={15} />} Watch the trailer together
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export function YouTubeLinkForm({ title, poster }: { title: string; poster: string | null }) {
  const { pending, error, run } = useStart()
  const [link, setLink] = useState('')
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={e => { e.preventDefault(); if (link.trim()) run(() => startYouTubeSession(link, title, poster ?? undefined), id => `/watch/${id}`) }}
    >
      <div className="flex gap-2">
        <input
          value={link}
          onChange={e => setLink(e.target.value)}
          inputMode="url"
          placeholder="Paste a YouTube link"
          aria-label="YouTube link"
          className="flex-1 min-w-0 bg-stone-950 border border-stone-800 rounded-full px-4 h-10 text-sm text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700"
        />
        <button className={secondary} disabled={pending || !link.trim()}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Sync
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  )
}

const MODE_ICON: Record<SyncMode, typeof Users> = { here: Play, party: Users, countdown: Timer }

export function PartyButton({ platform, provider, title, poster, url, mode }: {
  platform: string; provider: string; title: string; poster: string | null; url: string; mode: SyncMode
}) {
  const { pending, error, run } = useStart()
  const Icon = MODE_ICON[mode]
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${provider}`} className="grid place-items-center h-10 w-10 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors">
          <ExternalLink size={15} />
        </a>
        <button className={secondary} disabled={pending}
          onClick={() => run(() => startPartySession({ platform, title, poster, url }), id => `/party/${id}`)}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />} {mode === 'party' ? 'Watch party' : 'Start together'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

const OFFER_LABEL: Record<WatchOption['offer'], string> = { free: 'Free', ads: 'Free with ads', subscription: 'Subscription', rent: 'Rent', buy: 'Buy' }

export function Group({ mode, children }: { mode: SyncMode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex flex-col gap-4">
      <div>
        <p className="text-amber-200 text-sm font-medium">{MODE_COPY[mode].label}</p>
        <p className="text-stone-500 text-xs mt-0.5">{MODE_COPY[mode].hint}</p>
      </div>
      {children}
    </div>
  )
}

function OptionRow({ o, mode, title, poster }: { o: WatchOption; mode: SyncMode; title: string; poster: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {o.logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={o.logo} alt="" className="h-10 w-10 rounded-xl shrink-0" />
        : <span className="h-10 w-10 rounded-xl bg-stone-800 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-stone-100 text-sm truncate">{o.provider}</p>
        <p className="text-stone-500 text-xs">{OFFER_LABEL[o.offer]}</p>
      </div>
      <PartyButton platform={o.platform} provider={o.provider} title={title} poster={poster} url={o.url} mode={mode} />
    </div>
  )
}

// Streaming services, grouped by how you can watch together. Inside the iPhone
// app the extension can't run, so every service becomes "Start together".
export function ServiceGroups({ options, title, poster }: { options: WatchOption[]; title: string; poster: string | null }) {
  const native = useIsNativeApp()
  const modeOf = (o: WatchOption): SyncMode => (native && o.mode === 'party' ? 'countdown' : o.mode)
  return (
    <>
      {(['party', 'countdown'] as const).map(mode => {
        const list = options.filter(o => modeOf(o) === mode)
        if (!list.length) return null
        return (
          <Group key={mode} mode={mode}>
            {list.map(o => <OptionRow key={`${o.platform}-${o.offer}`} o={o} mode={mode} title={title} poster={poster} />)}
          </Group>
        )
      })}
    </>
  )
}
