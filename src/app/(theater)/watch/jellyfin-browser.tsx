'use client'

import { useEffect, useState } from 'react'
import { Loader2, Film, Settings } from 'lucide-react'
import Link from 'next/link'
import { createWatchSessionFromUrl } from './actions'
import { useRouter } from 'next/navigation'

type JellyfinItem = {
  Id: string
  Name: string
  Type: string
  ImageTags: { Primary?: string }
  ProductionYear?: number
}

type Props = {
  jellyfinUrl: string
  jellyfinApiKey: string
}

export default function JellyfinBrowser({ jellyfinUrl, jellyfinApiKey }: Props) {
  const [items, setItems] = useState<JellyfinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [starting, setStarting] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const usersRes = await fetch(`${jellyfinUrl}/Users?api_key=${jellyfinApiKey}`)
        if (!usersRes.ok) throw new Error('Could not reach Jellyfin — check your URL and API key')
        const users = await usersRes.json()
        const userId = users[0]?.Id
        if (!userId) throw new Error('No Jellyfin users found')

        const itemsRes = await fetch(
          `${jellyfinUrl}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&SortBy=SortName&SortOrder=Ascending&api_key=${jellyfinApiKey}`
        )
        if (!itemsRes.ok) throw new Error('Could not load library')
        const data = await itemsRes.json()
        setItems(data.Items ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load library')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jellyfinUrl, jellyfinApiKey])

  async function startSession(item: JellyfinItem) {
    setStarting(item.Id)
    // static=true — direct file serve, no transcoding (Pi only has 1GB RAM)
    const streamUrl = `${jellyfinUrl}/Videos/${item.Id}/stream?static=true&api_key=${jellyfinApiKey}`
    const result = await createWatchSessionFromUrl(item.Name, streamUrl)
    if (result?.sessionId) {
      router.push(`/watch/${result.sessionId}`)
    } else {
      setStarting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-stone-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 flex flex-col gap-2">
        <p className="text-red-400 text-sm">{error}</p>
        <p className="text-stone-600 text-xs">Make sure your device is on Tailscale and the server URL is correct.</p>
      </div>
    )
  }

  const filtered = search
    ? items.filter(i => i.Name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search your library…"
        className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
      />

      {filtered.length === 0 && (
        <p className="text-stone-500 text-sm text-center py-6">No results.</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {filtered.map(item => (
          <button
            key={item.Id}
            onClick={() => startSession(item)}
            disabled={!!starting}
            className="flex flex-col gap-1.5 text-left disabled:opacity-60 group"
          >
            <div className="aspect-[2/3] bg-stone-800 rounded-xl overflow-hidden relative">
              {item.ImageTags.Primary ? (
                <img
                  src={`${jellyfinUrl}/Items/${item.Id}/Images/Primary?api_key=${jellyfinApiKey}&width=200&quality=80`}
                  alt={item.Name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={24} className="text-stone-600" />
                </div>
              )}
              {starting === item.Id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-amber-400" />
                </div>
              )}
            </div>
            <p className="text-amber-100 text-xs leading-tight line-clamp-2">{item.Name}</p>
            {item.ProductionYear && (
              <p className="text-stone-600 text-xs">{item.ProductionYear}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function JellyfinNotConfigured() {
  return (
    <div className="text-center py-12 flex flex-col items-center gap-3">
      <Film size={36} className="text-stone-700" />
      <p className="text-stone-500 text-sm">Connect your Jellyfin server first.</p>
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-amber-600 hover:text-amber-500 text-sm transition-colors"
      >
        <Settings size={14} /> Go to Settings
      </Link>
    </div>
  )
}
