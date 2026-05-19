'use client'

import { useEffect, useState } from 'react'

type NowPlaying = {
  song: string
  artist: string
  albumArt: string | null
  partnerName: string
}

export default function SpotifyStatus() {
  const [track, setTrack] = useState<NowPlaying | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/spotify/now-playing')
        const data = res.ok ? await res.json() : null
        setTrack(data)
      } catch {
        setTrack(null)
      }
    }

    poll()
    const interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (!track) return null

  return (
    <div className="mx-3 mb-3 bg-green-950/30 border border-green-900/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      {track.albumArt
        ? <img src={track.albumArt} alt={track.song} className="w-8 h-8 rounded-md flex-shrink-0 object-cover" />
        : <div className="w-8 h-8 rounded-md bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <Equalizer />
          </div>
      }
      <div className="min-w-0">
        <p className="text-green-300 text-xs truncate font-medium leading-tight">{track.song}</p>
        <p className="text-green-600 text-xs truncate leading-tight">{track.artist}</p>
      </div>
    </div>
  )
}

function Equalizer() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="0" y="4" width="2" height="10" rx="1" fill="#4ade80" className="animate-[bounce_1s_ease-in-out_infinite]" />
      <rect x="4" y="2" width="2" height="12" rx="1" fill="#4ade80" className="animate-[bounce_1.3s_ease-in-out_infinite]" />
      <rect x="8" y="5" width="2" height="9" rx="1" fill="#4ade80" className="animate-[bounce_0.8s_ease-in-out_infinite]" />
      <rect x="12" y="3" width="2" height="11" rx="1" fill="#4ade80" className="animate-[bounce_1.1s_ease-in-out_infinite]" />
    </svg>
  )
}
