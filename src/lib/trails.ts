// Trails: short guided courses, five days each, on one topic you pick
// together. A day opens once you've both finished the one before, never on a
// timer, so a busy week just pauses the trail. Day one of every trail is free;
// the rest come with Plus. Every "learn" cites a real study, like the Path.

export type TrailDay = {
  title: string
  learn: string
  source: string
  doIt: string   // one small thing to do together, for real
  ask: string    // a question you each answer; revealed once you've both finished
}
export type Trail = { key: string; title: string; emoji: string; color: string; blurb: string; days: TrailDay[] }

export const FREE_TRAIL_DAYS = 1

export const TRAILS: Trail[] = [
  {
    key: 'money', title: 'Money talk', emoji: '💸', color: '#3c9a7a',
    blurb: 'Where your habits came from, and what you want money to do for you two.',
    days: [
      { title: 'Your money story', learn: 'Money arguments come back more often and run hotter than arguments about anything else. They are rarely about the number; they are about what money means to each of you.', source: 'Papp, Cummings & Goeke-Morey, 2009', doIt: 'Each of you tells one money memory from growing up. Just listen; no fixing.', ask: 'What did money feel like in your house growing up?' },
      { title: 'Saver, spender, or both', learn: 'Savers often fall for spenders, and the gap shows up as money conflict later. Seeing it as a style, not a flaw, takes the heat out of it.', source: 'Rick, Small & Finkel, 2011', doIt: 'Guess which one the other is, then say which you think you are.', ask: 'What’s a purchase you have never regretted?' },
      { title: 'Small talks, often', learn: 'Disagreements about money predicted couples splitting up better than disagreements about other things. Little calm talks keep them small.', source: 'Dew, Britt & Huston, 2012', doIt: 'Pick one thing you would both love to save for and give it a name.', ask: 'What would you do with an extra $1,000 that’s only for us?' },
      { title: 'The money date', learn: 'How a hard talk starts predicts how it ends. Starting gently and at a calm time works far better than starting mid-crisis.', source: 'Gottman & Silver, 1999', doIt: 'Put a 20-minute money date on your calendar this month. Snacks required.', ask: 'What makes money talks hard for you?' },
      { title: 'Yours, mine, ours', learn: 'Newlyweds who were nudged to pool some of their money felt more like a team and stayed happier over the next two years.', source: 'Garbinsky, Gladstone & Mogilner, 2023', doIt: 'Talk about one thing that should feel like “ours”, even if your accounts stay separate.', ask: 'What’s one thing you want to stay just yours?' },
    ],
  },
  {
    key: 'love', title: 'Ways we love', emoji: '💞', color: '#c4568a',
    blurb: 'How each of you feels loved, beyond the five love languages.',
    days: [
      { title: 'How you know you’re loved', learn: 'People agree most on small, warm acts as signs of love (a hug, being asked how they are) more than on grand gestures.', source: 'Heshmati et al., 2019', doIt: 'Each write down three tiny things that make you feel loved, then swap.', ask: 'What’s a small thing I do that makes you feel loved?' },
      { title: 'More than one language', learn: 'Recent research found little support for having one “love language”. Couples did best when they showed love in many ways, and kept asking.', source: 'Impett, Park & Muise, 2024', doIt: 'Show love today in a way you usually don’t.', ask: 'Which way of showing love comes easiest to you?' },
      { title: 'Words', learn: 'Feeling appreciated by a partner makes people more appreciative in return: thanks starts an upward spiral.', source: 'Gordon et al., 2012', doIt: 'Send one specific sentence about something they did this week.', ask: 'What’s a compliment from me you still remember?' },
      { title: 'Touch', learn: 'Couples who had warm physical contact before a stressful task showed lower stress hormones during it.', source: 'Ditzen et al., 2007', doIt: 'A 20-second hug today, no talking.', ask: 'What kind of affection do you want most on a hard day?' },
      { title: 'Time and help', learn: 'Feeling understood, valued and cared for (being “responsive”) is at the heart of feeling loved.', source: 'Reis, Clark & Holmes, 2004', doIt: 'Ask “what would help you this week?” and do one thing on the list.', ask: 'What’s something I could take off your plate?' },
    ],
  },
  {
    key: 'distance', title: 'Miles apart', emoji: '✈️', color: '#3f7fb5',
    blurb: 'For when you are in different places, for a week or a year.',
    days: [
      { title: 'Closer than you think', learn: 'Long-distance couples often share more in each conversation and feel just as close day to day as couples who live nearby.', source: 'Jiang & Hancock, 2013', doIt: 'Tell each other one thing you didn’t get to say yesterday.', ask: 'What do you miss most about being in the same room?' },
      { title: 'Same time, different places', learn: 'Shared routines and everyday talk are what keep couples apart feeling like a couple.', source: 'Stafford, 2005', doIt: 'Pick something to watch together in Movie night this week.', ask: 'What should our next long-distance date be?' },
      { title: 'Something to count down to', learn: 'Waiting for an experience is a pleasure of its own, often more than waiting for a thing.', source: 'Kumar, Killingsworth & Gilovich, 2014', doIt: 'Put your next visit in Dates, or pick the day you will plan it.', ask: 'The first thing we do when we see each other?' },
      { title: 'Little proofs', learn: 'Small everyday things (staying positive, saying you’re in it, sharing tasks) are what keep relationships going, especially apart.', source: 'Stafford & Canary, 1991', doIt: 'Send a photo of something that made you think of them.', ask: 'Which message from me do you reread?' },
      { title: 'The boring Tuesday', learn: 'Couples apart tend to idealize each other, so reunions can feel bumpy. Picturing ordinary days together helps.', source: 'Stafford & Merolla, 2007', doIt: 'Describe a boring Tuesday together, once you’re in the same place.', ask: 'What ordinary thing do you most want to do together?' },
    ],
  },
  {
    key: 'home', title: 'Moving in', emoji: '🏠', color: '#d39a2a',
    blurb: 'Sharing a home on purpose: chores, space and the little rituals.',
    days: [
      { title: 'Deciding, not sliding', learn: 'Couples who decided to move in on purpose, instead of sliding into it, did better later on.', source: 'Stanley, Rhoades & Markman, 2006', doIt: 'Each finish the sentence “I want to live with you because…”.', ask: 'What are you most excited about?' },
      { title: 'The chore talk', learn: 'Couples who shared housework fairly were happier with the relationship, and with their sex life.', source: 'Carlson et al., 2016', doIt: 'Each pick the chore you mind least and the one you would trade anything to skip.', ask: 'Which chore should we always do together?' },
      { title: 'Alone, together', learn: 'Relationships go better when each of you feels free to be yourself, and that includes time on your own.', source: 'Patrick et al., 2007', doIt: 'Each say how much alone time you need in a week.', ask: 'What does a good night in, alone, look like for you?' },
      { title: 'A ritual of your own', learn: 'Small shared rituals build a sense of “us” and a home that feels like yours.', source: 'Fiese et al., 2002', doIt: 'Choose one small ritual for home: Sunday pancakes, a goodnight song, anything.', ask: 'What’s a ritual from your family you want to keep?' },
      { title: 'The things that stay', learn: 'Most of what couples argue about never fully goes away. What matters is talking about it kindly and with humor.', source: 'Gottman, 1999', doIt: 'Each name one habit of yours that might drive the other a little mad.', ask: 'What’s one thing you’ll happily let slide?' },
    ],
  },
  {
    key: 'family', title: 'Our people', emoji: '👪', color: '#8b5cc4',
    blurb: 'Families, friends and holidays, as a team.',
    days: [
      { title: 'Where you come from', learn: 'How your family handled feelings often shows up in how you handle them as a couple.', source: 'Gottman, Katz & Hooven, 1996', doIt: 'Each share one thing your family did that you’d copy, and one you wouldn’t.', ask: 'What’s a family tradition you love?' },
      { title: 'Facing it together', learn: 'Couples who handle outside stress as a team (“our problem”) are more satisfied than couples who handle it alone.', source: 'Falconier et al., 2015', doIt: 'Plan the next visit or holiday: who, where, and how long.', ask: 'What helps you most at a family gathering?' },
      { title: 'Team us', learn: 'Couples who say “we” more during disagreements handle them better and feel better about the relationship.', source: 'Seider et al., 2009', doIt: 'Agree on a small signal for “I need a break” at family events.', ask: 'What’s a sentence that makes you feel backed up?' },
      { title: 'Your people, my people', learn: 'When friends and family support a relationship, it is more likely to last.', source: 'Sprecher & Felmlee, 1992', doIt: 'Tell each other one person in your life you’d love them to know better.', ask: 'Who in my life do you get along with best?' },
      { title: 'The family we make', learn: 'A shared picture of the future is a big part of what keeps couples committed.', source: 'Stanley, Rhoades & Whitton, 2010', doIt: 'Talk about what family looks like for you in ten years, whatever that means to you.', ask: 'What do you want our home to feel like?' },
    ],
  },
  {
    key: 'repair', title: 'After a fight', emoji: '🕊️', color: '#5b8fd6',
    blurb: 'Coming back to each other after a hard one.',
    days: [
      { title: 'Cool down first', learn: 'When your heart races in a fight, you stop hearing each other. About 20 minutes apart lets it settle.', source: 'Gottman & Silver, 1999', doIt: 'Take 20 minutes apart doing something calming, then come back.', ask: 'What helps you calm down?' },
      { title: 'From the outside', learn: 'Couples who wrote about a fight from a kind outsider’s view for 7 minutes, three times a year, stopped the usual slide in satisfaction.', source: 'Finkel et al., 2013', doIt: 'Each write for 7 minutes as a friend who wants the best for you both.', ask: 'What would a friend who loves us both say?' },
      { title: 'The feeling underneath', learn: 'Showing softer feelings (hurt, worry) invites closeness. Anger tends to invite defending.', source: 'Sanford, 2007', doIt: 'Each finish the sentence “Under my frustration, I felt…”.', ask: 'What were you really worried about?' },
      { title: 'Own a piece', learn: 'Of everything in an apology, taking responsibility matters most.', source: 'Lewicki, Polin & Lount, 2016', doIt: 'Each name one small part that was yours.', ask: 'What would you do differently next time?' },
      { title: 'Back to us', learn: 'Couples who forgive bounce back faster and handle the next disagreement better.', source: 'Fincham, Beach & Davila, 2004', doIt: 'Do one light thing together today: a game, a walk, a song.', ask: 'What do you love about us, even on hard days?' },
    ],
  },
]

export const trailByKey = (key: string) => TRAILS.find(t => t.key === key) ?? null

/** Which day is open: the first one you haven't both finished (1-based); days.length + 1 when the trail is done. */
export function openDay(trail: Trail, doneBy: Map<number, Set<string>>, a: string, b: string) {
  for (let d = 1; d <= trail.days.length; d++) {
    const s = doneBy.get(d)
    if (!s?.has(a) || !s?.has(b)) return d
  }
  return trail.days.length + 1
}
