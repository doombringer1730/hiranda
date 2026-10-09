// Weather for the Weather widget, from Open-Meteo (free, no key). We only know
// each of you by time zone, so "where you are" is your time zone's city
// (America/Chicago is Chicago). Cached for half an hour; a slow or failed
// lookup just leaves the widget showing the city without weather.

export type Weather = { city: string; temp: number; high: number; low: number; code: number; day: boolean; unit: 'F' | 'C' }

// Zones where people mostly think in Fahrenheit.
const FAHRENHEIT = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Menominee|Metlakatla|Yakutat|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/

export const cityOf = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ')

async function getJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(2500) })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export async function weatherFor(tz: string, viewerTz: string | null): Promise<Weather | null> {
  const city = cityOf(tz)
  const unit = FAHRENHEIT.test(viewerTz ?? tz) ? 'F' : 'C'
  try {
    const geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=${encodeURIComponent(city)}`)
    // Prefer the place that's actually in this time zone (there are many Parises).
    const places = (geo?.results ?? []) as { latitude: number; longitude: number; timezone?: string }[]
    const place = places.find(p => p.timezone === tz) ?? places[0]
    if (!place) return null
    const f = await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto` +
      (unit === 'F' ? '&temperature_unit=fahrenheit' : ''),
    )
    return {
      city, unit,
      temp: Math.round(f.current.temperature_2m),
      code: f.current.weather_code,
      day: f.current.is_day === 1,
      high: Math.round(f.daily.temperature_2m_max[0]),
      low: Math.round(f.daily.temperature_2m_min[0]),
    }
  } catch {
    return null
  }
}

// WMO weather codes, as an emoji and a word or two.
export function describe(code: number, day: boolean): { emoji: string; text: string } {
  if (code === 0) return day ? { emoji: '☀️', text: 'Sunny' } : { emoji: '🌙', text: 'Clear' }
  if (code <= 2) return { emoji: day ? '🌤️' : '☁️', text: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', text: 'Cloudy' }
  if (code <= 48) return { emoji: '🌫️', text: 'Foggy' }
  if (code <= 57) return { emoji: '🌦️', text: 'Drizzle' }
  if (code <= 67 || (code >= 80 && code <= 82)) return { emoji: '🌧️', text: 'Rain' }
  if (code <= 77 || code === 85 || code === 86) return { emoji: '🌨️', text: 'Snow' }
  return { emoji: '⛈️', text: 'Storms' }
}
