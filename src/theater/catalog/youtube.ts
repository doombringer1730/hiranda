import 'server-only'

// YouTube browsing for the Theater (YouTube Data API v3). Every video here
// plays in Hiranda's synced YouTube player.
//
// Quota: the free key gets 10,000 units a day. A trending list costs 1 unit,
// a search 100, so lists are cached for 30 minutes and searches for a day —
// the same search from anyone is free after the first.
const KEY = process.env.YOUTUBE_API_KEY || ''
const REGION = 'US'

export function hasYouTube() {
  return KEY.length > 0
}

export type YtVideo = {
  id: string
  title: string
  channel: string
  thumb: string
  /** Seconds; null for live streams and search results. */
  duration: number | null
  live: boolean
}

// The rows on the Theater page. Ids are YouTube's video categories.
export const YT_CATEGORIES = [
  { key: 'trending', label: 'Trending', id: null },
  { key: 'music', label: 'Music', id: '10' },
  { key: 'comedy', label: 'Comedy', id: '23' },
  { key: 'gaming', label: 'Gaming', id: '20' },
  { key: 'entertainment', label: 'Entertainment', id: '24' },
  { key: 'film', label: 'Film & animation', id: '1' },
  { key: 'sports', label: 'Sports', id: '17' },
  { key: 'style', label: 'Food & style', id: '26' },
  { key: 'science', label: 'Science & tech', id: '28' },
] as const
export type YtCategory = (typeof YT_CATEGORIES)[number]['key']

export const ytCategory = (key: string | undefined) => YT_CATEGORIES.find(c => c.key === key) ?? YT_CATEGORIES[0]

async function yt<T>(path: string, params: Record<string, string>, revalidate: number): Promise<T | null> {
  if (!KEY) return null
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', KEY)
  try {
    const res = await fetch(url, { next: { revalidate } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

type Thumbs = Record<string, { url: string } | undefined>
type Snippet = { title: string; channelTitle: string; thumbnails: Thumbs; liveBroadcastContent?: string }

const thumbOf = (t: Thumbs, id: string) => t.high?.url ?? t.medium?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

// "PT1H2M3S" → 3723
function seconds(iso: string | undefined): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  const [, d, h, mi, s] = m.map(Number)
  const total = (d || 0) * 86400 + (h || 0) * 3600 + (mi || 0) * 60 + (s || 0)
  return total || null
}

// Text from the API arrives HTML-escaped in search results.
const unescape = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, '’').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/** What's popular on YouTube right now, overall or in one category. */
export async function ytPopular(category: YtCategory = 'trending'): Promise<YtVideo[]> {
  const cat = ytCategory(category)
  const data = await yt<{ items?: { id: string; snippet: Snippet; contentDetails?: { duration?: string }; status?: { embeddable?: boolean } }[] }>('videos', {
    part: 'snippet,contentDetails,status',
    chart: 'mostPopular',
    regionCode: REGION,
    maxResults: '24',
    ...(cat.id ? { videoCategoryId: cat.id } : {}),
  }, 1800)
  return (data?.items ?? [])
    .filter(v => v.status?.embeddable !== false)
    .map(v => ({
      id: v.id,
      title: unescape(v.snippet.title),
      channel: v.snippet.channelTitle,
      thumb: thumbOf(v.snippet.thumbnails, v.id),
      duration: seconds(v.contentDetails?.duration),
      live: v.snippet.liveBroadcastContent === 'live',
    }))
}

/** Search YouTube for videos that can play inside Hiranda. */
export async function ytSearch(query: string): Promise<YtVideo[]> {
  const q = query.trim().slice(0, 100)
  if (!q) return []
  const data = await yt<{ items?: { id: { videoId?: string }; snippet: Snippet }[] }>('search', {
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'moderate',
    regionCode: REGION,
    maxResults: '20',
    q,
  }, 86400)
  return (data?.items ?? [])
    .filter(v => v.id.videoId && v.snippet.liveBroadcastContent !== 'upcoming')
    .map(v => ({
      id: v.id.videoId!,
      title: unescape(v.snippet.title),
      channel: unescape(v.snippet.channelTitle),
      thumb: thumbOf(v.snippet.thumbnails, v.id.videoId!),
      duration: null,
      live: v.snippet.liveBroadcastContent === 'live',
    }))
}

/** A single video's title from YouTube's keyless oEmbed endpoint (for pasted links). */
export async function ytTitle(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { next: { revalidate: 86400 } })
    return res.ok ? ((await res.json()) as { title?: string }).title ?? null : null
  } catch {
    return null
  }
}
