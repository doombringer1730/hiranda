# Hiranda — Vision Document

A private shared space for two people. A place to keep memories, track what matters, plan what's next, and hold onto the small things that add up to something big.

---

## Purpose

Hiranda is a personal web app built for a couple. It's not a social network — it's a shared home on the internet. Quiet, warm, and just for them.

---

## Core Features

### 1. Memories & Journal Entries
- Create entries together (or solo) capturing a moment, a feeling, a day
- Each memory can have a photo album attached
- Entries can be tagged (e.g. "date night", "travel", "silly")
- Browsable by date or tag

### 2. Photo Albums
- Photos live inside memory entries — not a standalone feed
- Multiple photos per memory, lightbox view
- Simple upload, no over-engineering

### 3. Dates & Anniversaries
- Track important dates (anniversary, first date, birthdays, etc.)
- Countdown display — days until next occurrence
- Optional: a small note or memory linked to the date

### 4. To-Do / Chore List
- Shared task list — both can add, check off, and delete
- Optionally assign tasks to one person
- Lightweight — not a project manager, just a fridge list

### 5. Watch Together
- Upload a movie/video to the app
- Both users watch it in sync — play, pause, and seek are mirrored in real time
- Uses Supabase Realtime to broadcast playback state
- Private storage — videos not publicly accessible
- Simple UI: video player + who's watching indicator

### 6. Book Library
- Upload EPUB files to a shared library
- Grid view styled like Apple Books — cover art, title, author
- In-app EPUB reader powered by epub.js
- Reading progress saved per user — you each keep your own place in a book
- Optional cover image upload per book

### 7. Bucket List / Goals
- Things to do together, someday
- Mark as done (and optionally link to a memory when completed)
- Categories: travel, food, experiences, etc.

---

## Authentication & Access

> **Decision deferred.** To be designed in a later phase.

Current thinking:
- Users must create a session (no anonymous access)
- A shareable invite link to bring the other person in
- Only the two of them can access the space
- No public pages, no external sign-ups

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | Full-stack, great DX, Vercel native |
| Database & Auth | Supabase | Auth, Postgres DB, and file storage in one |
| File Storage | Supabase Storage | For photo uploads |
| Hosting | Vercel | Free tier, auto-deploys from GitHub |
| Styling | Tailwind CSS | Utility-first, easy to theme |

---

## UI & Design Direction

**Vibe: Jazz coffee shop**

Think a late-night café — warm amber light, dark wood, soft and unhurried. The UI should feel like a place you'd want to sit in for hours.

- Colour palette: deep browns, warm ambers, off-whites, muted gold accents
- Typography: serif or slab-serif for headings (e.g. Playfair Display, Lora), clean sans for body
- Texture: subtle grain or paper texture on backgrounds
- Interactions: slow, smooth transitions — nothing snappy or loud
- Dark-leaning but not harsh — warm dark, not cold dark
- Rounded corners, generous padding, intimate spacing

---

## Phase Rules

> **We do not move to the next phase until explicitly told to.**
> Each phase is completed, reviewed, and signed off before any work begins on the next.

---

## Build Phases

### Phase 1 — Foundation ✓
- [x] Scaffold Next.js project
- [x] Set up Supabase (DB + storage)
- [x] Deploy skeleton to Vercel
- [x] Define DB schema for all core features

### Phase 2 — Core Features
- [x] Memories + journal entries (CRUD)
- [x] Photo upload + album view per memory
- [x] To-do list (shared, real-time)
- [x] Bucket list
- [x] Watch Together (synchronized video playback via Supabase Realtime)
- [ ] Book Library (EPUB upload, Apple Books-style grid, in-app reader, per-user progress)

### Phase 3 — Dates & Countdowns
- [ ] Anniversary / important dates tracker
- [ ] Countdown logic + display

### Phase 4 — Auth & Access
- [ ] Session-based authentication
- [ ] Invite link flow
- [ ] Access control (only the two of them)

### Phase 5 — Polish
- [ ] Full design pass with jazz coffee shop theme
- [ ] Mobile responsiveness
- [ ] Animations & transitions
- [ ] Performance & image optimisation

---

## Name

**Hiranda** — the name of the app and the space itself.

---

*Last updated: 2026-05-17*
