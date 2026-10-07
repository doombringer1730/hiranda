// The Path: short, research-backed lessons you do together. Each lesson is a
// small real action inside Hiranda, then a line of reflection. A lesson is
// "done together" once you've both finished it.

export type Lesson = {
  key: string
  title: string
  learn: string
  source: string
  action: { label: string; href: string }
  reflect: string
}
export type Unit = { key: string; title: string; emoji: string; color: string; blurb: string; lessons: Lesson[] }

export const PATH: Unit[] = [
  {
    key: 'maps', title: 'Love Maps', emoji: '🗺️', color: '#3f7fb5',
    blurb: 'Know the inside of each other’s world.',
    lessons: [
      { key: 'maps_1', title: 'Know their world', learn: 'Couples who know the details of each other’s lives — worries, favourites, what’s coming up this week — weather stress and change better. That knowledge is called a love map.', source: 'Gottman', action: { label: 'Answer 3 quick questions', href: '/games/questions' }, reflect: 'What surprised you about their answers?' },
      { key: 'maps_2', title: 'Ask a bigger question', learn: 'Closeness grows from back-and-forth sharing that slowly gets more personal — but only when both people want to go there.', source: 'Aron et al., 1997', action: { label: 'Play Daring Questions', href: '/games/daring' }, reflect: 'Which question would you like to come back to?' },
      { key: 'maps_3', title: 'Quiz each other', learn: 'Testing what you know beats just hearing it — recall locks things in. Trivia about each other is study, disguised as play.', source: 'Roediger & Karpicke, 2006', action: { label: 'Play Trivia About Us', href: '/games/trivia' }, reflect: 'One thing you’ll never forget now:' },
      { key: 'maps_4', title: 'Review your map', learn: 'Spacing reviews out over days is the most reliable way to remember. A few cards a day keeps your love map fresh.', source: 'Cepeda et al., 2006', action: { label: 'Do a Love Map review', href: '/grow/review' }, reflect: 'What do you want to learn about them next?' },
    ],
  },
  {
    key: 'toward', title: 'Turning Toward', emoji: '🤲', color: '#c4568a',
    blurb: 'Answer the little bids for attention.',
    lessons: [
      { key: 'toward_1', title: 'Notice the bids', learn: 'A bid is any small reach for connection — a link, a sigh, “look at this”. Couples who stayed together answered bids 86% of the time; couples who split, 33%.', source: 'Gottman & Levenson', action: { label: 'Send a bid in Chat', href: '/chat' }, reflect: 'What’s a bid of theirs you might have missed lately?' },
      { key: 'toward_2', title: 'Thinking of you', learn: 'Tiny, frequent signals of affection matter more than rare grand gestures. They add up to feeling cared for.', source: 'Gottman', action: { label: 'Send a heart from Home', href: '/' }, reflect: 'When do you most want to hear from them?' },
      { key: 'toward_3', title: 'Celebrate their good news', learn: 'How you react to good news matters more than how you support bad news. Enthusiastic, curious replies (“tell me everything!”) build the relationship; flat ones wear it down.', source: 'Gable et al., 2004', action: { label: 'Share good news in Chat', href: '/chat' }, reflect: 'How did it feel to be celebrated?' },
      { key: 'toward_4', title: 'Just talk', learn: 'Undistracted time — phones down, nothing to fix — is when people feel most understood by a partner.', source: 'Reis & Shaver', action: { label: 'Do 10 minutes of Talk time', href: '/' }, reflect: 'What did you learn in those ten minutes?' },
    ],
  },
  {
    key: 'thanks', title: 'Gratitude', emoji: '💛', color: '#d39a2a',
    blurb: 'Notice, say it, save it.',
    lessons: [
      { key: 'thanks_1', title: 'The thank-you habit', learn: 'Gratitude helps you find, remind and bind: it points you to what’s good, reminds you of their value, and pulls you closer.', source: 'Algoe, 2012', action: { label: 'Drop a thank-you in the jar', href: '/letters' }, reflect: 'Something small they did this week that you noticed:' },
      { key: 'thanks_2', title: 'Say it out loud', learn: 'Specific thanks (“thank you for waiting up for me”) lands far harder than general thanks. Be precise.', source: 'Algoe, Gable & Maisel, 2010', action: { label: 'Thank them in Chat', href: '/chat' }, reflect: 'How did they react?' },
      { key: 'thanks_3', title: 'Open when…', learn: 'A letter they can open on a hard day is gratitude saved for when it’s needed most.', source: 'Algoe & Chandler', action: { label: 'Write an “open when” letter', href: '/letters' }, reflect: 'Which moment did you write it for?' },
      { key: 'thanks_4', title: 'Three good things', learn: 'Writing down three good things — and why they happened — lifts mood for weeks. Do it about the two of you.', source: 'Seligman et al., 2005', action: { label: 'Write in the Journal', href: '/journal/new' }, reflect: 'Your three, in a sentence:' },
    ],
  },
  {
    key: 'repair', title: 'Fighting Fair', emoji: '🕊️', color: '#3c9a7a',
    blurb: 'Disagree without drifting apart.',
    lessons: [
      { key: 'repair_1', title: 'Soft start-up', learn: 'How a hard conversation starts predicts how it ends. Try “I feel… about… I need…” instead of “you always…”.', source: 'Gottman', action: { label: 'Talk about how you each like to be comforted', href: '/' }, reflect: 'Your soft start-up, in your own words:' },
      { key: 'repair_2', title: 'The pause button', learn: 'When your heart races in a fight, you stop hearing each other. A 20-minute break — then coming back — resets it.', source: 'Gottman (flooding)', action: { label: 'Agree on a pause word in Chat', href: '/chat' }, reflect: 'Your pause word:' },
      { key: 'repair_3', title: 'Repair attempts', learn: 'Every couple fights. The ones that last make — and accept — small repairs: a joke, “I’m sorry”, “can we start over?”.', source: 'Gottman', action: { label: 'Pick your repair phrase together', href: '/chat' }, reflect: 'The phrase you chose:' },
      { key: 'repair_4', title: 'A do-over', learn: 'Revisiting a small past disagreement when you’re both calm turns it into understanding instead of a scar.', source: 'Gottman', action: { label: 'Talk it through in Talk time', href: '/' }, reflect: 'What do you understand now that you didn’t then?' },
    ],
  },
  {
    key: 'new', title: 'Adventure', emoji: '🧭', color: '#8b5cc4',
    blurb: 'Do new things, together.',
    lessons: [
      { key: 'new_1', title: 'Fill the jar', learn: 'Couples who did new, exciting things together felt better about the relationship than couples who did pleasant, familiar things.', source: 'Aron et al., 2000', action: { label: 'Add 3 things to the Jar', href: '/games/jar' }, reflect: 'The one you secretly hope gets drawn:' },
      { key: 'new_2', title: 'Draw and do', learn: 'A plan picked by chance takes the deciding out of it — and novelty is the point.', source: 'Aron et al., 2000', action: { label: 'Draw from the Jar', href: '/games/jar' }, reflect: 'When will you do it?' },
      { key: 'new_3', title: 'Someday', learn: 'Shared goals give a relationship a direction. Write down the big ones so they don’t stay “one day”.', source: 'Self-expansion theory', action: { label: 'Add to Someday', href: '/bucket-list' }, reflect: 'The one you want to do first:' },
      { key: 'new_4', title: 'Make it a memory', learn: 'Savouring — reliving a good moment together — makes it count twice.', source: 'Bryant & Veroff', action: { label: 'Add a memory', href: '/memories/new' }, reflect: 'Why does this one matter?' },
    ],
  },
]

export const ALL_LESSONS = PATH.flatMap(u => u.lessons.map(l => ({ ...l, unit: u })))
export const lessonByKey = (key: string) => ALL_LESSONS.find(l => l.key === key) ?? null

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
