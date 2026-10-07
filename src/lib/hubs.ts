import {
  House, Heart, ListChecks, Gamepad2, MessageCircle, Mail,
  BookOpen, PenLine, BookHeart, CheckSquare, Star, CalendarHeart, Clapperboard, Library, Music, Film, Sprout, Gift,
} from 'lucide-react'

// The app's five tabs. Each hub groups related pages; the pages keep their
// own URLs and a segmented control switches between them.
// `label` is the short segment name; `title` is the full name for the sidebar.
export type HubItem = { href: string; label: string; title?: string; icon: React.ElementType }
export type Hub = { key: string; label: string; icon: React.ElementType; items: HubItem[] }

export const THEATER: HubItem = { href: '/watch', label: 'Theater', icon: Film }

export const HUBS: Hub[] = [
  { key: 'home', label: 'Home', icon: House, items: [{ href: '/', label: 'Home', icon: House }] },
  { key: 'chat', label: 'Chat', icon: MessageCircle, items: [{ href: '/chat', label: 'Chat', icon: MessageCircle }] },
  { key: 'us', label: 'Us', icon: Heart, items: [
    { href: '/memories', label: 'Memories', icon: BookOpen },
    { href: '/journal', label: 'Journal', icon: PenLine },
    { href: '/letters', label: 'Letters', icon: Mail },
    { href: '/memories/book', label: 'Book', title: 'Memory Book', icon: BookHeart },
    { href: '/store', label: 'Gifts', title: 'Hiranda Store', icon: Gift },
  ] },
  { key: 'plan', label: 'Plan', icon: ListChecks, items: [
    { href: '/todos', label: 'Todos', icon: CheckSquare },
    { href: '/bucket-list', label: 'Someday', title: 'Bucket List', icon: Star },
    { href: '/dates', label: 'Dates', icon: CalendarHeart },
    { href: '/grow', label: 'Grow', icon: Sprout },
  ] },
  // Play is everything you enjoy together: games, and the shared shelf.
  { key: 'play', label: 'Play', icon: Gamepad2, items: [
    { href: '/games', label: 'Games', icon: Gamepad2 },
    { href: '/watchlist', label: 'Watch', title: 'Watchlist', icon: Clapperboard },
    { href: '/library', label: 'Read', title: 'Library', icon: Library },
    { href: '/music', label: 'Listen', title: 'Music', icon: Music },
  ] },
]

export function hubsFor(theaterUnlocked: boolean): Hub[] {
  if (!theaterUnlocked) return HUBS
  return HUBS.map(h => h.key === 'play' ? { ...h, items: [...h.items, THEATER] } : h)
}

const inItem = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

export function hubFor(pathname: string, hubs: Hub[] = HUBS): Hub | null {
  return hubs.find(h => h.items.some(i => inItem(pathname, i.href))) ?? null
}

// Most specific match wins (/memories/book is Book, not Memories).
export function itemFor(pathname: string, hub: Hub): HubItem | null {
  return [...hub.items].sort((a, b) => b.href.length - a.href.length).find(i => inItem(pathname, i.href)) ?? null
}
