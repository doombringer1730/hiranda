'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { hubsFor, hubFor } from '@/lib/hubs'
import { haptic } from '@/lib/feel'

// The segmented control at the top of a hub (Us, Plan, Shelf, Play), shown
// only on a hub's top-level pages — detail pages get their own back links.
// Never rendered on /watch or /party.
export default function HubSwitcher({ theaterUnlocked = false }: { theaterUnlocked?: boolean }) {
  const pathname = usePathname()
  const hubs = hubsFor(theaterUnlocked)
  const hub = hubFor(pathname, hubs)
  if (!hub || hub.items.length < 2) return null
  if (/^\/(watch|party)(\/|$)/.test(pathname)) return null
  const index = hub.items.findIndex(i => i.href === pathname)
  if (index < 0) return null
  const n = hub.items.length

  return (
    <div className="sticky top-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2 md:pt-5">
      <div className="max-w-2xl md:max-w-md mx-auto">
        <div role="tablist" aria-label={hub.label} className="relative grid rounded-full material p-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 rounded-full bg-stone-700/90 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.12),0_2px_8px_-2px_rgb(0_0_0/0.45)]"
            style={{
              width: `calc((100% - 0.5rem) / ${n})`,
              translate: `calc(${index} * 100%) 0`,
              transition: 'translate var(--spring-duration) var(--spring)',
            }}
          />
          {hub.items.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={i === index}
              onClick={() => haptic()}
              className={`relative z-10 flex h-9 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                i === index ? 'text-amber-50' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
