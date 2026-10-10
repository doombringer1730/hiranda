import Link from 'next/link'
import { Play } from 'lucide-react'
import { YT_CATEGORIES, type YtCategory, type YtVideo } from '@/theater/catalog/youtube'
import { formatDuration } from '@/theater/youtube'
import { playYouTube } from './discover-actions'

// YouTube on the Theater page and in search. Each card is a plain form, so a
// tap starts a synced session even before JS loads.

export function VideoCard({ video }: { video: YtVideo }) {
  const time = video.live ? 'LIVE' : formatDuration(video.duration)
  return (
    <form action={playYouTube.bind(null, video.id, video.title, video.thumb)} className="w-full">
      <button type="submit" className="group block w-full text-left">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-stone-900 ring-1 ring-stone-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumb} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/35 transition-colors">
            <span className="grid place-items-center h-11 w-11 rounded-full bg-amber-600 text-stone-950 opacity-0 group-hover:opacity-100 transition-opacity"><Play size={18} fill="currentColor" /></span>
          </span>
          {time && (
            <span className={`absolute right-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${video.live ? 'bg-red-600 text-white' : 'bg-black/80 text-stone-100'}`}>{time}</span>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-stone-100 line-clamp-2">{video.title}</p>
        <p className="text-[11px] text-stone-500 truncate">{video.channel}</p>
      </button>
    </form>
  )
}

// `short`: 8 on phones (so the rest of the page stays in reach), all on wider screens.
export function VideoGrid({ videos, short = false }: { videos: YtVideo[]; short?: boolean }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-5 ${short ? 'max-md:[&>*:nth-child(n+9)]:hidden' : ''}`}>
      {videos.map(v => <VideoCard key={v.id} video={v} />)}
    </div>
  )
}

export function YouTubeSection({ category, videos }: { category: YtCategory; videos: YtVideo[] }) {
  return (
    <section id="youtube" className="flex flex-col gap-3 scroll-mt-4">
      <div className="px-4 md:px-0">
        <h2 className="font-serif text-2xl text-amber-50 leading-tight">YouTube, together</h2>
        <p className="text-stone-500 text-xs mt-0.5">Tap any video · it plays here in sync, and either of you can line up what’s next</p>
      </div>
      <nav aria-label="YouTube categories" className="flex gap-2 overflow-x-auto px-4 md:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {YT_CATEGORIES.map(c => (
          <Link key={c.key} href={c.key === 'trending' ? '/watch#youtube' : `/watch?yt=${c.key}#youtube`} scroll={false}
            aria-current={c.key === category ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${c.key === category ? 'bg-amber-600 text-stone-950 font-medium' : 'bg-stone-900 border border-stone-800 text-stone-300 hover:border-stone-700'}`}>
            {c.label}
          </Link>
        ))}
      </nav>
      {videos.length
        ? <div className="px-4 md:px-0"><VideoGrid videos={videos.slice(0, 12)} short /></div>
        : <p className="px-4 md:px-0 text-stone-500 text-sm">Nothing to show here right now — try another category, or search above.</p>}
    </section>
  )
}
