# Hiranda Final Phase — Watch Party Extension

## Vision

Turn Hiranda into the watch-party platform built for couples. The extension hooks into every major streaming service (Netflix, Hulu, Disney+, Prime, Max, YouTube) and syncs playback through the same Supabase realtime channel already powering the existing watch player. Chat, emotes, presence — all native to Hiranda. No third-party dependency. No Teleparty tax.

This is the headliner. It's what someone pays for.

---

## What We're Building

1. **Hiranda Party** — a Chrome/Firefox extension that hijacks the video element on streaming sites and pipes play/pause/seek events into a Supabase realtime channel
2. **Party sessions** — a new session type in Hiranda (`source_type: 'party'`) that the extension creates; the web app shows sync status, chat, and emotes as a side panel
3. **Invite flow** — one person starts a party from the extension popup, gets a Hiranda link, partner opens it and joins; both sync automatically
4. **Hiranda web** gets a party session page: minimal UI, just chat + emotes + who's watching + "now playing on Netflix" badge

---

## How the Sync Works Today (reference)

The existing player at `watch/:id` already has everything needed:

- **Supabase Realtime channel** `watch:{sessionId}` — broadcast events
- **Event shape:**
  ```json
  {
    "kind": "action" | "heartbeat",
    "state": "playing" | "paused",
    "position": 142.3,
    "from": "user-uuid"
  }
  ```
- **Heartbeat** every 1s keeps partners in sync passively
- **Action events** fire on play/pause/seek for immediate response
- **Drift correction**: resync if >1s off (action) or >2s off (heartbeat)
- **`applyingRemote` ref** prevents echo loops when applying remote events

The extension becomes a third type of client on this same channel. The protocol doesn't change.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Person A's browser                                             │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │  Netflix tab      │◄───│  Content Script (netflix.js)     │  │
│  │  <video> element  │    │  hooks play/pause/seek           │  │
│  └──────────────────┘    └──────────────┬───────────────────┘  │
│                                          │ postMessage           │
│                           ┌─────────────▼───────────────────┐  │
│                           │  Background Service Worker       │  │
│                           │  Supabase client                 │  │
│                           │  channel: watch:{sessionId}      │  │
│                           └─────────────┬───────────────────┘  │
└─────────────────────────────────────────┼───────────────────────┘
                                          │ Supabase Realtime
┌─────────────────────────────────────────┼───────────────────────┐
│  Person B's browser                     │                       │
│                           ┌─────────────▼───────────────────┐  │
│                           │  Background Service Worker       │  │
│                           └─────────────┬───────────────────┘  │
│                                          │ postMessage           │
│  ┌──────────────────┐    ┌──────────────▼───────────────────┐  │
│  │  Netflix tab      │◄───│  Content Script (netflix.js)     │  │
│  │  <video> element  │    │  applies play/pause/seek         │  │
│  └──────────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Both browsers also connect to Hiranda web (party session page)
for chat, emotes, and presence display.
```

---

## DB Schema Changes

### `watch_sessions` — two new columns

```sql
ALTER TABLE watch_sessions
  ADD COLUMN platform text,          -- 'netflix' | 'youtube' | 'disney' | 'prime' | 'max' | 'hulu' | 'appletv' | 'paramount'
  ADD COLUMN party_url   text;       -- the URL on Person A's tab when party started (for display only, not streamed)
