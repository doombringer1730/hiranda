import Link from 'next/link'
import { Search, Sparkles } from 'lucide-react'
import type { CatalogItem } from '@/theater/catalog/types'

// Stremio-style browsing: a search bar and rows of posters. Server-rendered;
// the search box is a plain GET form, so it works before any JS loads.

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
    <Link href={`/watch/title/${item.kind}/${encodeURIComponent(item.id)}`} className="group block w-full">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-stone-800/80 group-hover:border-amber-700/60 transition-colors">
        {item.poster
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          : <div className="h-full w-full grid place-items-center font-serif text-3xl text-stone-700">{item.title.charAt(0)}</div>}
        {badge && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-amber-200">{badge}</span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] leading-tight text-stone-200 line-clamp-2">{item.title}</p>
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
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 md:scroll-px-0 px-4 md:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {items.map(item => <PosterCard key={`${item.kind}-${item.id}`} item={item} badge={badgeFor?.(item)} />)}
    </div>
  )
}

export function DiscoverHome({ trending, classics, hasTmdb }: { trending: CatalogItem[]; classics: CatalogItem[]; hasTmdb: boolean }) {
  return (
    <div className="max-w-5xl mx-auto md:px-6 pt-6 flex flex-col gap-8">
      <div className="px-4 md:px-0">
        <h1 className="font-serif text-4xl text-amber-50">Theater<span className="text-amber-500">.</span></h1>
        <p className="text-stone-400 text-sm mt-1 mb-4">Find something, then watch it together — in sync wherever the service allows.</p>
        <SearchBar />
      </div>
      <PosterRow title="Free classics" hint="Public-domain films · they play right here, in sync" items={classics} badge="In sync" />
      <PosterRow title="Trending this week" hint="Tap one to see where it streams and how to watch together" items={trending} />
      {!hasTmdb && (
        <p className="mx-4 md:mx-0 flex items-start gap-2 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 text-stone-400 text-sm">
          <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
          Search covers the free classics for now. Add a free TMDB API key (TMDB_API_KEY) to search every movie and show and see where each one streams.
        </p>
      )}
    </div>
  )
}
