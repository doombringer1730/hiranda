'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { BookOpen, CheckSquare, Star, Play, Library, Menu, Settings, PenLine, CalendarHeart, X, Clapperboard, LogOut, Gamepad2, Music, Puzzle } from 'lucide-react'
import { SidebarTimer } from './couple-timer'
import SpotifyStatus from './spotify-status'
import { logout } from '@/app/(auth)/actions'

const links = [
  { href: '/',            label: 'Memories',    icon: BookOpen      },
  { href: '/journal',     label: 'Journal',     icon: PenLine       },
  { href: '/todos',       label: 'Todos',       icon: CheckSquare   },
  { href: '/bucket-list', label: 'Bucket List', icon: Star          },
  { href: '/dates',       label: 'Dates',       icon: CalendarHeart },
  { href: '/watch',       label: 'Watch',       icon: Play          },
  { href: '/watchlist',   label: 'Watchlist',   icon: Clapperboard  },
  { href: '/library',     label: 'Library',     icon: Library       },
  { href: '/music',       label: 'Music',       icon: Music         },
  { href: '/games',       label: 'Games',       icon: Gamepad2      },
  { href: '/extension',   label: 'Get Extension', icon: Puzzle      },
]

function NavLink({ href, label, icon: Icon, active, onClick }: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 border-l-2 ${
        active
          ? 'border-amber-600 bg-amber-900/30 text-amber-300'
          : 'border-transparent text-stone-400 hover:text-amber-100 hover:bg-stone-800/70 active:bg-stone-800'
      }`}
    >
      <Icon size={17} />
      <span>{label}</span>
    </Link>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const touchStartX = useRef(0)

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX
    }
    function onTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (dx > 60 && touchStartX.current < 30) setOpen(true)
      if (dx < -60) setOpen(false)
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 h-screen bg-stone-900/80 border-r border-stone-800/60 px-3 py-8 fixed left-0 top-0 z-40 backdrop-blur-sm overflow-hidden">
        <div className="px-3 mb-10">
          <h1 className="font-serif text-2xl text-amber-100">Hiranda</h1>
          <div className="mt-1.5 h-px bg-gradient-to-r from-amber-800/60 to-transparent" />
        </div>
        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return <NavLink key={href} href={href} label={label} icon={Icon} active={active} />
          })}
        </nav>
        <SpotifyStatus />
        <SidebarTimer />
        <NavLink href="/settings" label="Settings" icon={Settings} active={pathname === '/settings'} />
        <form action={logout}>
          <button type="submit" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-stone-500 hover:text-red-400 hover:bg-stone-800/70 transition-all duration-200 w-full">
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </form>
      </aside>

      {/* ── Mobile: hamburger button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-stone-900/95 backdrop-blur border border-stone-800/80 text-stone-400 hover:text-amber-300 hover:border-stone-700 transition-all duration-200 flex items-center justify-center shadow-lg"
      >
        <Menu size={18} />
      </button>

      {/* ── Mobile: backdrop ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 z-40"
        />
      )}

      {/* ── Mobile: full drawer ── */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-stone-900 border-r border-stone-800/60 z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-out shadow-2xl ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-6 flex items-start justify-between flex-shrink-0">
          <div>
            <h1 className="font-serif text-2xl text-amber-100">Hiranda</h1>
            <div className="mt-1.5 h-px bg-gradient-to-r from-amber-800/60 to-transparent w-32" />
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="text-stone-500 hover:text-amber-300 transition-colors p-1 mt-0.5 -mr-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3 overflow-y-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={Icon}
                active={active}
                onClick={() => setOpen(false)}
              />
            )
          })}
        </nav>

        {/* Settings + logout at bottom */}
        <div className="px-3 pb-8 flex-shrink-0">
          <div className="h-px bg-stone-800/60 mb-3" />
          <NavLink
            href="/settings"
            label="Settings"
            icon={Settings}
            active={pathname === '/settings'}
            onClick={() => setOpen(false)}
          />
          <form action={logout}>
            <button type="submit" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-stone-500 hover:text-red-400 hover:bg-stone-800/70 transition-all duration-200 w-full">
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
