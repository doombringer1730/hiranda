// The Map: Grow's lessons as hand-drawn trails you pick together. It replaced
// the old Path and Trails; their lesson keys live on here (Path keys as-is,
// trail days via stopKeyForTrailDay), so progress already made still counts.
//
// Design rules (owner's research + the critic's review):
//   - No forced order. Base camp routes are suggested, not required; a couple
//     can start any route. Inside a route, stops go in order.
//   - Nothing is scored. A guess shows the answer warmly; a prediction about
//     your partner is a discovery ("new on your map"), never right/wrong.
//   - Predictions are about likes and inner world only, never about hurt,
//     satisfaction or conflict.
//   - Repair content is always free and carries safety copy.
//   - Learn cards stay short (≤ 40 words) and say "a link, not proof" when the
//     research is correlational.

export type Guess = { q: string; options: string[]; answer: number; reveal: string }
// `q` asks what your partner would say ("{p}" becomes their first name); `self`
// asks you the same thing about yourself. Both answers stay sealed until you've both answered.
export type Predict = { q: string; self: string; options: string[] }

export type Stop = {
  key: string // ≤ 40 chars; stored in lesson_progress.lesson_key
  title: string
  guess?: Guess
  learn: string
  source: string
  caveat?: string
  predict?: Predict
  /** One small real thing to do. `href` when it happens elsewhere in Hiranda. */
  do: { text: string; href?: string; label?: string }
  reflect: string
}

export type RouteKind = 'base' | 'branch'
export type Route = {
  key: string
  title: string
  emoji: string
  color: string
  blurb: string
  kind: RouteKind
  /** Always free (repair). */
  free?: boolean
  /** Hard topics: shown with a gentle note first. */
  care?: boolean
  /** Who it's most useful for, for the "suggested for you" hint. */
  suggest?: 'apart' | 'together'
  stops: Stop[]
}

export const SAFETY_NOTE =
  'If you ever feel afraid of your partner, this isn’t a communication problem, and you deserve support. In the US, call 1-800-799-7233 or text START to 88788 (National Domestic Violence Hotline).'