```

`source_type = 'party'` — no `storage_path`, no `source_url` used for video. The extension streams from the native player, not Hiranda.

### `watch_sessions` insert for a party session

```json
{
  "title": "Inception",
  "source_type": "party",
  "platform": "netflix",
  "party_url": "https://www.netflix.com/watch/60023642",
  "thumbnail_url": "https://image.tmdb.org/t/p/w500/...",
  "created_by": "user-uuid"
}
```

No migration needed for `source_type` — it's already `text`. Just add `platform` and `party_url`.

---

## Extension File Structure

```
hiranda-extension/
├── manifest.json
├── background/
│   └── service-worker.js       — Supabase client, channel mgmt, auth token relay
├── content/
│   ├── base.js                 — shared: find video, hook events, postMessage bridge
│   ├── netflix.js              — Netflix-specific selectors + player quirks
│   ├── youtube.js
│   ├── disney.js
│   ├── prime.js
│   ├── max.js
│   ├── hulu.js
│   ├── appletv.js
│   └── paramount.js
├── popup/
│   ├── popup.html
│   ├── popup.js                — create/join party, show sync status
│   └── popup.css
└── icons/
    ├── 16.png
    ├── 48.png
    └── 128.png
```

---

## Extension: manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "Hiranda Party",
  "version": "1.0.0",
  "description": "Watch together on Netflix, YouTube, Disney+, and more.",
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.youtube.com/*",
    "https://www.disneyplus.com/*",
    "https://www.amazon.com/*",
    "https://www.primevideo.com/*",
    "https://play.max.com/*",
    "https://www.hulu.com/*",
    "https://tv.apple.com/*",
    "https://www.paramountplus.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/watch/*"],
      "js": ["content/base.js", "content/netflix.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.youtube.com/watch*"],
      "js": ["content/base.js", "content/youtube.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.disneyplus.com/*"],
      "js": ["content/base.js", "content/disney.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.amazon.com/*/dp/*", "https://www.primevideo.com/*"],
      "js": ["content/base.js", "content/prime.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://play.max.com/*"],
      "js": ["content/base.js", "content/max.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.hulu.com/watch/*"],
      "js": ["content/base.js", "content/hulu.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://tv.apple.com/*"],
      "js": ["content/base.js", "content/appletv.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.paramountplus.com/*"],
      "js": ["content/base.js", "content/paramount.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    }
  }
}
```

---

## Extension: content/base.js

Core logic shared by all platforms. Platform scripts call `initHirandaParty(getVideo)` where `getVideo` is a function that returns the `<video>` element for that site.

```js
// Injected by each platform script:
// window.__hirandaGetVideo = () => document.querySelector('video')

let video = null
let sessionId = null
let userId = null
let applyingRemote = false

function findVideo() {
  return typeof window.__hirandaGetVideo === 'function'
    ? window.__hirandaGetVideo()
    : document.querySelector('video')
}

function pushAction(state, position) {
  if (applyingRemote) return
  chrome.runtime.sendMessage({
    type: 'SYNC_ACTION',
    payload: { kind: 'action', state, position }
  })
}

function hookVideo(v) {
  video = v
  v.addEventListener('play',  () => pushAction('playing', v.currentTime))
  v.addEventListener('pause', () => pushAction('paused',  v.currentTime))
  v.addEventListener('seeked', () => {
    if (applyingRemote) { applyingRemote = false; return }
    pushAction(v.paused ? 'paused' : 'playing', v.currentTime)
  })
}

// Apply incoming sync event from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'APPLY_SYNC') return
  if (!video) return
  const { state, position } = msg.payload
  const drift = Math.abs(video.currentTime - position)
  const isAction = msg.payload.kind === 'action'

  if (drift > (isAction ? 1 : 2)) {
    applyingRemote = true
    video.currentTime = position
  }
  if (state === 'playing' && video.paused) {
    applyingRemote = true
    video.play().catch(() => {})
    setTimeout(() => { applyingRemote = false }, 100)
  } else if (state === 'paused' && !video.paused) {
    applyingRemote = true
    video.pause()
    setTimeout(() => { applyingRemote = false }, 100)
  }
})

// Heartbeat: 1s
setInterval(() => {
  if (!video) return
  chrome.runtime.sendMessage({
    type: 'SYNC_ACTION',
    payload: {
      kind: 'heartbeat',
      state: video.paused ? 'paused' : 'playing',
      position: video.currentTime
    }
  })
}, 1000)

// Wait for video element (SPA sites load it async)
function waitForVideo() {
  const v = findVideo()
  if (v) { hookVideo(v); return }
  const obs = new MutationObserver(() => {
    const v2 = findVideo()
    if (v2) { obs.disconnect(); hookVideo(v2) }
  })
  obs.observe(document.body, { childList: true, subtree: true })
}

waitForVideo()
```

