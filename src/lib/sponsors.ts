// Sponsored cards for couples without Plus — at most one per page, only on
// browse-type pages (Home, Someday, Dates), never in Chat, Letters or the
// Theater. Add real partners here once you've joined their affiliate
// programs (e.g. 1-800-Flowers, Uncommon Goods, Etsy, Amazon Associates,
// Cratejoy date-night boxes). Use the affiliate link as `url`.
// With no partners listed, Home shows a gentle Plus card instead.

export type Place = 'home' | 'someday' | 'dates'

export type Sponsor = {
  id: string
  emoji: string
  title: string
  text: string
  cta: string
  url: string
  places: Place[]
}

export const SPONSORS: Sponsor[] = [
  // {
  //   id: 'flowers',
  //   emoji: '💐',
  //   title: 'Flowers, wherever they are',
  //   text: 'Same-day delivery across the country — for the days you can’t be there.',
  //   cta: 'Send flowers',
  //   url: 'https://…your affiliate link…',
  //   places: ['home', 'dates'],
  // },
]

/** Today's sponsor for a page — rotates daily so it never feels stuck. */
export function sponsorFor(place: Place, day = Math.floor(Date.now() / 86_400_000)): Sponsor | null {
  const list = SPONSORS.filter(s => s.places.includes(place))
  return list.length ? list[day % list.length] : null
}
