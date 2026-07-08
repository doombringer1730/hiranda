'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCircle, Pencil } from 'lucide-react'
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

function Card({ person, online, isYou, onEdit }: { person: PresonProfile; online: boolean; isYou: boolean; onEdit?: () => void }) {
  return (
    <div className="relative rounded-2xl bg-stone-900/70 border border-stone-800 overflow-hidden">
      <div className="h-12 w-full" style={bannerStyle(person)} />
      {isYou && onEdit && (
        <button onClick={onEdit} aria-label="Edit profile"
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur text-white/85 hover:text-white flex items-center justify-center">
          <Pencil size={13} />
        </button>
      )}
      <div className="px-4 pb-4">
        <div className="flex items-end gap-3 -mt-6">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-stone-800 border-4 border-stone-900 overflow-hidden flex items-center justify-center">
              {person.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={person.avatar_url} alt={person.display_name} className="w-full h-full object-cover" />
                : <UserCircle size={28} className="text-stone-600" />}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-[3px] border-stone-900 ${online ? 'bg-emerald-500' : 'bg-stone-600'}`}
              aria-label={online ? 'online' : 'offline'}
            />
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-amber-100 font-medium leading-tight truncate">{person.display_name}</p>
            <p className="text-stone-500 text-xs truncate">
              {person.username ? `@${person.username}` : ''}{isYou && (person.username ? ' · you' : 'you')}
            </p>
          </div>
        </div>
        {person.status_text && (
          <p className="text-stone-400 text-sm mt-1.5 italic truncate">&ldquo;{person.status_text}&rdquo;</p>
        )}
        <SpotifyLine who={isYou ? 'self' : 'partner'} />
      </div>
    </div>
  )
}

export default function PresenceCards({
  coupleId, me, partner,
}: { coupleId: string; me: PresonProfile; partner: PresonProfile | null }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set([me.id]))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`presence-couple-${coupleId}`, {
      config: { presence: { key: me.id } },
    })
    const sync = () => setOnlineIds(new Set([me.id, ...Object.keys(channel.presenceState())]))
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
      })
    return () => { supabase.removeChannel(channel) }
  }, [coupleId, me.id])

  const editable: EditableProfile = {
    id: me.id, display_name: me.display_name, avatar_url: me.avatar_url,
    banner_url: me.banner_url, accent_color: me.accent_color, bio: me.bio, status_text: me.status_text,
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Card person={me} online isYou onEdit={() => setEditing(true)} />
        {partner
          ? <Card person={partner} online={onlineIds.has(partner.id)} isYou={false} />
          : (
            <div className="rounded-2xl bg-stone-900/40 border border-dashed border-stone-800 flex items-center justify-center p-4 text-center">
              <p className="text-stone-600 text-xs">Your partner&rsquo;s card appears once they join.</p>
            </div>
          )}
      </div>
      {editing && <ProfileEditor profile={editable} onClose={() => setEditing(false)} />}
    </>
  )
}