---

## Extension: background/service-worker.js

Holds the Supabase realtime connection (persists across tabs). Relays events between content scripts and the channel.

```js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nqmawsssiutarjylnmhg.supabase.co'
const SUPABASE_ANON_KEY = '<anon-key>'

let supabase = null
let channel = null
let currentSessionId = null
let currentUserId = null
let activeTabId = null

async function getSupabase() {
  if (supabase) return supabase
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, storage: chrome.storage.local }
  })
  return supabase
}

async function joinChannel(sessionId, userId) {
  const sb = await getSupabase()
  if (channel) await sb.removeChannel(channel)

  currentSessionId = sessionId
  currentUserId = userId

  channel = sb
    .channel(`watch:${sessionId}`)
    .on('broadcast', { event: 'sync' }, ({ payload }) => {
      if (payload.from === userId) return
      // Forward to the active content script tab
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'APPLY_SYNC', payload })
      }
    })
    .subscribe()
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'SYNC_ACTION') {
    if (!channel || !currentUserId) return
    activeTabId = sender.tab?.id ?? activeTabId
    channel.send({
      type: 'broadcast',
      event: 'sync',
      payload: { ...msg.payload, from: currentUserId }
    })
    // Also persist to DB (heartbeats skipped to reduce writes)
    if (msg.payload.kind === 'action') {
      const sb = await getSupabase()
      await sb.from('watch_sessions').update({
        state: msg.payload.state,
        playback_position_seconds: msg.payload.position,
        last_updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      }).eq('id', currentSessionId)
    }
  }

  if (msg.type === 'JOIN_SESSION') {
    await joinChannel(msg.sessionId, msg.userId)
  }

  if (msg.type === 'CREATE_SESSION') {
    // Create session row and return the ID
    const sb = await getSupabase()
    const { data } = await sb.from('watch_sessions').insert({
      title: msg.title,
      source_type: 'party',
      platform: msg.platform,
      party_url: msg.partyUrl,
      thumbnail_url: msg.thumbnailUrl ?? null,
      created_by: msg.userId,
      storage_path: '',
    }).select().single()

    if (data) {
      await joinChannel(data.id, msg.userId)
      return { sessionId: data.id }
    }
  }
})
```

---

## Extension: popup/popup.html

Minimal, Hiranda-styled popup (dark amber aesthetic to match the app).

**States:**
1. **Not logged in** — "Sign in to Hiranda" button → opens `hiranda.app/login`
2. **Logged in, no active party** — "Start Party" button (only enabled when on a supported streaming site), "Join Party" input
3. **In a party** — shows session title, partner presence dots, "Leave" button

**"Start Party" flow:**
1. Reads page title from the active tab
2. Detects platform from the tab URL
3. Does a quick TMDB search by title for the poster
4. Sends `CREATE_SESSION` to background → gets `sessionId`
5. Shows invite link: `hiranda.app/party/{sessionId}`
6. Copy-to-clipboard button

**"Join Party" flow:**
1. Paste a `hiranda.app/party/{sessionId}` link (or just the ID)
2. Sends `JOIN_SESSION` to background
3. Content script starts applying sync events

---

## Platform-Specific Content Scripts

### netflix.js
```js
window.__hirandaGetVideo = () => document.querySelector('video')
// Netflix loads video async, base.js MutationObserver handles it
// Note: Netflix intercepts keyboard events — don't re-dispatch synthetic events
```

### youtube.js
```js
window.__hirandaGetVideo = () => document.querySelector('video.html5-main-video')
// YouTube's player API is accessible via document.querySelector('.html5-video-player')
// Can use .playVideo() / .pauseVideo() for cleaner control
```

