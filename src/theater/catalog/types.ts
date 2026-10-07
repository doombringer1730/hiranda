// Shapes shared by the catalog sources (TMDB, Internet Archive) and the UI.

export type TitleKind = 'movie' | 'tv' | 'archive'

export type CatalogItem = {
  kind: TitleKind
  id: string
  title: string
  year: number | null
  poster: string | null
}

export type TitleDetails = CatalogItem & {
  backdrop: string | null
  overview: string | null
  runtime: number | null // minutes
  genres: string[]
  imdbId: string | null
  trailerYouTubeId: string | null
  /** A file we can play in Hiranda's own synced player (public domain). */
  playableUrl: string | null
  options: WatchOption[]
  /** TMDB's JustWatch page for this title, for attribution and "more". */
  justWatchLink: string | null
}

/**
 * How a couple can watch a source together:
 * - `here`: Hiranda's own player keeps you in sync (Archive, YouTube)
 * - `party`: you each open the service; the Hiranda browser extension syncs it
 * - `countdown`: the service can't be synced — open it, then start together
 */
export type SyncMode = 'here' | 'party' | 'countdown'

export type WatchOption = {
  provider: string
  logo: string | null
  offer: 'free' | 'ads' | 'subscription' | 'rent' | 'buy'
  mode: SyncMode
  /** Party platform key, as the extension and party page know it. */
  platform: string
  /** Where to find the title on that service. */
  url: string
}
