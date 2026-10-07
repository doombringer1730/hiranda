'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil } from 'lucide-react'
import ProfileEditor, { type EditableProfile } from './profile-editor'

export type PresonProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  username: string | null
  status_text: string | null
  accent_color: string | null
  banner_url: string | null
  bio: string | null
  activity: string | null
  activity_at: string | null
}

// An activity (e.g. "quizzing") counts as live only if set in the last 10 min.
function liveActivity(p: PresonProfile): string | null {
  if (!p.activity || !p.activity_at) return null
  return Date.now() - new Date(p.activity_at).getTime() < 10 * 60_000 ? p.activity : null
}

const DEFAULT_ACCENT = '#b45309'

function bannerStyle(p: PresonProfile) {
  const accent = p.accent_color || DEFAULT_ACCENT
  if (p.banner_url) return { backgroundImage: `url(${p.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: `linear-gradient(135deg, ${accent}, ${accent}22 70%, transparent)` }
}

type Track = { song: string; artist: string; albumArt: string | null }

function SpotifyLine({ who }: { who: 'self' | 'partner' }) {
  const [track, setTrack] = useState<Track | null>(null)
  useEffect(() => {
    let alive = true
    const url = `/api/spotify/now-playing${who === 'self' ? '?who=self' : ''}`
    const poll = async () => {
      try { const r = await fetch(url); const d = r.ok ? await r.json() : null; if (alive) setTrack(d) }
      catch { if (alive) setTrack(null) }
    }
    poll()
    const iv = setInterval(poll, 30_000)
    return () => { alive = false; clearInterval(iv) }
  }, [who])

  if (!track) return null
  return (
    <div className="mt-2 flex items-center gap-2 bg-green-950/30 border border-green-900/40 rounded-lg px-2 py-1.5">
      {track.albumArt
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={track.albumArt} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
        : <span className="w-6 h-6 rounded bg-green-900/40 shrink-0" />}
      <div className="min-w-0">
        <p className="text-green-300 text-[11px] leading-tight truncate font-medium">{track.song}</p>
        <p className="text-green-600/90 text-[11px] leading-tight truncate">{track.artist}</p>
      </div>
    </div>
  )
}

// Who's here right now (Supabase Realtime presence on the couple's channel).
export function usePresence(coupleId: string, myId: string) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set([myId]))
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`presence-couple-${coupleId}`, { config: { presence: { key: myId } } })
    const sync = () => setOnlineIds(new Set([myId, ...Object.keys(channel.presenceState())]))
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
      })
    return () => { supabase.removeChannel(channel) }
  }, [coupleId, myId])
  return onlineIds
}

export function Avatar({ person, size = 40, online, ring = 'ring-stone-950' }: { person: PresonProfile; size?: number; online?: boolean; ring?: string }) {
  return (
    <span className="relative inline-grid shrink-0" style={{ width: size, height: size }}>
      <span className={`grid place-items-center rounded-full overflow-hidden font-semibold text-amber-50 ring-2 ${ring}`} style={{ width: size, height: size, fontSize: size * 0.4, background: person.accent_color || DEFAULT_ACCENT }}>
        {person.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
          : person.display_name.slice(0, 1).toUpperCase()}
      </span>
      {online !== undefined && (
        <span aria-label={online ? 'online' : 'offline'} className={`absolute bottom-0 right-0 rounded-full ring-[3px] ${ring} ${online ? 'bg-emerald-500' : 'bg-stone-600'}`} style={{ width: size * 0.28, height: size * 0.28 }} />
      )}
    </span>
  )
}

// A Discord-style profile card: banner, big avatar with presence, status in
// handwriting, what they're up to, and the little things you'd want to see.
export function ProfileCard({ person, online, isYou, togetherDays, onEdit }: {
  person: PresonProfile; online: boolean; isYou: boolean; togetherDays?: number | null; onEdit?: () => void
}) {
  const activity = liveActivity(person)
  return (
    <div className="relative rounded-[24px] bg-stone-900 overflow-hidden shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)]">
      <div className="h-24 w-full" style={bannerStyle(person)} />
      {isYou && onEdit && (
        <button onClick={onEdit} className="absolute top-3 right-3 h-8 px-3 rounded-full bg-black/45 backdrop-blur text-white/90 hover:text-white text-xs font-medium flex items-center gap-1.5">
          <Pencil size={12} /> Edit profile
        </button>
      )}
      <div className="px-5 pb-5">
        <div className="-mt-11 mb-2"><Avatar person={person} size={84} online={online} ring="ring-stone-900" /></div>
        <p className="font-serif text-[28px] leading-tight text-amber-50">{person.display_name}</p>
        <p className="text-stone-400 text-sm">
          {person.username ? `@${person.username}` : ''}{isYou ? (person.username ? ' · you' : 'you') : online ? (person.username ? ' · online now' : 'online now') : ''}
        </p>
        {activity === 'quizzing' ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-700/20 px-2.5 py-1 text-xs text-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> quizzing 📚
          </p>
        ) : person.status_text ? (
          <p className="font-hand text-amber-200 text-[24px] leading-tight mt-2">{person.status_text}</p>
        ) : null}
        <SpotifyLine who={isYou ? 'self' : 'partner'} />
        {(person.bio || togetherDays != null) && <div className="h-px bg-stone-800 my-4" />}
        {person.bio && (
          <div className="mb-3">
            <p className="text-stone-500 text-[11px] uppercase tracking-[0.18em] mb-1">About</p>
            <p className="text-stone-200 text-sm leading-relaxed whitespace-pre-wrap">{person.bio}</p>
          </div>
        )}
        {togetherDays != null && (
          <div>
            <p className="text-stone-500 text-[11px] uppercase tracking-[0.18em] mb-1">Together</p>
            <p className="text-stone-200 text-sm">{togetherDays.toLocaleString()} days and counting</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function editableFrom(me: PresonProfile): EditableProfile {
  return {
    id: me.id, display_name: me.display_name, avatar_url: me.avatar_url,
    banner_url: me.banner_url, accent_color: me.accent_color, bio: me.bio, status_text: me.status_text,
  }
}

export { ProfileEditor }
