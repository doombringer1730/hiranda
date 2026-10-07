import 'server-only'
import type { CatalogItem } from './types'

// The Internet Archive's public-domain feature films. No key needed, and the
// files are plain MP4s, so they play in Hiranda's own synced player.

const UA = { 'User-Agent': 'Hiranda (couples app; watch-together)' }

// Hand-picked: genuinely public domain, a real copy of the film, an MP4 inside.
export const CLASSICS: CatalogItem[] = [
  ['his_girl_friday', 'His Girl Friday', 1940],
  ['Night.Of.The.Living.Dead_1080p', 'Night of the Living Dead', 1968],
  ['Nosferatu_most_complete_version_93_mins.', 'Nosferatu', 1922],
  ['The_General_Buster_Keaton', 'The General', 1926],
  ['MyManGodfrey1936', 'My Man Godfrey', 1936],
  ['Detour', 'Detour', 1945],
  ['CarnivalofSouls', 'Carnival of Souls', 1962],
  ['royal_wedding', 'Royal Wedding', 1951],
  ['house_on_haunted_hill_ipod', 'House on Haunted Hill', 1959],
  ['AStarIsBorn', 'A Star Is Born', 1937],
  ['meet_john_doe', 'Meet John Doe', 1941],
  ['gullivers_travels1939', "Gulliver's Travels", 1939],
  ['ThePhantomoftheOpera', 'The Phantom of the Opera', 1925],
  ['penny_serenade', 'Penny Serenade', 1941],
  ['NothingSacred', 'Nothing Sacred', 1937],
  ['TheStranger_0', 'The Stranger', 1946],
  ['mclintok_widescreen', 'McLintock!', 1963],
].map(([id, title, year]) => ({ kind: 'archive' as const, id: id as string, title: title as string, year: year as number, poster: archivePoster(id as string) }))

export function archivePoster(identifier: string) {
  return `https://archive.org/services/img/${encodeURIComponent(identifier)}`
}

const IDENTIFIER = /^[A-Za-z0-9._-]{1,100}$/
export function isArchiveId(id: string) {
  return IDENTIFIER.test(id)
}

type ArchiveFile = { name: string; format?: string; size?: string }
type ArchiveMeta = {
  metadata?: { title?: string | string[]; year?: string; date?: string; description?: string | string[]; runtime?: string }
  files?: ArchiveFile[]
}

// Prefer files known to be H.264 (plays in every browser, iPhone included):
// the Archive's own H.264 derivatives, then H.264 uploads, then its 512Kb
// derivative. Plain "MPEG4" uploads come last — some use an older codec
// browsers can't decode. Among equals, a size near 700 MB.
const FORMAT_RANK = ['h.264 ia', 'h.264', 'h.264 mpeg4', '512kb mpeg4', 'mpeg4']
function pickMp4(files: ArchiveFile[]): ArchiveFile | null {
  const mp4s = files.filter(f => f.name.toLowerCase().endsWith('.mp4'))
  if (!mp4s.length) return null
  const rank = (f: ArchiveFile) => {
    const i = FORMAT_RANK.indexOf((f.format ?? '').toLowerCase())
    return i === -1 ? FORMAT_RANK.length : i
  }
  const size = (f: ArchiveFile) => Math.abs(Number(f.size ?? 0) - 700 * 2 ** 20)
  return [...mp4s].sort((a, b) => rank(a) - rank(b) || size(a) - size(b))[0]
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null
// Archive descriptions run long; keep whole sentences up to about `max` chars.
function trimToSentence(text: string | null, max: number) {
  if (!text || text.length <= max) return text
  const cut = text.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > max / 3 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…'
}
const stripHtml = (s: string | null) => s?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null

export async function archiveItem(identifier: string) {
  if (!isArchiveId(identifier)) return null
  try {
    const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, { headers: UA, next: { revalidate: 86400 } })
    if (!res.ok) return null
    const meta = (await res.json()) as ArchiveMeta
    const file = pickMp4(meta.files ?? [])
    const curated = CLASSICS.find(c => c.id === identifier)
    const year = curated?.year ?? (Number((meta.metadata?.year ?? meta.metadata?.date ?? '').slice(0, 4)) || null)
    return {
      title: curated?.title ?? first(meta.metadata?.title) ?? identifier,
      year,
      overview: trimToSentence(stripHtml(first(meta.metadata?.description)), 420),
      poster: archivePoster(identifier),
      url: file ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file.name)}` : null,
    }
  } catch {
    return null
  }
}

// Title search within the public-domain feature film collection.
export async function searchArchive(query: string, rows = 12): Promise<CatalogItem[]> {
  const q = query.replace(/["\\]/g, ' ').trim()
  if (!q) return []
  const params = new URLSearchParams([
    ['q', `title:(${q}) AND collection:(feature_films) AND mediatype:(movies)`],
    ['fl[]', 'identifier'], ['fl[]', 'title'], ['fl[]', 'year'],
    ['sort[]', 'downloads desc'], ['rows', String(rows)], ['output', 'json'],
  ])
  try {
    const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, { headers: UA, next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = (await res.json()) as { response?: { docs?: { identifier: string; title?: string; year?: string | number }[] } }
    return (data.response?.docs ?? [])
      .filter(d => isArchiveId(d.identifier))
      .map(d => ({ kind: 'archive' as const, id: d.identifier, title: d.title ?? d.identifier, year: Number(d.year) || null, poster: archivePoster(d.identifier) }))
  } catch {
    return []
  }
}
