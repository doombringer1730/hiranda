'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCircle } from 'lucide-react'

export type PresonProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  username: string | null
  status_text: string | null
}

// Deterministic warm banner gradient from a user id, so each person's card
// reads as "theirs" without needing an uploaded banner yet.
function bannerFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  const hue = 15 + (h % 45) // warm band: amber → rust
  return `linear-gradient(135deg, hsl(${hue} 45% 22%), hsl(${(hue + 20) % 360} 35% 12%))`
}

function Card({ person, online, isYou }: { person: PresonProfile; online: boolean; isYou: boolean }) {
  return (
    <div className="rounded-2xl bg-stone-900/70 border border-stone-800 overflow-hidden">
      <div className="h-12 w-full" style={{ background: bannerFor(person.id) }} />
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
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-[3px] border-stone-900 ${
                online ? 'bg-emerald-500' : 'bg-stone-600'
              }`}
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
        <p className={`text-xs mt-2 flex items-center gap-1.5 ${online ? 'text-emerald-400' : 'text-stone-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-stone-600'}`} />
          {online ? 'online' : 'offline'}
        </p>
        {person.status_text && (
          <p className="text-stone-400 text-sm mt-1.5 italic truncate">&ldquo;{person.status_text}&rdquo;</p>
        )}
      </div>
    </div>
  )
}

export default function PresenceCards({
  coupleId, me, partner,
}: { coupleId: string; me: PresonProfile; partner: PresonProfile | null }) {
  // Start optimistic: you're always online on your own screen.
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set([me.id]))

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`presence-couple-${coupleId}`, {
      config: { presence: { key: me.id } },
    })

    const sync = () => {
      const state = channel.presenceState()
      setOnlineIds(new Set([me.id, ...Object.keys(state)]))
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [coupleId, me.id])

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card person={me} online isYou />
      {partner
        ? <Card person={partner} online={onlineIds.has(partner.id)} isYou={false} />
        : (
          <div className="rounded-2xl bg-stone-900/40 border border-dashed border-stone-800 flex items-center justify-center p-4 text-center">
            <p className="text-stone-600 text-xs">Your partner&rsquo;s card appears once they join.</p>
          </div>
        )}
    </div>
  )
}
