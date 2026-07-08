# Hiranda — Study Section, Presence Cards & Nav Redesign

Brainstorm / design doc. Three connected ideas:

1. A **Study section** — shared tools to actually study/brainstorm together.
2. A **presence sidebar** — two Discord-style profile cards showing who's in
   the section and their live status ("● online").
3. A **smarter, simpler navigation** — replacing today's flat list of 11 links
   by leading with a **Home hub** and demoting the menu to a secondary path.

Nothing here is built yet. This is the plan to react to and carve down.

> **Recommended direction (TL;DR):** don't just reorganize the 11-link menu —
> **lead with a Home hub** and demote the menu to a secondary path. Today the app
> opens straight into Memories; instead `/` should be a warm "our place today"
> screen that surfaces the two things that actually make people reopen Hiranda:
> **partner presence** and **"waiting for you"** signals. The nav problem largely
> dissolves once the hub routes people contextually. Full reasoning in §3; the
> Home sketch is §3.0.

---

## Where we're starting from

- Nav today is **10 flat links** in a left sidebar (desktop) / hamburger drawer
  (mobile): Memories, Journal, Todos, Bucket List, Dates, Watch, Watchlist,
  Library, Music, Games. Adding Study makes **11** — the flat list is already
  past the point where it reads as "simple."
- We already have the pieces this builds on:
  - `profiles` has `display_name`, `avatar_url`, `username`, **`bio`**, and
    **`status_text`** — the last two are unused and are exactly what a
    Discord-style card wants.
  - Supabase **Realtime** is already in the stack (used by Watch). Realtime
    **Presence** is a separate channel API — good for "who's online" without
    touching the playback-sync code.
  - The **games** engine is async answer-&-reveal (question / would-you-rather
    / this-or-that). Study quizzing can reuse this shape.
  - There's an **epub/PDF reader** (epub.js) and Library already.
  - `SpotifyStatus` in the sidebar is a precedent for a live status chip.

---

## 1. Study section

**Vibe check:** keep it in Hiranda's spirit — "not a project manager, just a
fridge list." Warm, simple, two-people-focused. Study *together*, not a full
LMS. Proposed tools, ranked by how well they fit and how cheap they are:

| Tool | What it is | Build cost | Notes |
|---|---|---|---|
| **Focus timer (shared)** | A Pomodoro both people see in sync — start/pause mirrored, "studying since 3:40". | Low–med | Simplest realtime; a light cousin of Watch sync but its own code (not the playback scripts). Pairs naturally with presence status "studying." |
| **Flashcard decks** | Shared decks, flip cards, spaced-repetition scheduling per person (each keeps their own progress, like book reading position). | Med | Highest "study" value. Reuses the per-user-progress pattern Library already uses. |
| **Quiz each other** | Turn a deck into a game: I answer, you see how I did, reveal. | Low if it reuses games engine | Bridges Study ↔ Games. |
| **Brainstorm canvas / notes** | A shared markdown scratchpad per topic — jot, outline, think out loud together. | Low–med | This is the literal "brainstorm with me" surface. Start as collaborative notes; a freeform canvas is a later upgrade. |
| **Resource stash** | Save links + PDFs to study from; PDF opens in the existing reader. | Low | Library already handles files; this is a lighter, study-scoped bin. |
| **Study goals / streak** | Lightweight targets ("30 min/day"), a streak counter. | Low | Todos-style, keeps it motivating without being a task manager. |
| **AI study buddy** | A "brainstorm / explain / quiz me" assistant in the canvas. | Med | Powered by the Claude API (Anthropic) server-side — default to the latest model (e.g. `claude-fable-5`); keep the API key server-only, never in the client. This is the strongest answer to "brainstorm with me" but it's the one net-new dependency + a per-use cost, so it's optional/phase-2. |

**Suggested first cut:** Focus timer + Brainstorm notes + Flashcards. That's a
complete, coherent "study together" loop (focus → capture → review) without the
AI dependency. Layer Quiz (reuses games) and the AI buddy after.

---

## 2. Presence sidebar — the "double stack" Discord cards

The star of the request: a right-hand rail in the Study section showing **two
stacked profile cards** — one per partner — each looking like a Discord profile,
with a live status dot.

