'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// A slim way back to Hiranda on the Theater's home. The player and party
// screens are full-screen and carry their own back links, so it hides there.
export default function TheaterBar() {
  const pathname = usePathname()
  if (pathname !== '/watch') return null
  return (
    <div className="sticky top-0 z-20 bg-stone-950/85 backdrop-blur border-b border-stone-800/70 pt-[env(safe-area-inset-top)]">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm transition-colors">
          <ArrowLeft size={16} /> Hiranda
        </Link>
        <span className="ml-auto font-hand text-[19px] text-amber-400/80">movie night</span>
      </div>
    </div>
  )
}
