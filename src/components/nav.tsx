'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { BookOpen, CheckSquare, Star, Play, Library, LogOut, Menu } from 'lucide-react'
import { logout } from '@/app/(auth)/actions'

const links = [
  { href: '/',            label: 'Memories',    icon: BookOpen    },
  { href: '/todos',       label: 'Todos',       icon: CheckSquare },
  { href: '/bucket-list', label: 'Bucket List', icon: Star        },
  { href: '/watch',       label: 'Watch',       icon: Play        },
  { href: '/library',    label: 'Library',     icon: Library     },
]

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const touchStartX = useRef(0)

  // Swipe detection on document
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX
    }
    function onTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (dx > 60 && touchStartX.current < 30) setOpen(true)
      if (dx < -60) setOpen(false)
    }
    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-stone-900 border-r border-stone-800 px-4 py-8 fixed left-0 top-0 z-40">
        <h1 className="font-serif text-2xl text-amber-100 mb-10 px-2">Hiranda</h1>
        <nav className="flex flex-col gap-1 flex-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active ? 'bg-amber-900/40 text-amber-300' : 'text-stone-400 hover:text-amber-100 hover:bg-stone-800'
                }`}
              >
                <Icon size={18} />{label}
              </Link>
            )
          })}
        </nav>
        <form action={logout}>
          <button type="submit" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors w-full">
            <LogOut size={18} /> Sign out
          </button>
        </form>
      </aside>

      {/* ── Mobile: hamburger button ── */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-stone-900/90 backdrop-blur border border-stone-800 text-stone-400 hover:text-amber-300 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* ── Mobile: backdrop ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile: icon-only drawer ── */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-16 bg-stone-900 border-r border-stone-800 z-50 flex flex-col items-center py-6 gap-2 transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6">
          <span className="font-serif text-amber-500 text-lg">H</span>
        </div>
        <nav className="flex flex-col items-center gap-1 flex-1 w-full">
          {links.map(({ href, icon: Icon, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                  active ? 'bg-amber-900/50 text-amber-400' : 'text-stone-500 hover:text-amber-300 hover:bg-stone-800'
                }`}
                title={label}
              >
                <Icon size={20} />
              </Link>
            )
          })}
        </nav>
        <form action={logout}>
          <button type="submit"
            className="flex items-center justify-center w-10 h-10 rounded-xl text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
            title="Sign out"
          >
            <LogOut size={20} />
          </button>
        </form>
      </aside>
    </>
  )
}
