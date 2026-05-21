# Hiranda Extension — Phase 9: Feature Parity + Beyond

Research compiled from Teleparty feature set. Each chunk is sized for one focused Claude session.

---

## What Teleparty Has (full feature inventory)

### Free tier
- Synchronized playback (NTP clock offset, host authority) ✅ **done**
- Group chat — real-time text messages alongside the video
- User icons — choose from preset avatar icons per session
- Nicknames — display name per session
- Emoji reactions — float over the video
- Host controls — host controls play/pause/seek ✅ **done**
- 9 streaming services ✅ **done**
- Buffering freeze/resume ✅ **done**

### Premium tier
- Video chat (in-extension PiP while watching)
- Custom reaction packs
- Chat badges for premium users
- 23+ streaming services (Crunchyroll, Peacock, ESPN+, etc.)
- Android app
- iOS app

### Features we've confirmed exist but Teleparty doesn't:
- Persistent session history in DB ✅ Hiranda already has this
- Partner profile + avatar from Hiranda account ✅ already has this
- TMDB poster auto-lookup ✅ already has this
- Couple-only (2-person) — Teleparty supports up to 1000; ours is intentionally couple-focused

---

## Phase 9 Chunks

### Chunk A — In-video chat overlay (highest impact)
**What:** Inject a floating chat panel into the streaming page. Partner messages appear while you watch without switching tabs.

Files touched: new `src/content/chat-overlay.js`, `src/content/chat-overlay.css`, `manifest.json`, `service-worker.js`

Tasks:
- [ ] Broadcast chat messages via Supabase channel (`event: 'chat'`) from SW
- [ ] Inject overlay DOM into page: fixed right side, semi-transparent, toggle with hotkey
- [ ] Display last 20 messages with sender label (You / Partner)
- [ ] Chat input at bottom of overlay — Enter to send
- [ ] Auto-scroll to newest message
- [ ] Fade out overlay when inactive (3s), return on hover or message
- [ ] Add overlay scripts to each platform in manifest

### Chunk B — Emoji reactions on screen
**What:** Click a reaction in the popup or overlay → emoji floats up the screen for both partners.

Files touched: `service-worker.js`, `chat-overlay.js`, new reaction broadcast event

Tasks:
- [ ] Add reaction row to overlay (6 preset emojis: ❤️ 😂 😮 😭 🔥 👏)
- [ ] Broadcast `event: 'reaction'` with `{emoji, from}` via Supabase channel
- [ ] On receive: inject floating emoji that animates up and fades — CSS keyframe
- [ ] Multiple simultaneous reactions supported (don't block)

### Chunk C — Partner presence in overlay
**What:** Show partner's username + avatar in the overlay header. System messages on join/leave.

Files touched: `service-worker.js`, `chat-overlay.js`

Tasks:
- [ ] On channel join: broadcast `event: 'presence'` with `{userId, username, avatarUrl}`
- [ ] Store partner presence in SW state
- [ ] Overlay header: "Watching with [Partner]" + their avatar
- [ ] System message when partner joins ("Partner joined") or leaves ("Partner left")
- [ ] Fetch username/avatarUrl from `profiles` table on session start

### Chunk D — Popup chat (fallback for non-overlay pages)
**What:** Basic chat in the extension popup for when the overlay isn't available.

Files touched: `popup.js`, `popup.css`, `service-worker.js`

Tasks:
- [ ] Add chat panel to party view in popup
- [ ] Show last 10 messages
- [ ] Text input at bottom, send on Enter
- [ ] Badge on extension icon when new message received (not viewed)
- [ ] `chrome.action.setBadgeText` for unread count

### Chunk E — Session timer + activity in overlay
**What:** Show how long you've been watching + a subtle "Partner is watching" indicator.

Files touched: `chat-overlay.js`

Tasks:
- [ ] Display elapsed session time (from `created_at` on session record)
- [ ] Heartbeat-driven "Partner is watching" / "Partner inactive" status dot
- [ ] Gray out dot if no heartbeat received in 15s

### Chunk F — Deep link join from Hiranda web app
**What:** `/party/[sessionId]` on the Hiranda site opens the extension popup with the session ID pre-filled.

Files touched: new Next.js page `src/app/party/[sessionId]/page.tsx`

Tasks:
- [ ] Party page: show session poster, title, platform
- [ ] "Open in Extension" button → custom protocol or clipboard copy of sessionId
- [ ] If extension not installed: link to Chrome Web Store
- [ ] If already in party: show "You're already in this party"

### Chunk G — Additional streaming services
**What:** Add content scripts for Crunchyroll, Peacock, Tubi (free, high-value).

Files touched: `manifest.json`, new `src/content/crunchyroll.js`, `peacock.js`, `tubi.js`

Tasks:
- [ ] Crunchyroll: `crunchyroll.com/watch/*` — standard video element
- [ ] Peacock: `peacocktv.com/watch/*` — standard video element
- [ ] Tubi: `tubitv.com/movies/*` and `/tv-shows/*` — standard video element
- [ ] Update popup `detectPlatform` and `PLATFORM_LABELS`

---

## Recommended order

1. **Chunk A** (overlay chat) — this is what makes the product feel alive
2. **Chunk B** (reactions) — instant delight, small addition on top of A
3. **Chunk C** (presence) — completes the social feel of the overlay
4. **Chunk D** (popup chat badge) — polish, low effort
5. **Chunk G** (more platforms) — each service is ~10 lines
6. **Chunk E** (session timer) — nice to have
7. **Chunk F** (deep link page) — requires Next.js work, separate effort

---

## Architecture note: chat channel

Chat messages piggyback on the existing `watch:{sessionId}` Supabase Realtime channel, just with `event: 'chat'` instead of `event: 'sync'`. No new channels needed.

```js
// Send
channel.send({ type: 'broadcast', event: 'chat', payload: { text, from, username, ts: Date.now() } })

// Receive (in existing .on() chain)
.on('broadcast', { event: 'chat' }, ({ payload }) => {
  // forward to overlay via chrome.tabs.sendMessage
})
```

SW forwards chat messages to the active tab via a new `CHAT_MESSAGE` message type. The overlay handles display.