export const ROUTES: Route[] = [
  // ── Base camp ──
  {
    key: 'maps', title: 'Love Maps', emoji: '🗺️', color: '#3f7fb5', kind: 'base',
    blurb: 'Know the inside of each other’s world.',
    stops: [
      {
        key: 'maps_1', title: 'Know their world',
        guess: {
          q: 'In Gottman’s research, what helped couples get through big changes, like a first baby?',
          options: ['Agreeing on most things', 'Knowing the details of each other’s world', 'Rarely arguing'],
          answer: 1,
          reveal: 'Couples who knew each other’s worries, hopes and everyday details coped with big changes better.',
        },
        learn: 'A love map is what you know about their world: what’s stressing them this week, who their people are, what they’re hoping for. It goes out of date, so you keep asking.',
        source: 'Gottman & Silver, 1999', caveat: 'A link, not proof.',
        predict: { q: 'What would {p} pick for a perfect Saturday?', self: 'What would you pick for a perfect Saturday?', options: ['A slow morning in', 'Out exploring somewhere new', 'Time with friends', 'A project or hobby'] },
        do: { text: 'Answer three Quick Questions together.', href: '/games/questions', label: 'Open Quick Questions' },
        reflect: 'Something about them you want to ask more about:',
      },
      {
        key: 'maps_2', title: 'Ask a bigger question',
        guess: {
          q: 'In the “36 questions” study, what made two strangers feel closest?',
          options: ['45 minutes of small talk', 'Taking turns with questions that slowly got more personal', 'Doing a puzzle together'],
          answer: 1,
          reveal: 'Back-and-forth sharing that slowly went deeper did it. It only works when both people want to go there.',
        },
        learn: 'Closeness grows when you take turns opening up a little more each time. Go at the pace of whoever is less ready; you can always come back to a question.',
        source: 'Aron et al., 1997',
        predict: { q: 'Which question would {p} most like to be asked?', self: 'Which question would you most like to be asked?', options: ['What are you proud of lately?', 'What do you dream about doing?', 'What was your childhood like?', 'What’s on your mind this week?'] },
        do: { text: 'Pick one Daring Question and take turns answering.', href: '/games/daring', label: 'Open Daring Questions' },
        reflect: 'A question you’d like to come back to:',
      },
      {
        key: 'maps_3', title: 'Play detective',
        learn: 'Trivia about each other is an excuse to ask. The score doesn’t matter: every wrong guess is something new to ask about.',
        source: 'Gottman (love maps)',
        predict: { q: 'Which would {p} rather have: a surprise, or a plan to look forward to?', self: 'Which would you rather have: a surprise, or a plan to look forward to?', options: ['A surprise', 'A plan to look forward to', 'Depends on the day'] },
        do: { text: 'Write one trivia question about yourself for them.', href: '/games/trivia', label: 'Open Trivia About Us' },
        reflect: 'The best follow-up question it led to:',
      },
      {
        key: 'maps_4', title: 'Keep your map fresh',
        learn: 'People change. Looking back over what you know about each other, a few cards at a time, keeps your map current instead of frozen.',
        source: 'Gottman; spacing research (Cepeda et al., 2006)',
        do: { text: 'Do a Love Map review.', href: '/grow/review', label: 'Open the review' },
        reflect: 'Something about them that’s changed lately:',
      },
    ],
  },
  {
    key: 'toward', title: 'Turning Toward', emoji: '🤲', color: '#c4568a', kind: 'base',
    blurb: 'Answer the little reaches for each other.',
    stops: [
      {
        key: 'toward_1', title: 'Notice the bids',
        guess: {
          q: 'Couples still happy six years on answered each other’s small bids for attention…',
          options: ['About a third of the time', 'About half the time', 'Most of the time'],
          answer: 2,
          reveal: 'Most of the time: about 86%. For couples who later split, about 33%. Nobody manages 100%.',
        },
        learn: 'A bid is any small reach: a meme, a sigh, “look at this”. Turning toward it can be tiny: a laugh, “ha, tell me more”. The everyday ones add up.',
        source: 'Gottman & Levenson; Driver & Gottman, 2004', caveat: 'A link, not proof.',
        predict: { q: 'How does {p} most often reach for you?', self: 'How do you most often reach for them?', options: ['Sending a song or a meme', 'A photo of their day', '“Guess what…”', '“Ugh, today.”'] },
        do: { text: 'Answer their next bid within the hour, even with one line.', href: '/chat', label: 'Open Chat' },
        reflect: 'A bid of theirs I want to catch more:',
      },
      {
        key: 'toward_2', title: 'Thinking of you',
        learn: 'Small, frequent signs of affection matter more than rare big gestures. They add up to feeling cared for.',
        source: 'Gottman',
        predict: { q: 'When does {p} most like to hear from you?', self: 'When do you most like to hear from them?', options: ['First thing in the morning', 'Middle of the day', 'In the evening', 'Right before sleep'] },
        do: { text: 'Send a heart from Home at the time you guessed.', href: '/', label: 'Go to Home' },
        reflect: 'When do you most want to hear from them?',
      },
      {
        key: 'toward_3', title: 'Celebrate their good news',
        guess: {
          q: 'When a partner shares good news, which reply built the relationship most?',
          options: ['“That’s great.”', '“Tell me everything! How did it feel?”', '“Don’t get your hopes up.”'],
          answer: 1,
          reveal: 'Only the enthusiastic, curious reply was linked with a better relationship. A flat “that’s great” wasn’t.',
        },
        learn: 'How you react to good news may matter as much as how you support bad news. Ask questions, let them tell it twice, be glad out loud.',
        source: 'Gable et al., 2004', caveat: 'A link, not proof.',
        predict: { q: 'What good news is {p} most likely to share first?', self: 'What good news are you most likely to share first?', options: ['Something at work or school', 'Something funny that happened', 'Something they made or finished', 'Plans for us'] },
        do: { text: 'Share one good thing from your week in Chat, as good news.', href: '/chat', label: 'Open Chat' },
        reflect: 'How did it feel to be celebrated?',
      },
      {
        key: 'toward_4', title: 'Just talk',
        learn: 'Feeling understood comes from being listened to, not fixed. Undistracted time, phones down, is where it happens.',
        source: 'Reis & Shaver, 1988',
        predict: { q: 'What would {p} most want to talk about tonight?', self: 'What would you most want to talk about tonight?', options: ['Their day', 'Something they’re looking forward to', 'Something on their mind', 'Nothing in particular, just us'] },
        do: { text: 'Do ten minutes of Talk time.', href: '/', label: 'Go to Talk time' },
        reflect: 'Something you learned in those ten minutes:',
      },
    ],
  },
  {
    key: 'thanks', title: 'Gratitude', emoji: '💛', color: '#d39a2a', kind: 'base',
    blurb: 'Notice it, say it, save it.',
    stops: [
      {
        key: 'thanks_1', title: 'The thank-you habit',
        guess: {
          q: 'Feeling grateful for a partner is linked with…',
          options: ['Feeling closer and more committed', 'Doing fewer chores', 'Needing more time apart'],
          answer: 0,
          reveal: 'Gratitude helps you notice what’s good in them and pulls you closer: “find, remind and bind”.',
        },
        learn: 'Gratitude points you to what’s good in your partner, reminds you why they matter, and draws you together.',
        source: 'Algoe, 2012', caveat: 'A link, not proof.',
        predict: { q: 'Which kind of thanks lands best with {p}?', self: 'Which kind of thanks lands best with you?', options: ['Said out loud', 'Written down', 'A small favor back', 'A hug'] },
        do: { text: 'Drop a thank-you in the jar.', href: '/letters', label: 'Open the jar' },
        reflect: 'Something small they did this week that you noticed:',
      },
      {
        key: 'thanks_2', title: 'Say it out loud',
        learn: 'Everyday thanks works like a booster shot for a relationship. Being specific (“thanks for waiting up for me”) shows you noticed.',
        source: 'Algoe, Gable & Maisel, 2010',
        do: { text: 'Thank them for one specific thing in Chat.', href: '/chat', label: 'Open Chat' },
        reflect: 'How did they react?',
      },
      {
        key: 'thanks_3', title: 'Open when…',
        learn: 'A letter they can open on a hard day saves your thanks for when it’s needed most.',
        source: 'An idea built on Algoe, 2012',
        do: { text: 'Write an “open when” letter.', href: '/letters', label: 'Open Letters' },
        reflect: 'Which moment did you write it for?',
      },
      {
        key: 'thanks_4', title: 'Three good things',
        learn: 'Writing down good things, and why they happened, is a simple gratitude habit. Try it about the two of you.',
        source: 'Seligman et al., 2005 (a study of individuals)',
        do: { text: 'Write three good things about us in the Journal.', href: '/journal/new', label: 'Open the Journal' },
        reflect: 'Your three, in a sentence:',
      },
    ],
  },

  // ── Branches ──
  {
    key: 'repair', title: 'Fighting fair', emoji: '🕊️', color: '#5b8fd6', kind: 'branch', free: true, care: true,
    blurb: 'Disagree without drifting apart, and find your way back.',
    stops: [
      {
        key: 'repair_1', title: 'Soft start-up',
        guess: {
          q: 'In Gottman’s studies, what best predicted how a conflict talk would end?',
          options: ['Who talked more', 'How it started, in the first three minutes', 'How long it lasted'],
          answer: 1,
          reveal: 'How it started. Harsh start-ups tended to end badly; gentle ones gave the talk a chance.',
        },
        learn: 'Start a hard talk with “I feel… about… I need…” instead of “you always…”. It’s easier to hear, so it’s easier to answer kindly.',
        source: 'Carrère & Gottman, 1999', caveat: 'A link, not proof.',
        do: { text: 'Each write a soft start-up for something tiny, like the dishes, and read them to each other.' },
        reflect: 'Your soft start-up, in your own words:',
      },
      {
        key: 'repair_2', title: 'The pause button',
        guess: {
          q: 'Once you’re flooded (heart racing mid-fight), roughly how long does it take to settle?',
          options: ['A couple of minutes', 'About 20 minutes', 'A whole day'],
          answer: 1,
          reveal: 'About 20 minutes apart, doing something calming, then coming back. The coming back is the important part.',
        },
        learn: 'When your heart races in a fight, you stop hearing each other. A break of about 20 minutes, then coming back, resets it.',
        source: 'Gottman & Silver, 1999',
        predict: { q: 'What helps {p} calm down most?', self: 'What helps you calm down most?', options: ['Time alone', 'A walk', 'A hug', 'Talking it through right away'] },
        do: { text: 'Agree on a pause word, and what “I’ll come back” means for you.', href: '/chat', label: 'Open Chat' },
        reflect: 'Your pause word:',
      },
      {
        key: 't_repair_3', title: 'The feeling underneath',
        learn: 'Showing softer feelings, like hurt or worry, invites closeness. Anger tends to invite defending.',
        source: 'Sanford, 2007',
        do: { text: 'Each finish the sentence “Under my frustration, I felt…”.' },
        reflect: 'What were you really worried about?',
      },
      {
        key: 'repair_3', title: 'Repair attempts',
        learn: 'Every couple fights. The ones that last make, and accept, small repairs: a joke, “I’m sorry”, “can we start over?”.',
        source: 'Gottman',
        do: { text: 'Pick a repair phrase you’ll both recognize.', href: '/chat', label: 'Open Chat' },
        reflect: 'The phrase you chose:',
      },
      {
        key: 't_repair_2', title: 'From the outside',
        learn: 'Couples who wrote about a fight from a kind outsider’s view, 7 minutes three times a year, stopped the usual slide in satisfaction.',
        source: 'Finkel et al., 2013',
        do: { text: 'Each write for 7 minutes as a friend who wants the best for you both.' },
        reflect: 'What would a friend who loves us both say?',
      },
      {
        key: 't_repair_4', title: 'Own a piece',
        learn: 'In an apology, taking responsibility matters most. That’s for ordinary fights between equals, not for anything that leaves you afraid.',
        source: 'Lewicki, Polin & Lount, 2016',
        do: { text: 'Each name one small part that was yours.' },
        reflect: 'What would you do differently next time?',
      },
      {
        key: 'repair_4', title: 'A do-over',
        learn: 'Coming back to a small past disagreement when you’re both calm can turn it into understanding instead of a scar.',
        source: 'Gottman',
        do: { text: 'Talk one small one through in Talk time.', href: '/', label: 'Go to Talk time' },
        reflect: 'What do you understand now that you didn’t then?',
      },
      {
        key: 't_repair_5', title: 'Back to us',
        learn: 'Couples who forgive tend to bounce back faster and handle the next disagreement better.',
        source: 'Fincham, Beach & Davila, 2004', caveat: 'A link, not proof.',
        do: { text: 'Do one light thing together today: a game, a walk, a song.' },
        reflect: 'What do you love about us, even on hard days?',
      },
    ],
  },
  {
    key: 'money', title: 'Money talk', emoji: '💸', color: '#3c9a7a', kind: 'branch', care: true,
    blurb: 'What money means to each of you.',
    stops: [
      { key: 't_money_1', title: 'Your money story', learn: 'Money arguments come back more often and run hotter than most. They’re rarely about the number; they’re about what money means to each of you.', source: 'Papp, Cummings & Goeke-Morey, 2009', do: { text: 'Each tell one money memory from growing up. Just listen; no fixing.' }, reflect: 'What did money feel like in your house growing up?' },
      { key: 't_money_2', title: 'Saver, spender, or both', learn: 'Savers often fall for spenders, and the gap can show up later as money conflict. Seeing it as a style, not a flaw, takes the heat out.', source: 'Rick, Small & Finkel, 2011', do: { text: 'Guess which one the other is, then say which you think you are.' }, reflect: 'A purchase you have never regretted:' },
      { key: 't_money_3', title: 'Small talks, often', learn: 'Disagreements about money were linked with couples splitting up more than other disagreements. Little calm talks keep them small.', source: 'Dew, Britt & Huston, 2012', caveat: 'A link, not proof.', do: { text: 'Pick one thing you’d both love to save for and give it a name.' }, reflect: 'What would you do with an extra $1,000 that’s only for us?' },
      { key: 't_money_4', title: 'The money date', learn: 'How a hard talk starts shapes how it ends. A calm, planned time works far better than mid-crisis.', source: 'Gottman & Silver, 1999', do: { text: 'Put a 20-minute money date on your calendar this month. Snacks required.' }, reflect: 'What makes money talks hard for you?' },
      { key: 't_money_5', title: 'Yours, mine, ours', learn: 'Newlyweds nudged to pool some of their money felt more like a team and stayed happier over the next two years.', source: 'Garbinsky, Gladstone & Mogilner, 2023', do: { text: 'Talk about one thing that should feel like “ours”, even if your accounts stay separate.' }, reflect: 'One thing you want to stay just yours:' },
    ],
  },
  {
    key: 'love', title: 'Ways we love', emoji: '💞', color: '#c4568a', kind: 'branch',
    blurb: 'How each of you feels loved.',
    stops: [
      { key: 't_love_1', title: 'How you know you’re loved', learn: 'People agree most on small, warm acts as signs of love, like a hug or being asked how they are, more than grand gestures.', source: 'Heshmati et al., 2019', do: { text: 'Each write down three tiny things that make you feel loved, then swap.' }, reflect: 'A small thing I do that makes you feel loved:' },
      { key: 't_love_2', title: 'More than one language', learn: 'Recent research found little support for having one “love language”. Couples did best showing love in many ways, and asking.', source: 'Impett, Park & Muise, 2024', do: { text: 'Show love today in a way you usually don’t.' }, reflect: 'Which way of showing love comes easiest to you?' },
      { key: 't_love_3', title: 'Words', learn: 'Feeling appreciated makes people more appreciative in return: thanks can start an upward spiral.', source: 'Gordon et al., 2012', do: { text: 'Send one specific sentence about something they did this week.', href: '/chat', label: 'Open Chat' }, reflect: 'A compliment from me you still remember:' },
      { key: 't_love_4', title: 'Touch', learn: 'Couples who had warm physical contact before a stressful task showed lower stress hormones during it.', source: 'Ditzen et al., 2007', do: { text: 'A 20-second hug today, no talking. Apart? Plan the first one.' }, reflect: 'What kind of affection do you want most on a hard day?' },
      { key: 't_love_5', title: 'Time and help', learn: 'Feeling understood, valued and cared for is at the heart of feeling loved.', source: 'Reis, Clark & Holmes, 2004', do: { text: 'Ask “what would help you this week?” and do one thing on the list.' }, reflect: 'Something I could take off your plate:' },
    ],
  },
  {
    key: 'distance', title: 'Miles apart', emoji: '✈️', color: '#3f7fb5', kind: 'branch', suggest: 'apart',
    blurb: 'Close, from far away.',
    stops: [
      { key: 't_distance_1', title: 'Closer than you think', learn: 'Long-distance couples often share more in each conversation, and can feel just as close day to day as couples nearby.', source: 'Jiang & Hancock, 2013', do: { text: 'Tell each other one thing you didn’t get to say yesterday.', href: '/chat', label: 'Open Chat' }, reflect: 'What do you miss most about being in the same room?' },
      { key: 't_distance_2', title: 'Same time, different places', learn: 'Shared routines and everyday talk keep couples apart feeling like a couple.', source: 'Stafford, 2005', do: { text: 'Pick something to watch together this week.', href: '/watch', label: 'Open the Theater' }, reflect: 'What should our next long-distance date be?' },
      { key: 't_distance_3', title: 'Something to count down to', learn: 'Waiting for an experience is a pleasure of its own, often more than waiting for a thing.', source: 'Kumar, Killingsworth & Gilovich, 2014', do: { text: 'Put your next visit in Dates, or the day you’ll plan it.', href: '/dates/new', label: 'Add a date' }, reflect: 'The first thing we do when we see each other:' },
      { key: 't_distance_4', title: 'Little proofs', learn: 'Small everyday things, like staying positive and saying you’re in it, keep relationships going, especially apart.', source: 'Stafford & Canary, 1991', do: { text: 'Send a photo of something that made you think of them.', href: '/chat', label: 'Open Chat' }, reflect: 'Which message from me do you reread?' },
      { key: 't_distance_5', title: 'The boring Tuesday', learn: 'Couples apart tend to idealize each other, so reunions can feel bumpy. Picturing ordinary days together helps.', source: 'Stafford & Merolla, 2007', do: { text: 'Describe a boring Tuesday together, once you’re in the same place.' }, reflect: 'What ordinary thing do you most want to do together?' },
    ],
  },
  {
    key: 'home', title: 'Moving in', emoji: '🏠', color: '#d39a2a', kind: 'branch', suggest: 'together',
    blurb: 'Making one home out of two.',
    stops: [
      { key: 't_home_1', title: 'Deciding, not sliding', learn: 'Couples who decided to move in on purpose, instead of sliding into it, tended to do better later on.', source: 'Stanley, Rhoades & Markman, 2006', caveat: 'A link, not proof.', do: { text: 'Each finish the sentence “I want to live with you because…”.' }, reflect: 'What are you most excited about?' },
      { key: 't_home_2', title: 'The chore talk', learn: 'Couples who shared housework fairly were happier with the relationship, and with their sex life.', source: 'Carlson et al., 2016', do: { text: 'Each pick the chore you mind least and the one you’d trade anything to skip.' }, reflect: 'Which chore should we always do together?' },
      { key: 't_home_3', title: 'Alone, together', learn: 'Relationships go better when each of you feels free to be yourself, and that includes time on your own.', source: 'Patrick et al., 2007', do: { text: 'Each say how much alone time you need in a week.' }, reflect: 'What does a good night in, alone, look like for you?' },
      { key: 't_home_4', title: 'A ritual of your own', learn: 'Small shared rituals build a sense of “us” and a home that feels like yours.', source: 'Fiese et al., 2002', do: { text: 'Choose one small ritual for home: Sunday pancakes, a goodnight song, anything.' }, reflect: 'A ritual from your family you want to keep:' },
      { key: 't_home_5', title: 'The things that stay', learn: 'Most of what couples argue about never fully goes away. What matters is talking about it kindly, and with humor.', source: 'Gottman, 1999', do: { text: 'Each name one habit of yours that might drive the other a little mad.' }, reflect: 'One thing you’ll happily let slide:' },
    ],
  },
  {
    key: 'family', title: 'Our people', emoji: '👪', color: '#8b5cc4', kind: 'branch', care: true,
    blurb: 'Families, friends, and the family you make.',
    stops: [
      { key: 't_family_1', title: 'Where you come from', learn: 'How your family handled feelings often shows up in how you handle them as a couple.', source: 'Gottman, Katz & Hooven, 1996', do: { text: 'Each share one thing your family did that you’d copy, and one you wouldn’t.' }, reflect: 'A family tradition you love:' },
      { key: 't_family_2', title: 'Facing it together', learn: 'Couples who handle outside stress as a team (“our problem”) tend to be more satisfied than couples who handle it alone.', source: 'Falconier et al., 2015', do: { text: 'Plan the next visit or holiday: who, where, and how long.' }, reflect: 'What helps you most at a family gathering?' },
      { key: 't_family_3', title: 'Team us', learn: 'Couples who say “we” more during disagreements handle them better and feel better about the relationship.', source: 'Seider et al., 2009', do: { text: 'Agree on a small signal for “I need a break” at family events.' }, reflect: 'A sentence that makes you feel backed up:' },
      { key: 't_family_4', title: 'Your people, my people', learn: 'When friends and family support a relationship, it’s more likely to last.', source: 'Sprecher & Felmlee, 1992', do: { text: 'Tell each other one person in your life you’d love them to know better.' }, reflect: 'Who in my life do you get along with best?' },
      { key: 't_family_5', title: 'The family we make', learn: 'A shared picture of the future is a big part of what keeps couples committed.', source: 'Stanley, Rhoades & Whitton, 2010', do: { text: 'Talk about what family looks like for you in ten years, whatever that means to you.' }, reflect: 'What do you want our home to feel like?' },
    ],
  },
  {
    key: 'new', title: 'Adventure', emoji: '🧭', color: '#8b5cc4', kind: 'branch',
    blurb: 'Do new things, together.',
    stops: [
      { key: 'new_1', title: 'Fill the jar', learn: 'Couples who did new, exciting things together felt better about the relationship than couples who did pleasant, familiar things.', source: 'Aron et al., 2000', do: { text: 'Add three ideas to the Jar.', href: '/games/jar', label: 'Open the Jar' }, reflect: 'The one you secretly hope gets drawn:' },
      { key: 'new_2', title: 'Draw and do', learn: 'Picking by chance takes the deciding out of it, and something new is the point.', source: 'An idea built on Aron et al., 2000', do: { text: 'Draw from the Jar and pick a day.', href: '/games/jar', label: 'Open the Jar' }, reflect: 'When will you do it?' },
      { key: 'new_3', title: 'Someday', learn: 'Shared goals give a relationship a direction. Write the big ones down so they don’t stay “one day”.', source: 'Self-expansion theory (Aron & Aron)', do: { text: 'Add a dream to Someday.', href: '/bucket-list', label: 'Open Someday' }, reflect: 'The one you want to do first:' },
      { key: 'new_4', title: 'Make it a memory', learn: 'Savoring, reliving a good moment together, makes it count twice.', source: 'Bryant & Veroff, 2007', do: { text: 'Add a memory from something new you did.', href: '/memories/new', label: 'Add a memory' }, reflect: 'Why does this one matter?' },
    ],
  },
]

