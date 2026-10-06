'use client'
/// <reference types="react/canary" />

import { ViewTransition } from 'react'
import { usePathname } from 'next/navigation'

// Pages rise in and the old one fades back on navigation (see `.page` in
// globals.css). /watch and /party render untouched — no snapshotting over a
// live synced video.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (/^\/(watch|party)(\/|$)/.test(pathname)) return <>{children}</>
  return (
    <ViewTransition key={pathname} enter="page" exit="page" default="none">
      <div>{children}</div>
    </ViewTransition>
  )
}
