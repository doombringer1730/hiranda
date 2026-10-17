// The passport: stamps for things you do together around Hiranda (the lessons
// that used to live here are now the Grow map, lib/grow-map.ts).

// Passport stamps (keys match milestone_defs() in migration 026).
export type MilestoneMeta = { key: string; track: string; threshold: number; rarity: 'common' | 'rare' | 'legendary'; emoji: string; title: string }
const T: Record<string, { emoji: string; noun: (n: number) => string }> = {
  talk: { emoji: '💬', noun: n => `${n} Talk time${n === 1 ? '' : 's'}` },
  know: { emoji: '❓', noun: n => `${n} questions answered together` },
  letters: { emoji: '💌', noun: n => (n === 1 ? 'First letter' : `${n} letters`) },
  thanks: { emoji: '💛', noun: n => `${n} thank-you notes` },
  jar: { emoji: '🫙', noun: n => (n === 1 ? 'First jar draw' : `${n} jar draws`) },
  memories: { emoji: '📸', noun: n => `${n} memories` },
  weeks: { emoji: '🔥', noun: n => `${n} good weeks` },
  path: { emoji: '🧭', noun: n => `${n} lessons together` },
}
const DEFS: [string, string, number, MilestoneMeta['rarity']][] = [
  ['talk_1', 'talk', 1, 'common'], ['talk_5', 'talk', 5, 'common'], ['talk_20', 'talk', 20, 'rare'], ['talk_50', 'talk', 50, 'legendary'],
  ['know_10', 'know', 10, 'common'], ['know_50', 'know', 50, 'rare'], ['know_150', 'know', 150, 'legendary'],
  ['letters_1', 'letters', 1, 'common'], ['letters_5', 'letters', 5, 'rare'],
  ['thanks_5', 'thanks', 5, 'common'], ['thanks_25', 'thanks', 25, 'rare'],
  ['jar_1', 'jar', 1, 'common'], ['jar_5', 'jar', 5, 'rare'], ['jar_15', 'jar', 15, 'legendary'],
  ['memories_10', 'memories', 10, 'common'], ['memories_50', 'memories', 50, 'rare'], ['memories_100', 'memories', 100, 'legendary'],
  ['weeks_4', 'weeks', 4, 'common'], ['weeks_12', 'weeks', 12, 'rare'], ['weeks_52', 'weeks', 52, 'legendary'],
  ['path_4', 'path', 4, 'common'], ['path_12', 'path', 12, 'rare'], ['path_20', 'path', 20, 'legendary'],
]
export const MILESTONES: MilestoneMeta[] = DEFS.map(([key, track, threshold, rarity]) => ({
  key, track, threshold, rarity, emoji: T[track].emoji, title: T[track].noun(threshold),
}))
export const milestoneByKey = (key: string) => MILESTONES.find(m => m.key === key) ?? null