```
┌─ STUDY ──────────────────────┬─── IN THIS SESSION ───┐
│                              │  ╭───────────────────╮ │
│   ┌───────────────────────┐  │  │▓▓▓▓ banner ▓▓▓▓▓▓▓│ │
│   │  Focus timer  24:12   │  │  │ (◕)  Hudson       │ │
│   │  ▶ studying together  │  │  │      @hudson      │ │
│   └───────────────────────┘  │  │  ● online         │ │
│                              │  │  “grinding chem”  │ │
│   ┌───────────────────────┐  │  ╰───────────────────╯ │
│   │  Brainstorm notes     │  │  ╭───────────────────╮ │
│   │  …shared scratchpad…  │  │  │▓▓▓▓ banner ▓▓▓▓▓▓▓│ │
│   │                       │  │  │ (◕)  Sam          │ │
│   └───────────────────────┘  │  │      @sam         │ │
│                              │  │  ○ away · 5m      │ │
│                              │  ╰───────────────────╯ │
└──────────────────────────────┴───────────────────────┘
```

**Card anatomy (Discord-style):**
- Banner strip (a per-user color/gradient now; uploadable banner image later —
  the `avatars` bucket pattern extends cleanly to a `banners` one).
- Avatar overlapping the banner edge, display name, `@username`.
- **Status dot + label:** ● online / ◐ idle / ○ offline, derived from Realtime
  Presence, plus a "last seen 5m" when away.
- Custom status line from `status_text` ("grinding chem") — already a column.
- Optional "activity" line: what they're doing in-app ("studying", "watching
  Dune") — a nice-to-have that mirrors Discord's "Playing…".

**How presence works (no playback-sync involvement):**
- Use Supabase Realtime **Presence** on a per-couple channel. Each client
  `track()`s itself on mount and heartbeats; the card reads the channel's
  presence state to flip the dots. Idle after N minutes of no focus, offline on
  disconnect. This is its own module — it does **not** touch the Watch/party
  sync scripts.

