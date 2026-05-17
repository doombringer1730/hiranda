'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CheckSquare, Star, Play, LogOut } from 'lucide-react'
import { logout } from '@/app/(auth)/actions'

const links = [
  { href: '/',            label: 'Memories',    icon: BookOpen    },
  { href: '/todos',       label: 'Todos',       icon: CheckSquare },
  { href: '/bucket-list', label: 'Bucket List', icon: Star        },
  { href: '/watch',       label: 'Watch',       icon: Play        },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-stone-900 border-r border-stone-800 px-4 py-8 fixed left-0 top-0">
        <h1 className="font-serif text-2xl text-amber-100 mb-10 px-2">Hiranda</h1>
        <nav className="flex flex-col gap-1 flex-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? 'bg-amber-900/40 text-amber-300'
                    : 'text-stone-400 hover:text-amber-100 hover:bg-stone-800'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-stone-900/95 backdrop-blur border-t border-stone-800 z-50">
        <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                  active ? 'text-amber-400' : 'text-stone-500'
                }`}
              >
                <Icon size={22} />
                <span className="text-xs">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
