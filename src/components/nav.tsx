'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Settings, LogOut } from 'lucide-react'
import { SidebarTimer } from './couple-timer'
import SpotifyStatus from './spotify-status'
import { logout } from '@/app/(auth)/actions'
import { hubsFor, hubFor, itemFor, type Hub } from '@/lib/hubs'
import { haptic } from '@/lib/feel'
import { useLive } from '@/lib/use-live'
import { unreadCount } from '@/app/(app)/chat/actions'

const lastKey = (hub: string) => `hiranda:hub:${hub}`

// Like an iOS tab bar, each tab remembers where you were inside it.
function rememberedHref(hub: Hub) {
  try {
    const last = sessionStorage.getItem(lastKey(hub.key))
    if (last && hub.items.some(i => last === i.href || last.startsWith(i.href + '/'))) return last
  } catch {}
  return hub.items[0].href
}

// Unread chat messages, live. Row-level security limits the realtime feed to
// your own couple, so no filter is needed.
function useUnread(pathname: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    unreadCount().then(c => { if (live) setN(c) })
    return () => { live = false }
  }, [pathname])
  useLive({ table: 'messages', fallbackMs: 60_000 }, () => { void unreadCount().then(setN) })
  return pathname === '/chat' ? 0 : n
}

function Badge({ n, className = '' }: { n: number; className?: string }) {
  if (!n) return null
  return (
    <span aria-label={`${n} unread`} className={`grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold leading-none animate-pop ${className}`}>
      {n > 9 ? '9+' : n}
    </span>
  )
}

export default function Nav({ theaterUnlocked = false }: { theaterUnlocked?: boolean }) {
  const pathname = usePathname()
  const unread = useUnread(pathname)
  const router = useRouter()
  const hubs = hubsFor(theaterUnlocked)
  const active = hubFor(pathname, hubs)
  const activeIndex = active ? hubs.indexOf(active) : -1

  useEffect(() => {
    if (!active) return
    try { sessionStorage.setItem(lastKey(active.key), pathname) } catch {}
  }, [active, pathname])

  function openHub(e: React.MouseEvent, hub: Hub) {
    haptic()
    // Tapping the tab you're already in pops back to its first page.
    const href = hub === active ? hub.items[0].href : rememberedHref(hub)
    if (href !== hub.items[0].href || hub === active) {
      e.preventDefault()
      if (href !== pathname) router.push(href)
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <>
      {/* ── Desktop: floating sidebar ── */}
      <aside
        style={{ viewTransitionName: 'sidebar' }}
        className="hidden md:flex flex-col fixed left-3 top-3 bottom-3 w-60 z-40 rounded-[28px] material px-3 py-6 overflow-hidden"
      >
        <Link href="/" className="px-3 mb-5 block" aria-label="Hiranda home">
          <span className="font-serif text-[1.9rem] leading-none text-amber-50">Hiranda<span className="text-amber-500">.</span></span>
          <span className="block mt-2 text-[9px] uppercase tracking-[0.3em] text-stone-500">our little place</span>
        </Link>

        <nav className="flex flex-col gap-3.5 flex-1 overflow-y-auto -mx-1 px-1 [scrollbar-width:none]">
          {hubs.map(hub => (
            <div key={hub.key} className="flex flex-col gap-0.5">
              {hub.items.length > 1 && (
                <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">{hub.label}</p>
              )}
              {hub.items.map(item => {
                const on = itemFor(pathname, hub) === item
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[14px] transition-colors ${
                      on ? 'bg-stone-800/80 text-amber-50' : 'text-stone-400 hover:text-amber-50 hover:bg-stone-800/40'
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                      on ? 'bg-amber-600 text-amber-50' : 'bg-stone-800/70 text-stone-400'
                    }`}>
                      <Icon size={13} strokeWidth={2.2} />
                    </span>
                    {item.title ?? item.label}
                    {item.href === '/chat' && <Badge n={unread} className="ml-auto" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="pt-3 flex flex-col gap-1">
          <SpotifyStatus />
          <SidebarTimer />
          <div className="flex items-center gap-1 px-1">
            <Link
              href="/settings"
              className={`flex flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-[14px] transition-colors ${
                pathname === '/settings' ? 'bg-stone-800/80 text-amber-50' : 'text-stone-400 hover:text-amber-50 hover:bg-stone-800/40'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-800/70"><Settings size={13} /></span>
              Settings
            </Link>
            <form action={logout}>
              <button type="submit" aria-label="Sign out" title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:text-red-400 hover:bg-stone-800/40 transition-colors">
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Mobile: floating tab bar ── */}
      <nav
        aria-label="Tabs"
        style={{ viewTransitionName: 'tabbar' }}
        className="md:hidden fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-50 h-[64px] rounded-[32px] material"
      >
        <div className="relative grid h-full grid-cols-5 p-1.5">
          {/* Sliding selection pill */}
          {activeIndex >= 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 bottom-1.5 left-1.5 rounded-[26px] bg-stone-800/90 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.08)]"
              style={{
                width: 'calc((100% - 0.75rem) / 5)',
                translate: `calc(${activeIndex} * 100%) 0`,
                transition: 'translate var(--spring-duration) var(--spring)',
              }}
            />
          )}
          {hubs.map((hub, i) => {
            const on = i === activeIndex
            const Icon = hub.icon
            return (
              <Link
                key={hub.key}
                href={hub.items[0].href}
                onClick={e => openHub(e, hub)}
                aria-current={on ? 'page' : undefined}
                className={`relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-[26px] transition-colors ${
                  on ? 'text-amber-300' : 'text-stone-500 active:text-stone-300'
                }`}
              >
                <Icon key={on ? 'on' : 'off'} size={21} strokeWidth={on ? 2.2 : 1.8} className={on ? 'animate-pop' : ''} fill={on && hub.key === 'us' ? 'currentColor' : 'none'} />
                {hub.key === 'chat' && <Badge n={unread} className="absolute top-1.5 left-[calc(50%+6px)]" />}
                <span className="text-[10px] font-medium leading-none">{hub.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
