import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { hasPlus } from '@/lib/plus'
import { sponsorFor, type Place } from '@/lib/sponsors'

// One quiet "Sponsored" card for free couples. Plus couples never see it.
// Links carry rel="sponsored" and open outside Hiranda.
export default async function SponsorCard({ place }: { place: Place }) {
  if (await hasPlus()) return null
  const sponsor = sponsorFor(place)

  if (!sponsor) {
    // No partners yet: on Home only, a gentle word about Plus.
    if (place !== 'home') return null
    return (
      <Link href="/plus" className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 px-4 py-3 hover:border-stone-700 transition-colors">
        <Sparkles size={16} className="text-amber-400 shrink-0" />
        <p className="flex-1 text-stone-400 text-sm">The Deepest deck, your own theme and no ads — <span className="text-amber-300">Hiranda Plus</span>, one plan for you both.</p>
      </Link>
    )
  }

  return (
    <aside aria-label="Sponsored" className="rounded-2xl border border-stone-800 bg-stone-900/50 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl leading-none" aria-hidden="true">{sponsor.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Sponsored</p>
        <p className="text-stone-100 text-sm font-medium truncate">{sponsor.title}</p>
        <p className="text-stone-400 text-xs line-clamp-2">{sponsor.text}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <a href={sponsor.url} target="_blank" rel="sponsored noopener noreferrer"
          className="rounded-full bg-stone-800 hover:bg-stone-700 px-3 py-1.5 text-xs font-medium text-stone-100 transition-colors">
          {sponsor.cta}
        </a>
        <Link href="/plus" className="text-[10px] text-stone-500 hover:text-stone-300">Remove ads</Link>
      </div>
    </aside>
  )
}
