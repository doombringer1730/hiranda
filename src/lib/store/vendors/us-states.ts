// US state names → USPS codes, so suppliers get "NY" whatever was typed.
const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'puerto rico': 'PR', guam: 'GU', 'virgin islands': 'VI', 'american samoa': 'AS',
  'northern mariana islands': 'MP', 'armed forces americas': 'AA', 'armed forces europe': 'AE',
  'armed forces pacific': 'AP',
}
const CODES = new Set(Object.values(STATES))

/** "new york", "NY", "N.Y." → "NY"; null if it isn't a US state. */
export function usStateCode(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  const up = raw.replace(/\./g, '').toUpperCase()
  if (CODES.has(up)) return up
  return STATES[raw.toLowerCase().replace(/\s+/g, ' ')] ?? null
}
