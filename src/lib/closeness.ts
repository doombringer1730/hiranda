// The closeness check-in: how close you've felt lately, as weather rather
// than a number. Private: only you ever see your own.
export const WEATHER = [
  { score: 1, emoji: '🌧️', word: 'far apart' },
  { score: 2, emoji: '☁️', word: 'a bit distant' },
  { score: 3, emoji: '⛅', word: 'in between' },
  { score: 4, emoji: '🌤️', word: 'close' },
  { score: 5, emoji: '☀️', word: 'really close' },
] as const

// About every four weeks; asking more often turns it into homework.
export const CHECKIN_EVERY_DAYS = 28

export const weatherFor = (score: number) => WEATHER[Math.min(5, Math.max(1, Math.round(score))) - 1]