export const ALL_STOPS = ROUTES.flatMap(r => r.stops.map((s, i) => ({ ...s, route: r, index: i })))
export const stopByKey = (key: string) => ALL_STOPS.find(s => s.key === key) ?? null
export const routeByKey = (key: string) => ROUTES.find(r => r.key === key) ?? null

/** Old Trails progress (trail_progress: trail_key + day) lives on as stops. */
export function stopKeyForTrailDay(trailKey: string, day: number): string | null {
  // "Cool down first" was the same lesson as "The pause button".
  if (trailKey === 'repair' && day === 1) return 'repair_2'
  const key = `t_${trailKey}_${day}`
  return stopByKey(key) ? key : null
}

/** Fill in a partner's name. */
export const withName = (s: string, name: string) => s.replaceAll('{p}', name)

// ── Who's done what ──

export type Done = Map<string, Set<string>> // stop key → user ids who finished it

/** Stops a person has finished in a route, and where they are. */
export function routeState(route: Route, done: Done, me: string, partner: string) {
  const mine = route.stops.filter(s => done.get(s.key)?.has(me)).length
  const both = route.stops.filter(s => done.get(s.key)?.has(me) && done.get(s.key)?.has(partner)).length
  // Your next stop: the first one you haven't finished (stops go in order for each of you).
  const next = route.stops.find(s => !done.get(s.key)?.has(me)) ?? null
  const started = route.stops.some(s => done.get(s.key)?.size)
  return { mine, both, total: route.stops.length, next, started, finished: both === route.stops.length }
}

