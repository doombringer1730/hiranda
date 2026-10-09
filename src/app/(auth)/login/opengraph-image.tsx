import { ogCard, ogSize } from '../../og-card'

export const alt = 'Hiranda — a private little place for the two of you'
export const size = ogSize
export const contentType = 'image/png'

export default async function Image() {
  return ogCard('One question a day, letters, a date jar, movie nights. Free for two.')
}