### disney.js
```js
window.__hirandaGetVideo = () => document.querySelector('video')
// Disney+ uses a fairly standard video element
```

### prime.js
```js
window.__hirandaGetVideo = () => document.querySelector('video')
// Prime Video SPA — video element may be in an iframe, test carefully
```

### max.js
```js
window.__hirandaGetVideo = () => document.querySelector('video')
```

### hulu.js
```js
window.__hirandaGetVideo = () => document.querySelector('video')
// Hulu uses a custom player layer on top — may need to trigger native events
```

Each platform script is a thin shim. The heavy lifting is in `base.js`. As platforms update their players, only the shim needs updating.

---

## Hiranda Web: New Routes & Changes

### 1. `/party/[id]` — new page

The web companion to the extension party. Shows:
- Title + platform badge ("Watching on Netflix")
- Thumbnail poster
- Who's connected (presence dots from the realtime channel)
- Chat + emotes (same as existing watch player)
- Partner's playback position indicator
- "Open in extension" nudge if they don't have it

This page does **not** play video — the video is in the streaming service tab. It's the social layer.

### 2. `/watch` session list

Party sessions show up in the list with a platform badge instead of the play button thumbnail:

```
[Netflix icon]  Inception                  Jan 12
[Disney icon]   Encanto                    Dec 30
```

### 3. Extension download page

`/extension` — simple page with Chrome Web Store link, Firefox Add-ons link, and a 3-step "how it works" diagram. Linked from the nav.

### 4. Nav update

