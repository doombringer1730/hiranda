'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  sessionId: string
  videoUrl: string
  userId: string
  initialState: 'playing' | 'paused'
  initialPosition: number
}

export default function WatchPlayer({ sessionId, videoUrl, userId, initialState, initialPosition }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Prevents feedback loops when we apply a remote update locally
  const applyingRemote = useRef(false)
  const supabase = createClient()

  const pushState = useCallback(async (state: 'playing' | 'paused', position: number) => {
    if (applyingRemote.current) return
    await supabase.from('watch_sessions').update({
      state,
      playback_position_seconds: position,
      last_updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)
  }, [sessionId, userId, supabase])

  // Subscribe to remote changes
  useEffect(() => {
    const channel = supabase
      .channel(`watch:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'watch_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const video = videoRef.current
        if (!video) return
        const { state, playback_position_seconds, last_updated_by } = payload.new

        // Ignore our own updates
        if (last_updated_by === userId) return

        applyingRemote.current = true

        const drift = Math.abs(video.currentTime - playback_position_seconds)
        if (drift > 1.5) video.currentTime = playback_position_seconds

        if (state === 'playing' && video.paused) video.play()
        if (state === 'paused' && !video.paused) video.pause()

        setTimeout(() => { applyingRemote.current = false }, 300)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, userId, supabase])

  // Restore initial position
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = initialPosition
    if (initialState === 'playing') video.play().catch(() => {})
  }, [initialPosition, initialState])

  return (
    <div className="bg-black rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full max-h-[70vh]"
        onPlay={(e) => pushState('playing', (e.target as HTMLVideoElement).currentTime)}
        onPause={(e) => pushState('paused', (e.target as HTMLVideoElement).currentTime)}
        onSeeked={(e) => {
          const video = e.target as HTMLVideoElement
          pushState(video.paused ? 'paused' : 'playing', video.currentTime)
        }}
      />
      <div className="px-5 py-3 bg-stone-900 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <p className="text-stone-400 text-xs">Synced — play, pause, or seek and it mirrors for both of you</p>
      </div>
    </div>
  )
}
