'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isPaired } from './actions'
import { celebrate } from '@/lib/feel'

// While the inviter waits on this screen, check every few seconds whether
// their partner has joined, and take them into the app the moment they do.
export default function PartnerWatcher() {
  const router = useRouter()
  useEffect(() => {
    let done = false
    const check = async () => {
      if (done || document.visibilityState === 'hidden') return
      if (await isPaired()) {
        done = true
        celebrate()
        setTimeout(() => { router.replace('/'); router.refresh() }, 900)
      }
    }
    const interval = setInterval(check, 4000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check) }
  }, [router])
  return (
    <p className="flex items-center justify-center gap-2 text-stone-500 text-xs mb-8">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Waiting for your partner — this page updates on its own.
    </p>
  )
}
