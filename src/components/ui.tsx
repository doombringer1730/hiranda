import Link from 'next/link'
import type { Person } from '@/lib/profiles'

// Shared pieces so every page speaks the same visual language.

// One primary action per page, always this shape, always in the header slot.
export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium transition-colors shrink-0 disabled:opacity-50'
// Secondary icon action next to it.
export const iconButton =
  'grid place-items-center h-10 w-10 rounded-full bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-amber-100 transition-colors shrink-0'
// Section label — one size everywhere.
export const sectionLabel = 'text-stone-400 text-[11px] uppercase tracking-[0.22em]'

// A tiny avatar instead of repeating someone's full name on every row.
export function PersonChip({ person, size = 20, withName = false }: { person?: Person; size?: number; withName?: boolean }) {
  if (!person) return null
  return (
    <span className="inline-flex items-center gap-1.5 align-middle" title={person.name}>
      <span className="inline-grid place-items-center rounded-full overflow-hidden text-amber-50 font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.48, background: person.accent }}>
        {person.avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={person.avatar} alt="" className="h-full w-full object-cover" />
          : person.first.slice(0, 1).toUpperCase()}
      </span>
      {withName && <span>{person.first}</span>}
    </span>
  )
}

// Empty states are a note on paper with one clear next step.
export function EmptyState({ title, sub, href, action }: { title: string; sub?: string; href?: string; action?: string }) {
  return (
    <div className="paper rounded-[6px] px-6 py-9 text-center -rotate-[0.4deg]">
      <p className="font-hand text-[28px] leading-tight text-[var(--paper-ink)]">{title}</p>
      {sub && <p className="text-[var(--paper-muted)] text-sm mt-2 max-w-xs mx-auto">{sub}</p>}
      {href && action && (
        <Link href={href} className="inline-flex mt-4 h-9 px-4 items-center rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium">{action}</Link>
      )}
    </div>
  )
}
