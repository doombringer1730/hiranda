import Link from 'next/link'
import { Search, Sparkles } from 'lucide-react'
import type { CatalogItem } from '@/theater/catalog/types'

// Stremio-style browsing: a search bar and rows of posters. Server-rendered;
// the search box is a plain GET form, so it works before any JS loads.
// Look: Hiranda's "warm craft" layer (paper, tape, handwriting from
// globals.css), so movie night feels like the rest of your space.

// A small, stable tilt per poster, so a row looks pinned up by hand.
function tilt(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return ((Math.abs(h) % 5) - 2) * 0.6
}

// A hand-drawn underline that draws itself in (the .scribble styles respect
// reduced motion).
export function InkUnderline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true" className={`scribble pointer-events-none ${className}`}>
      <path d="M3 11 C 40 5, 80 13, 120 8 S 180 6, 197 9" pathLength={1} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function SearchBar({ defaultValue = '', autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <form action="/watch/search" method="get" role="search" className="relative">
      <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search movies and shows"
        aria-label="Search movies and shows"
        className="w-full bg-stone-900 border border-stone-800 rounded-full pl-11 pr-4 py-3 text-amber-50 placeholder:text-stone-500 focus:outline-none focus:border-amber-700 transition-colors"
      />
    </form>
  )
}

export function PosterCard({ item, badge }: { item: CatalogItem; badge?: string }) {
  return (
    <Link href={`/watch/title/${item.kind}/${encodeURIComponent(item.id)}`} className="group block w-full pt-1">
      <div className="polaroid !p-1.5 !pb-1.5" style={{ rotate: `${tilt(item.kind + item.id)}deg` }}>
      <div className="relative aspect-[2/3] rounded-[2px] overflow-hidden bg-[#ece6da]">
        {item.poster
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          : <div className="h-full w-full grid place-items-center font-serif text-3xl text-[#b4a993]">{item.title.charAt(0)}</div>}
        {badge && (
          <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-[#fbf7ef] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#2b2620] shadow-sm -rotate-3">{badge}</span>
        )}
      </div>
      </div>
      <p className="mt-2 text-[13px] leading-tight text-stone-200 line-clamp-2">{item.title}</p>
      {item.year && <p className="text-[11px] text-stone-500">{item.year}</p>}
    </Link>
  )
}

export function PosterRow({ title, hint, items, badge }: { title: string; hint?: string; items: CatalogItem[]; badge?: string }) {
  if (!items.length) return null
  return (
    <section className="flex flex-col gap-3">
      <div className="px-4 md:px-0">
        <h2 className="font-serif text-2xl text-amber-50 leading-tight">{title}</h2>
        {hint && <p className="text-stone-500 text-xs mt-0.5">{hint}</p>}
      </div>
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 md:scroll-px-0 px-4 md:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(item => (
          <div key={`${item.kind}-${item.id}`} className="snap-start shrink-0 w-[30%] sm:w-[22%] md:w-[15%]">
            <PosterCard item={item} badge={badge} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function PosterGrid({ items, badgeFor }: { items: CatalogItem[]; badgeFor?: (item: CatalogItem) => string | undefined }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-5">
      {items.map(item => <PosterCard key={`${item.kind}-${item.id}`} item={item} badge={badgeFor?.(item)} />)}
    </div>
  )
}

export function DiscoverHome({ trending, classics, hasTmdb }: { trending: CatalogItem[]; classics: CatalogItem[]; hasTmdb: boolean }) {
  return (
    <div className="max-w-5xl mx-auto md:px-6 pt-6 flex flex-col gap-8">
      <div className="px-4 md:px-0">
        <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em]">Movie night</p>
        <h1 className="font-serif text-4xl text-amber-50 mt-2 leading-none">Theater<span className="text-amber-500">.</span></h1>
        <p className="font-hand text-[22px] text-amber-400/90 mt-2 relative inline-block">
          pick something. press play together.
          <InkUnderline className="absolute left-0 -bottom-1 w-full h-2 text-amber-500/50" />
        </p>
        <p className="text-stone-400 text-sm mt-2 mb-4">In sync wherever the service allows, even when you’re miles apart.</p>
        <SearchBar />
      </div>
      <PosterRow title="Free classics" hint="Public-domain films · they play right here, in sync" items={classics} badge="In sync" />
      <PosterRow title="Trending this week" hint="Tap one to see where it streams and how to watch together" items={trending} />
      {!hasTmdb && (
        <p className="mx-4 md:mx-0 flex items-start gap-2 paper rounded-md p-4 text-[var(--paper-muted)] text-sm -rotate-[0.4deg]">
          <Sparkles size={16} className="text-amber-700 shrink-0 mt-0.5" />
          Search covers the free classics for now. Add a free TMDB API key (TMDB_API_KEY) to search every movie and show and see where each one streams.
        </p>
      )}
    </div>
  )
}