// ── Plus ──
// Base camp and repair are always free. Of the other branches, the first one
// you two start is free in full; Plus opens the rest. Never a paywall halfway
// through a branch you started for free.

/** `firstDoneAt`: for each route, the earliest time either of you finished a stop in it. */
export function freeBranch(firstDoneAt: Map<string, number>): string | null {
  let best: string | null = null
  for (const r of ROUTES) {
    if (r.kind !== 'branch' || r.free) continue
    const t = firstDoneAt.get(r.key)
    if (t === undefined) continue
    if (best === null || t < firstDoneAt.get(best)!) best = r.key
  }
  return best
}

/** Can this couple open this route without Plus? */
export function routeIsFree(route: Route, firstDoneAt: Map<string, number>): boolean {
  if (route.kind === 'base' || route.free) return true
  const chosen = freeBranch(firstDoneAt)
  return chosen === null || chosen === route.key
}

/** For Home: the route you're partway along (map order), and your next stop on it. */
export function nextOnMap(done: Done, me: string, partner: string, isOpen: (r: Route) => boolean) {
  for (const route of ROUTES) {
    if (!isOpen(route)) continue
    const st = routeState(route, done, me, partner)
    if (st.mine > 0 && st.next) return { route, stop: st.next, n: route.stops.indexOf(st.next) + 1, of: route.stops.length }
  }
  return null
}

/** Has either of you finished any stop yet? */
export const mapStarted = (done: Done) => [...done.values()].some(s => s.size > 0)

// ── Opening a hard-topic route together ──
// Fighting fair, Money talk and Our people (care: true) open only once one of
// you suggests it and the other says yes. A route you've already walked part
// of stays open (progress from before this rule counts as a yes).

export type Agreement = { proposed_by: string; accepted_by: string | null }
export type Access = 'open' | 'plus' | 'suggest' | 'you-suggested' | 'they-suggested'

export function routeAccess(route: Route, o: {
  me: string
  plus: boolean
  firstDoneAt: Map<string, number>
  agreement: Agreement | undefined
}): Access {
  if (!o.plus && !routeIsFree(route, o.firstDoneAt)) return 'plus'
  if (!route.care || o.firstDoneAt.has(route.key) || o.agreement?.accepted_by) return 'open'
  if (!o.agreement) return 'suggest'
  return o.agreement.proposed_by === o.me ? 'you-suggested' : 'they-suggested'
}
