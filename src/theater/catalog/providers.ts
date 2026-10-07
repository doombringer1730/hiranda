import type { SyncMode } from './types'

// What we know about each streaming service: the platform key the Hiranda
// extension and party page use, how a couple can watch it together, and where
// to search it. Keyed by TMDB/JustWatch provider id.
type Service = { platform: string; label: string; mode: SyncMode; search: (q: string) => string }

const q = encodeURIComponent
const party = (platform: string, label: string, search: (s: string) => string): Service => ({ platform, label, mode: 'party', search })
const countdown = (platform: string, label: string, search: (s: string) => string): Service => ({ platform, label, mode: 'countdown', search })

const NETFLIX = party('netflix', 'Netflix', s => `https://www.netflix.com/search?q=${q(s)}`)
const DISNEY = party('disney', 'Disney+', s => `https://www.disneyplus.com/search?q=${q(s)}`)
const PRIME = party('prime', 'Prime Video', s => `https://www.amazon.com/s?k=${q(s)}&i=instant-video`)
const MAX = party('max', 'Max', s => `https://play.max.com/search?q=${q(s)}`)
const HULU = party('hulu', 'Hulu', s => `https://www.hulu.com/search?q=${q(s)}`)
const APPLE = party('appletv', 'Apple TV', s => `https://tv.apple.com/search?term=${q(s)}`)
const PARAMOUNT = party('paramount', 'Paramount+', s => `https://www.paramountplus.com/search/?q=${q(s)}`)
// YouTube can also play right inside Hiranda — see the title page.
const YOUTUBE = party('youtube', 'YouTube', s => `https://www.youtube.com/results?search_query=${q(s + ' full movie')}`)

export const SERVICES: Record<number, Service> = {
  8: NETFLIX, 1796: NETFLIX,
  337: DISNEY,
  9: PRIME, 119: PRIME, 10: PRIME, 2100: PRIME,
  1899: MAX, 384: MAX,
  15: HULU,
  350: APPLE, 2: APPLE,
  531: PARAMOUNT, 582: PARAMOUNT, 1853: PARAMOUNT,
  192: YOUTUBE, 235: YOUTUBE,
  73: countdown('tubi', 'Tubi', s => `https://tubitv.com/search/${q(s)}`),
  300: countdown('pluto', 'Pluto TV', s => `https://pluto.tv/search/details?query=${q(s)}`),
  386: countdown('peacock', 'Peacock', s => `https://www.peacocktv.com/search?q=${q(s)}`),
  387: countdown('peacock', 'Peacock', s => `https://www.peacocktv.com/search?q=${q(s)}`),
  257: countdown('fubo', 'Fubo', s => `https://www.fubo.tv/search?q=${q(s)}`),
  43: countdown('starz', 'Starz', s => `https://www.starz.com/search?q=${q(s)}`),
  37: countdown('showtime', 'Showtime', s => `https://www.paramountplus.com/search/?q=${q(s)}`),
  283: countdown('crunchyroll', 'Crunchyroll', s => `https://www.crunchyroll.com/search?q=${q(s)}`),
  207: countdown('roku', 'The Roku Channel', s => `https://therokuchannel.roku.com/search/${q(s)}`),
  613: countdown('freevee', 'Freevee', s => `https://www.amazon.com/s?k=${q(s)}&i=instant-video`),
}

/** Display names for party platform keys (party page and session list). */
export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(SERVICES).map(s => [s.platform, s.label]),
)

export const MODE_COPY: Record<SyncMode, { label: string; hint: string }> = {
  here: { label: 'Plays here, in sync', hint: 'Hiranda’s player keeps you both on the same frame.' },
  party: { label: 'Watch-party sync', hint: 'Each of you opens it on a computer; the Hiranda extension keeps you in sync.' },
  countdown: { label: 'Start together', hint: 'This service can’t be synced. Open it, then hit play on the countdown.' },
}