Add "Get Extension" link in the sidebar (subtle, for logged-in users who haven't used it).

---

## Supabase Migration

```sql
-- Add party columns to watch_sessions
ALTER TABLE watch_sessions
  ADD COLUMN IF NOT EXISTS platform   text,
  ADD COLUMN IF NOT EXISTS party_url  text;

-- RLS: same couple-membership policies already cover party sessions
-- No changes needed — created_by is still used for access control
```

---

## Auth Bridge: Extension ↔ Hiranda

The extension needs to know who the user is. Two options:

**Option A — Shared cookie (simplest):** If the user is logged into `hiranda.app` in their browser, the Supabase session is in `localStorage` on that origin. The extension can't read another origin's localStorage. So this doesn't work directly.

**Option B — Auth token relay via popup (correct):**
1. Extension popup has a "Sign in" button
2. Opens a `hiranda.app/extension-auth` page in a new tab
3. That page reads the Supabase session and posts the access token to the extension via `chrome.tabs.sendMessage` or URL fragment
4. Extension stores the token in `chrome.storage.local` and uses it for all Supabase calls

**Option C — Dedicated extension login (cleanest UX):**
1. Extension popup has an email/password form
2. Calls Supabase Auth directly from the popup
3. Stores session in `chrome.storage.local`

Option C is cleanest — no tab redirects. The extension is self-contained. Implement option C first, add SSO bridge later.

---

## TMDB Poster Auto-Fetch in Extension

When the user starts a party, the extension:
1. Reads the tab title (e.g., "Inception | Netflix")
2. Strips the platform name: "Inception"
3. Hits TMDB search: `https://api.themoviedb.org/3/search/movie?query=Inception&api_key=...`
4. Takes the first result's `poster_path`
5. Passes `thumbnail_url` to `CREATE_SESSION`

For TV shows, detect episode patterns in the title (e.g., "Ted – Season 2 | Netflix") and use `search/tv` instead.

The TMDB API key is embedded in the extension (same `NEXT_PUBLIC_TMDB_API_KEY`). It's already public-facing in the web app.

---

## Monetization

### Free tier (couple account, always free)
- Watch party for 2 people (just you and your partner)
- All platforms
- Chat + emotes
- Shared watch history

### Paid tier — "Hiranda Plus" (~$4/mo or $30/yr)
- Group parties (3–6 people) — for friend groups / double dates
- Party history with timestamps and chat replay
- Custom emote packs
- Priority support

The couple-of-2 use case is free forever. This keeps the core value prop intact and makes the paid tier an expansion, not a gate.

---

## Build Order / Milestones

### Milestone 1 — Extension skeleton (Week 1)
- [ ] Create `hiranda-extension/` repo (or subfolder)
- [ ] `manifest.json` with all platform host permissions
- [ ] `service-worker.js` with Supabase client + channel join/create
- [ ] `base.js` content script with video hooking + heartbeat
- [ ] `popup.html` with login form (Option C auth)
- [ ] Load unpacked in Chrome, verify Supabase connection

### Milestone 2 — First platform working end-to-end (Week 1–2)
- [ ] YouTube content script (easiest, no DRM)
- [ ] Start a party from popup → creates DB row → gets invite link
- [ ] Partner opens `hiranda.app/party/{id}` → sees sync status
- [ ] Play/pause on one browser syncs to the other
- [ ] Heartbeat drift correction working

### Milestone 3 — Web party page (Week 2)
- [ ] `/party/[id]` route in Hiranda
- [ ] Shows platform badge, poster, partner presence
- [ ] Chat and emotes functional (reuses existing `watch_messages` table + realtime)
- [ ] Party sessions appear in `/watch` session list with platform icons
- [ ] DB migration for `platform` + `party_url` columns

### Milestone 4 — Netflix + Disney+ + Prime (Week 3)
- [ ] Netflix content script — test play/pause/seek sync
- [ ] Disney+ content script
- [ ] Prime Video content script
- [ ] Handle SPA navigation (sites that load video async after route change)
- [ ] TMDB auto-fetch for party session poster

### Milestone 5 — Remaining platforms + polish (Week 4)
- [ ] Max, Hulu, Apple TV+, Paramount+
- [ ] Popup shows partner presence dots live
- [ ] "Leave party" cleanly disconnects channel
- [ ] Handle tab refresh / extension reload gracefully (rejoin from `chrome.storage`)
- [ ] Extension icon badge shows "IN PARTY" when active

### Milestone 6 — Distribution (Week 5)
- [ ] Chrome Web Store developer account ($5 one-time)
- [ ] Prepare store listing: screenshots, description, privacy policy
- [ ] Firefox Add-ons listing (same codebase, minor adjustments)
- [ ] `/extension` page on Hiranda with install links
- [ ] Nav link to extension page

### Milestone 7 — Monetization (future)
- [ ] Stripe integration for Hiranda Plus
- [ ] Group party support (>2 people)
- [ ] Chat replay on party session history page

---

## Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Netflix breaks content script after player update | High (happened to Teleparty 3x) | Thin shim model — only `__hirandaGetVideo` changes; can hotfix in hours |
| Chrome Web Store review rejection | Medium | Clearly describe watch-party use case; no DRM bypass; no piracy |
| Streaming service sends DMCA / C&D | Low | Extension doesn't serve content, just coordinates playback; Teleparty has operated for 5+ years |
| Supabase realtime latency on poor connections | Medium | Heartbeat drift correction already handles this; add ±3s tolerance buffer |
| Extension users not logged into Hiranda | — | Option C popup login eliminates this friction |

---

## Open Questions

1. **Single repo vs monorepo?** Extension could live at `hiranda-extension/` inside the main Hiranda repo, or as a separate repo. Separate is cleaner for Chrome Web Store CI.

2. **Firefox support from day one?** MV3 is mostly compatible. WebExtensions API matches Chrome for the features we use. Low extra effort — ship both.

3. **Party for non-couples?** The group party monetization path implies inviting friends. Does Hiranda's couple model expand here, or is group party a completely separate "friend mode"?

4. **Mobile?** Chrome/Firefox extensions don't run on mobile browsers. Kiwi Browser on Android supports extensions. Safari Web Extensions on iOS are painful. Mobile is a phase 2 concern.

5. **Hiranda branding on the extension?** The popup should feel unmistakably like Hiranda (dark amber aesthetic). Could differentiate from Teleparty's generic look.
