'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Home, BookOpen, CheckSquare, Star, Play, Library, Settings, PenLine,
  CalendarHeart, Clapperboard, LogOut, Gamepad2, Music, Heart, MoreHorizontal, X,
} from 'lucide-react'
import { SidebarTimer } from './couple-timer'
import SpotifyStatus from './spotify-status'
import { logout } from '@/app/(auth)/actions'

const links = [
  { href: '/',            label: 'Home',        icon: Home          },
  { href: '/memories',    label: 'Memories',    icon: BookOpen      },
  { href: '/journal',     label: 'Journal',     icon: PenLine       },
  { href: '/todos',       label: 'Todos',       icon: CheckSquare   },
  { href: '/bucket-list', label: 'Bucket List', icon: Star          },
  { href: '/dates',       label: 'Dates',       icon: CalendarHeart },
  { href: '/watch',       label: 'Watch',       icon: Play          },
  { href: '/watchlist',   label: 'Watchlist',   icon: Clapperboard  },
  { href: '/library',     label: 'Library',     icon: Library       },
  { href: '/music',       label: 'Music',       icon: Music         },
  { href: '/games',       label: 'Games',       icon: Gamepad2      },
]

// ── Mobile: grouped bottom tab bar ──
// 11 destinations don't fit a tab bar, so we group the long tail into sheets.
// Home and Play are direct; Together / Watch / More open a bottom sheet.
type SheetItem = { href: string; label: string; icon: React.ElementType }
const groups: Record<string, { label: string; icon: React.ElementType; items: SheetItem[] }> = {
  together: {
    label: 'Together', icon: Heart,
    items: [
      { href: '/memories',    label: 'Memories',    icon: BookOpen      },
      { href: '/journal',     label: 'Journal',     icon: PenLine       },
      { href: '/dates',       label: 'Dates',       icon: CalendarHeart },
      { href: '/bucket-list', label: 'Bucket List', icon: Star          },
      { href: '/todos',       label: 'Todos',       icon: CheckSquare   },
    ],
  },
  watch: {
    label: 'Watch', icon: Clapperboard,
    items: [
      { href: '/watch',     label: 'Watch',     icon: Play         },
      { href: '/watchlist', label: 'Watchlist', icon: Clapperboard },
      { href: '/library',   label: 'Library',   icon: Library      },
      { href: '/music',     label: 'Music',     icon: Music        },
    ],
  },
  more: {
    label: 'More', icon: MoreHorizontal,
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
}

function pathInGroup(pathname: string, items: SheetItem[]) {
  return items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
}

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

function TabButton({ label, icon: Icon, active, onClick, href }: {
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
  href?: string
}) {
  const cls = `flex flex-col items-center justify-center gap-1 flex-1 h-full min-h-0 transition-colors ${
    active ? 'text-amber-400' : 'text-stone-500 active:text-stone-300'
  }`
  const inner = (
    <>
      <Icon size={20} />
      <span className="text-[10px] leading-none">{label}</span>
    </>
  )
  return href
    ? <Link href={href} className={cls}>{inner}</Link>
    : <button onClick={onClick} className={cls} aria-label={label}>{inner}</button>
}

export default function Nav() {
  const pathname = usePathname()
  const [sheet, setSheet] = useState<string | null>(null)

  // Close the sheet on navigation.
  useEffect(() => { setSheet(null) }, [pathname])

  // Lock body scroll while a sheet is open.
  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sheet])

  const openGroup = sheet ? groups[sheet] : null

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 h-screen bg-stone-900/80 border-r border-stone-800/60 px-3 py-8 fixed left-0 top-0 z-40 backdrop-blur-sm overflow-hidden">
        <div className="px-3 mb-10">
          {/* Logo mark — presentational, not a document heading. Using <p> avoids
              creating a duplicate <h1> alongside each page's own heading, which
              Google Lighthouse flags as a heading structure error. */}
          <p className="font-serif text-2xl text-amber-100">Hiranda</p>
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

      {/* ── Mobile: group sheet (slides up above the tab bar) ── */}
      {openGroup && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={e => e.stopPropagation()}
            className="absolute left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-stone-900 border-t border-stone-800 rounded-t-3xl px-3 pt-3 pb-4 shadow-2xl animate-page-in"
          >
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-stone-400 text-xs uppercase tracking-widest">{openGroup.label}</p>
              <button onClick={() => setSheet(null)} aria-label="Close" className="text-stone-500 hover:text-amber-300 p-1 -mr-1">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {openGroup.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return <NavLink key={href} href={href} label={label} icon={Icon} active={active} onClick={() => setSheet(null)} />
              })}
              {sheet === 'more' && (
                <form action={logout}>
                  <button type="submit" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-stone-500 hover:text-red-400 hover:bg-stone-800/70 transition-all duration-200 w-full">
                    <LogOut size={17} />
                    <span>Sign out</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile: bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 pb-[env(safe-area-inset-bottom)] bg-stone-900/95 backdrop-blur border-t border-stone-800/80 flex items-stretch">
        <TabButton label="Home" icon={Home} href="/" active={pathname === '/'} />
        <TabButton label="Together" icon={Heart} active={sheet === 'together' || pathInGroup(pathname, groups.together.items)} onClick={() => setSheet(s => s === 'together' ? null : 'together')} />
        <TabButton label="Watch" icon={Clapperboard} active={sheet === 'watch' || pathInGroup(pathname, groups.watch.items)} onClick={() => setSheet(s => s === 'watch' ? null : 'watch')} />
        <TabButton label="Play" icon={Gamepad2} href="/games" active={pathname.startsWith('/games')} />
        <TabButton label="More" icon={MoreHorizontal} active={sheet === 'more' || pathname.startsWith('/settings')} onClick={() => setSheet(s => s === 'more' ? null : 'more')} />
      </nav>
    </>
  )
}
