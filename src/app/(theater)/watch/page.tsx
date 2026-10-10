import { CLASSICS } from '@/theater/catalog/archive'
import { hasTmdb, trending } from '@/theater/catalog/tmdb'
import { hasYouTube, ytCategory, ytPopular } from '@/theater/catalog/youtube'
import { DiscoverHome } from './discover'
import { YouTubeSection } from './youtube-browse'
import Sessions from './sessions'

// The Theater home: browse first (Stremio-style), then your sessions.
export default async function TheaterHome({ searchParams }: { searchParams: Promise<{ yt?: string; error?: string }> }) {
  const { yt, error } = await searchParams
  const category = ytCategory(yt).key
  const [trend, videos] = await Promise.all([trending(), hasYouTube() ? ytPopular(category) : null])
  return (
    <>
      <DiscoverHome
        trending={trend} classics={CLASSICS} hasTmdb={hasTmdb()} error={error?.slice(0, 120)}
        youtube={videos && <YouTubeSection category={category} videos={videos} />}
      />
      <Sessions />
    </>
  )
}