**Scope question:** presence cards live only in Study, or as an app-wide rail
(always see if your partner's around)? App-wide is more "Discord," but bigger.
Recommendation: **ship in Study first**, promote app-wide if it feels good.

---

## 3. Navigation redesign — smarter, trendier, simpler

### 3.0 The big idea: lead with a Home hub *(recommended)*

The best fix isn't organizing 11 links better — it's making the menu **matter
less**. Today `/` opens into Memories, wasting the front door. Hiranda isn't a
get-in-get-out utility (Home/Search/Cart); it's "drop in and see what's
happening with *us*." That's a browse/discovery shape, and a **Home hub** serves
it far better than a tidier menu — and it puts the real engagement engine
(presence + "your turn") literally at the front door, with zero dark patterns.

Once the hub routes people contextually, you no longer need to perfectly bucket
11 destinations: the menu becomes the "I specifically want the Library" path,
not the main way you move around.

**What the hub surfaces (priority order):**
1. **Presence** — the two Discord-style cards up top ("● Sam is online"). The
   single most *wanted* signal in a couples app.
2. **Together status** — couple timer + shared streak ("1,204 days · 🔥 6-day
   streak").
3. **Waiting for you** — the hook loop: your turn in a game, a prompt they
   answered, a journal entry they just wrote. Finite, honest, about the two of you.
4. **Coming up** — next date countdown, "continue watching," today's prompt.
5. **Jump in** — quick tiles into the deeper features (Memories, Study, Library…).

#### Home sketch — mobile

```
┌───────────────────────────┐
│  our place · Tuesday        │
│                             │
│ ╭──────────╮ ╭──────────╮  │  ← presence "double stack",
│ │▓ banner ▓│ │▓ banner ▓│  │     side-by-side on mobile
│ │(◕) Hudson│ │(◕)  Sam  │  │
│ │ ● online │ │ ○ away 5m│  │
│ ╰──────────╯ ╰──────────╯  │
│                             │
│   ♥ 1,204 days · 🔥 6-day   │  ← together timer + shared streak
│                             │
│ ── waiting for you ───────  │
│ ┌─────────────────────────┐ │
│ │ ◎ Sam answered — your    │ │  ← the hook loop
│ │   turn in This or That → │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ✎ Sam wrote a journal    │ │
│ │   entry · 2h ago       → │ │
│ └─────────────────────────┘ │
│                             │
│ ── coming up ────────────── │
│ ┌───────────┐ ┌───────────┐ │
│ │Anniversary│ │ ▶ Continue│ │
│ │  in 23d   │ │   "Dune"  │ │
│ └───────────┘ └───────────┘ │
│                             │
│ ── jump in ──────────────── │
│ [Memories] [Study] [Library]│
└───────────────────────────┘
 [⌂ Home][♥ Together][▷ Watch][✎ Play][•••]   ← bottom tab bar
    ●=presence dot            ↑ "•••"=More
```

#### Home sketch — desktop (rail + hub + presence rail)

```
┌─────────┬───────────────────────────────┬──────────────┐
│ Hiranda │  our place · Tuesday morning   │  ╭─────────╮ │
│         │                                │  │▓ banner ▓│ │
│ ⌂ Home ●│  ♥ 1,204 days · 🔥 6-day streak │  │(◕) Hudson│ │
│         │                                │  │ ● online │ │
│ TOGETHER│  ── waiting for you ──          │  │ "chem :("│ │
│ ·Memories③  ┌────────────────────────┐    │  ╰─────────╯ │
│ ·Journal①  │ ◎ your turn — This/That │    │  ╭─────────╮ │
│ ·Dates   │  │ ✎ Sam wrote a journal   │    │  │▓ banner ▓│ │
│ PLAN     │  └────────────────────────┘    │  │(◕)  Sam  │ │
│ ·Todos   │  ── coming up ──               │  │ ○ away 5m│ │
│ ·Bucket  │  [Anniversary 23d] [▶ Dune]    │  ╰─────────╯ │
│ WATCH…   │  ── jump in ──                 │              │
│ PLAY     │  [Memories][Study][Library]    │  (presence = │
│ ·Games①  │                                │   the "double│
│ ·Study   │                                │   stack")    │
└─────────┴───────────────────────────────┴──────────────┘
  ↑ grouped rail: Home pinned + presence dot; "waiting" badges on groups
```

Note the two live nav signals from §3's engagement notes are baked in: the
**presence dot** on Home, and **"waiting for you" badges** on groups (Memories③,
Journal①, Games①). Those, not a feed, are what pull people back.

**Tradeoff (honest):** a hub is more work than reshuffling a menu — it needs a
little curation logic and it leans on presence + badges existing. So it flips
the build order: **presence and the "your turn" signals become prerequisites for
the hub**, not follow-ons. If you want a better nav *this week*, plain Option A
below ships faster; the hub is the bigger bet for stickiness.

The options below (A/B/C) still describe the **secondary** nav that sits under
the hub — grouping matters less now, but we still pick one.

---

### The menu underneath the hub

11 flat links is the actual problem. Group them so the eye lands fast, and give
mobile a modern bar instead of a hamburger. Three directions:

### What the research says (July 2026)

**Mobile — bottom tab bar beats the hamburger, decisively.**
- Tab bars showed ~**40% faster task completion** vs. hamburger menus; NN/g
  found hidden menus **drop task completion ~21%**. "Out of sight, out of mind":
  if a feature isn't visible, users assume it doesn't exist — a hamburger hides
  every feature behind one tap.
- Sweet spot is **3–5 tabs**, always **icon + short label**, ≥44px targets,
  thumb-reachable at the bottom. Hamburger/drawer is fine only for *secondary*
  stuff (settings, sign out).
- 2026 trend is the "invisible interface" — chrome recedes, content leads.

**Desktop — grouped, collapsible sidebar (+ optional ⌘K).**
- Keep **5–7 top-level items max**; group/nest the rest. This is the
  Notion / Slack / Linear pattern (and what shadcn/ui's Sidebar bakes in).
- Pair the sidebar with a **command palette (⌘K)** for "multimodal" nav:
  beginners ignore it, power users build muscle memory. Turns intent into action
  without the click-through.

Our 11 flat links violate both guidelines at once (too many, all flat, hidden
behind a hamburger on mobile). Grouping + a bottom bar is the fix the evidence
points straight at.

### Option A — Grouped sidebar + mobile bottom tabs *(recommended — matches the research)*
Collapse 11 links into ~4 labeled groups on desktop; on mobile, a bottom tab
bar of the 4 groups (thumb-reachable, the current standard — beats a hamburger).

```
 DESKTOP rail            MOBILE (bottom bar)
 ─────────────           ────────────────────
 Hiranda
   TOGETHER              ┌──────────────────┐
   · Memories            │   page content   │
   · Journal             │                  │
   · Dates               └──────────────────┘
   PLAN                  [♥ Together][◎ Plan]
   · Todos               [▷ Watch ][✎ Study ]
   · Bucket List
   WATCH & READ
   · Watch · Watchlist
   · Library · Music
   PLAY & LEARN
   · Games · Study
```
Groups (strawman): **Together** (Memories, Journal, Dates) · **Plan** (Todos,
Bucket List) · **Watch & Read** (Watch, Watchlist, Library, Music) · **Play &
Learn** (Games, Study). Naming/buckets are up for grabs.

### Option B — Icon rail + Command palette (⌘K)
Skinny always-collapsed icon rail (expands on hover), plus a `⌘K` palette to jump
anywhere by typing. Very "power-user / trendy," but the palette is the primary
way to navigate, which can hide features from casual use.

### Option C — Floating dock / pill
A centered floating pill (mobile) / dock that holds the top destinations, rest
behind a "more." Slick, but awkward once you have 11 places to reach.

**Recommendation:** **A**, optionally with **B's ⌘K palette layered on top** as
an accelerator. A fixes the real problem (grouping + mobile), and a command
palette is a cheap, trendy bonus once routes are grouped.

### What makes it *addicting* — and why ours is different

The generic engagement playbook is the **Hook Model** (Trigger → Action →
Reward → Investment) plus infinite scroll, streaks + loss aversion (Duolingo),
badges, and social-validation pings. That's tuned for **solo apps farming a
lone user's attention** — and much of it is a dark pattern (Duolingo's own
streak became "guilt-based retention": people open it *only* so they don't lose
the number). We should not bolt infinite scroll onto a couples app.

For a **two-person** app the pull isn't a feed — **it's the other person.** The
hooks that fit Hiranda and route straight through the nav:

- **Partner presence = the trigger.** "● Sam is online" is the strongest, most
  *wanted* signal a couples app can show — social validation you actually want,
  not manufactured urgency. The presence cards (§2) are the engagement engine;
  surface a small presence dot **in the nav itself** so it's visible from every
  screen.
- **Shared streaks, not solo guilt.** A streak you keep *together* (a daily
  prompt both answer, a study session, a memory added) reframes loss aversion as
  **teamwork** instead of guilt — you're doing it *with* them, not avoiding
  letting a mascot down. Healthier and stickier.
- **Asymmetric "your turn" loops.** The games engine already does answer →
  partner answers → reveal. "They replied, go look" is a clean, non-dark Hook
  loop. A nav **badge** ("Games ①", "Journal ①") on the waiting group is the
  honest version of a notification dot.
- **Immediate warm feedback.** Keep the small delights (match "🎉", the couple
  timer ticking) — instant reward, no manipulation.

**Nav implications:** the grouped nav should carry two live signals from day
one — a **presence indicator** (partner online) and **per-group "waiting for
you" badges**. Those two, not a feed, are what make people reopen Hiranda.

---

## Open questions (for you)

1. **Study tools for v1** — go with Focus timer + Brainstorm notes + Flashcards,
   or a different three? Want the AI study buddy in v1 or later?
2. **Presence scope** — Study-only rail, or app-wide "is my partner around"?
3. **Nav grouping** — do the four buckets (Together / Plan / Watch & Read / Play
   & Learn) feel right, or regroup? Keep it 2-people-only or is this where the
   friends/groups direction shows up (more than two presence cards)?
4. **Banners** — per-user color now, uploadable banner images later — worth a
   `banners` storage bucket, or skip images for now?
5. **Command palette (⌘K)** — want it, or keep it to the grouped nav?

---

## Rough build order (once decisions land)

Hub-first flips the order — presence + "your turn" signals are now prerequisites
for the Home hub, not follow-ons:

1. **Secondary nav** — regroup the 11 links + mobile bottom bar. Cheap, ships
   value immediately, and gives the hub something to sit on top of.
2. **Presence module** (Realtime Presence) + the two Discord-style cards. This is
   the engagement engine and a hub prerequisite.
3. **"Waiting for you" signals** — per-group badges + the data behind them
   (your-turn game, unread journal/prompt).
4. **Home hub at `/`** — assembles presence + streak + waiting + coming-up +
   jump-in. Move Memories to `/memories`.
5. **Study section** shell + Focus timer (first realtime study surface).
6. Brainstorm notes → Flashcards → Quiz (reuses games engine).
7. Optional: AI study buddy, ⌘K palette, uploadable banners.

> If you'd rather ship a nav win *this week* and defer the hub: do step 1 alone
> (Option A grouped nav), then come back for 2→4.
