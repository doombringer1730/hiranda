# Teleparty Source Code Research
# Version 5.6.5 — Extracted from CRX (May 2026)

This document is based on direct extraction and analysis of the Teleparty Chrome extension source code.

---

## 1. Extension Architecture

### File structure (key files)
```
manifest.json                         MV3, permissions: activeTab, storage, scripting, alarms
background_service_bundled.js         Service worker (~320KB minified)
content_scripts/{platform}/
  {platform}_content_bundled.js       Isolated-world content script per platform
  {platform}_injected_bundled.js      MAIN-world injected script per platform
browse_scripts/{platform}/            Browse page scripts (not watch page)
css/
  chat.css                            Chat sidebar styles (injected into page)
  overlay.css                         Overlay + button strip styles
  all-chat.css                        "All Chat" feature styles (YouTube livestream)
  alert.css                           Modal/alert styles
lib/
  replace_state_script.js             Patches history.replaceState to detect SPA nav
  tp_libraries_min.js                 Bundled libs (socket.io, etc.)
popup_react.html / popup_react_bundled.js  Popup (React)
web/
  connectFrame.html / connect_bundled.js   Party creation UI (iframed)
  detect_bundled.js                   Platform detection
  emojiPicker.html / emojiPicker.js   Emoji picker (iframed)
```

### Supported platforms (37 total)
Free (9): Netflix, YouTube, Disney+, Max, Hulu, Prime Video, Apple TV+, Paramount+, Crunchyroll
Premium adds: Peacock, ESPN+, Fubo, Sling, Hotstar, Star+, Stan, Mubi, Shudder, Shahid, ZEE5, Viki, and more

---

## 2. Transport Layer

**Teleparty uses socket.io over WebSocket to their own relay servers.** Not Firebase, not Supabase.

Socket.io events emitted:
- `updateSession` — broadcast playback state (play/pause/seek)
- `getServerTime` — NTP ping (client sends, server echoes with timestamp)
- `nextEpisode` — notify episode change
- `rebootSession` — reconnect to session
- `reloadParty` — force-reload party state
- `sendMessage` — send chat message
- `setPresence` — typing indicator / user presence

**Our approach (Supabase Realtime broadcast) is equivalent and superior** — we get auth, RLS, and persistence for free.

---

## 3. Sync Algorithm (from decompiled source)

### State variables (minified names → real names)
```js
this.On   = lastKnownTime           // last known position (ms)
this.Pn   = lastKnownTimeUpdatedAt  // wall-clock time when position was sampled (ms)
this.In   = state                   // 'PLAYING' | 'PAUSED'
this.un   = clockOffsetMs           // localTime - serverTime (NTP offset, rolling median)
this.sn   = rttSamples              // array of round-trip time samples (max 5)
this.rn   = rttMedian               // median of rttSamples
this.an   = offsetSamples           // array of clock offset samples (max 5)
```

### Drift threshold
```js
const _s = 1000  // 1 SECOND (not 2500ms as older versions used)
// Seek is triggered only when |drift| >= 1000ms
```

### Clock offset calculation (NTP — runs on join, via getServerTime event)
```js
// Client sends ping with sentAt timestamp
// Server responds with { serverTime: ts }
// Client receives at now = Date.now():

rtt = now - sentAt
vn(rttSamples, rtt, 5)              // push to samples, max 5
rttMedian = median(rttSamples)
offset = now - Math.round(rttMedian/2) - serverTime
vn(offsetSamples, offset, 5)        // push to samples, max 5
clockOffsetMs = median(offsetSamples)
```

### Broadcasting — normalize timestamp before sending
```js
// Before sending updateSession:
payload.lastKnownTimeUpdatedAt -= this.clockOffsetMs  // converts local time → server time frame
payload.lastKnownTime = Math.round(payload.lastKnownTime)
```

### Receiving — reconstruct current position
```js
// cs() = elapsed time since last update
cs() {
  return state === 'PLAYING'
    ? Date.now() - (lastKnownTimeUpdatedAt + clockOffsetMs)
    : 0
}

// zn() = reconstructed current position (ms)
zn() {
  return lastKnownTime + cs()
}
```

**Key insight:** The `lastKnownTimeUpdatedAt` in the broadcast is normalized to server time (sender's timestamp minus their clockOffset). The receiver adds their own `clockOffsetMs` to convert back to local time frame. This avoids needing sender's clockOffset on the receiver side.

**Difference from our implementation:** We currently apply clock correction on receive (in the service worker). Teleparty normalizes on send. Both achieve the same result — receiver's `Date.now() - (normalizedSentAt + receiverOffset)` = `localNow - serverSentAt`.

### The sync decision (`bn()` function)
```js
bn(incomingState, force) {
  const actions = []
  if (!lastKnownTime || !lastKnownTimeUpdatedAt || !state) return actions  // invalid payload
  if (!force && state === 'PAUSED' && lastKnownTime < _s) return actions   // paused near start, skip
  const drift = Math.abs(incomingState.lastKnownTime - this.zn())
  if (state === this.currentState && drift < _s) return actions            // same state, small drift, skip
  if (drift >= _s) actions.push('SEEK')
  // ... also checks for PLAY/PAUSE needed
  return actions
}
```

### `uiEventsHappening` suppression
```js
// Gate check before emitting outbound event:
if (uiEventsHappening > 0 || this.changingVideo || !this.sessionId || taskQueue.hasTaskInQueue(fo)) return
// NOTE: Also checks changingVideo (episode transitions) and task queue
```

---

## 4. Netflix Player API (from injected MAIN-world script)

### Getting the player
```js
const getVideoPlayer = () => {
  const e = window.netflix.appContext.state.playerApp.getAPI().videoPlayer
  const playerSessionIds = e.getAllPlayerSessionIds()
  const t = playerSessionIds.find(val => val.includes('watch'))
  return e.getVideoPlayerBySessionId(t)
}
```

### Player methods (all in MILLISECONDS)
```js
player.pause()
player.play()
player.seek(ms - 100)       // subtract 100ms! (Teleparty does this)
player.getCurrentTime()     // returns ms
player.getSegmentTime()     // returns ms (preferred, falls back to getCurrentTime)
player.isPaused()           // boolean
player.getBusy()            // null = ready, non-null = buffering/loading
player.duration             // total duration in ms
```

### Communication pattern (content → injected via postMessage)
```js
// Isolated world sends:
window.postMessage({ type: 'SEEK', time: ms }, '*')
window.postMessage({ type: 'PLAY' }, '*')
window.postMessage({ type: 'PAUSE' }, '*')
window.postMessage({ type: 'GetState' }, '*')
window.postMessage({ type: 'GetCurrentTime' }, '*')
window.postMessage({ type: 'IsPaused' }, '*')
window.postMessage({ type: 'NEXT_EPISODE', videoId }, '*')
window.postMessage({ type: 'ShowControls' }, '*')
window.postMessage({ type: 'CheckSkipSupplemental' }, '*')
window.postMessage({ type: 'GetPageTitle' }, '*')
window.postMessage({ type: 'GetVideoType' }, '*')
window.postMessage({ type: 'GetEpisodeData' }, '*')
window.postMessage({ type: 'GetVideoLookupData' }, '*')
window.postMessage({ type: 'teardown' }, '*')

// Injected script responds via CustomEvent:
window.dispatchEvent(new CustomEvent('FromNode', {
  detail: { type: 'UpdateState', time, paused, adState, loading, actionsState, updatedAt: Date.now() }
}))
window.dispatchEvent(new CustomEvent('FromNode', {
  detail: { type: 'CurrentTime', time, updatedAt }
}))
window.dispatchEvent(new CustomEvent('FromNode', {
  detail: { type: 'IsPaused', paused, updatedAt }
}))
```

### Netflix state detection
```js
const getAdState = () => ({
  watchingAds: currentAdBreak != null,
  adDurationLeft: currentAdBreak?.progress.adBreakOffset.ms ?? 0,
  nextAdBreak: ...
})

const getActionsState = () => ({
  nextEpisodeReady: !!document.querySelector("[data-uia='next-episode-seamless-button']")
})

// Loading = player.getBusy() !== null
```

### React internals access (for Netflix metadata)
```js
const getWrapperStateNode = () => {
  const watchVideoWrapper = document.querySelector('.watch-video')
  const internals = watchVideoWrapper[KEY_STARTING_WITH('__reactFiber')]
  return internals.return.return.return.return.stateNode
}
// wrapperStateNode.state.activeVideoMetadata._metadata._metadataObject.video
// wrapperStateNode.state.playableData.summary.type === 'movie'
// wrapperStateNode.state.activeVideoMetadata._video.title / .seq / .type
```

---

## 5. Chat / Sidebar UI Architecture

### Injection method
Teleparty injects a **chat iframe** into the page (not raw HTML), served from their own CDN:
```html
<div id="chat-wrapper" tpInjected>
  <iframe style="display: none" id="tpChatFrame"
    allow="autoplay; clipboard-read; web-share; clipboard-write; payment; camera; microphone;"
    src="{CHAT_URL}">
  </iframe>
</div>
```
The `{CHAT_URL}` resolves to something like `https://teleparty.com/chat?session=...`

### Layout
```
[video area — shrinks when chat open] [#chat-wrapper — 340px fixed right]
                                       ↑ this is the iframe container

When chat is CLOSED:
[#tp-buttons-container — 50px wide floating strip on right edge]
  [#tp-icon-container — the Teleparty logo button]
  [#tp-message-indicator — red dot for unread messages]
```

### CSS variables
```css
--chat-width: calc(8px * 42.5)  /* = 340px */
--base-width: 8px
```

### Video area (the part that can receive reactions)
```css
.video-overlay {
  width: calc(100vw - var(--chat-width));
  height: 100%;
  position: fixed; top: 0; left: 0; right: auto; bottom: 0;
  z-index: 9999999999;
}
```

### Floating button strip (chat closed)
```css
#tp-buttons-container {
  width: 50px; right: 30px; top: 50px;
  position: fixed; z-index: 9999;
  background-color: rgba(0,0,0,0.5);
  display: flex; flex-direction: column; align-items: center;
}
#tp-icon-container {
  width: 40px; height: 40px;
  border-radius: 4.8px;
}
#tp-message-indicator {
  background: linear-gradient(135deg, #e34248, #bc4d7a 56.67%, #9e55a0);
  width: 10px; height: 10px; border-radius: 10px;
  position: absolute; top: 10px; right: 12px;
}
```

---

## 6. On-Screen Reactions

Reactions are emoji elements positioned absolutely in `.video-overlay` and animated upward with a swaying motion:

```css
.on-screen-reaction {
  position: absolute;
  bottom: 0;
  font-size: 100px;
  z-index: 9999999999;
}
/* 3 animation variants for visual variety: */
.on-screen-reaction-1 { animation: on-screen-reaction-slide 5s, on-screen-reaction-1 12s ... }
.on-screen-reaction-2 { animation: on-screen-reaction-slide 6s, on-screen-reaction-2 12s ... }
.on-screen-reaction-3 { animation: on-screen-reaction-slide 7s, on-screen-reaction-3 12s ... }

@keyframes on-screen-reaction-slide {
  0%   { opacity: 0; transform: translateY(calc(0 - var(--reaction-size))) }
  20%  { opacity: 0.8 }
  90%  { opacity: 0 }
  100% { transform: translateY(-100vh) translateX(-10px); opacity: 0 }
}
```
Reactions are spawned at random X positions. The `--reaction-size` CSS var stores the emoji's rendered height for offset math.

---

## 7. Host Controls (Control Lock)

```js
// On session create:
createSettings: { controlLock: true/false, reactionsDisabled: true/false }

// On session join, state is received:
if ('true' == sessionData.controlLock) this.C = true  // C = isControlLocked (host only mode)
if ('true' == sessionData.reactionsDisabled) this.hn = true

// When broadcasting, if controlLock is true, only the session creator can send updateSession
// Guests can still send buffering events
```

---

## 8. Key Corrections for Our Implementation

### Issue 1: Drift threshold
- **Teleparty**: `_s = 1000ms` (1 second)
- **Us**: 3000ms for heartbeat, 500ms for action
- **Fix**: Use 1000ms as the universal threshold (seek if drift > 1s)

### Issue 2: Netflix player
- **Teleparty**: Uses `window.netflix.appContext.state.playerApp.getAPI().videoPlayer`
- **Us**: Uses `document.querySelector('video')` — fragile
- **Fix**: Rewrite `netflix.js` to use the real API via postMessage to MAIN-world injected script

### Issue 3: Netflix time units
- **Teleparty**: Netflix API returns/accepts **milliseconds**
- **Us**: We work in seconds throughout
- **Fix**: Netflix adapter needs ms↔s conversion. `position * 1000` when sending, `/ 1000` when receiving

### Issue 4: Netflix seek offset
- **Teleparty**: `player.seek(time - 100)` — subtracts 100ms
- **Explanation**: Likely accounts for Netflix's seek latency / seek-ahead behavior
- **Fix**: Apply same -100ms offset in our Netflix MAIN-world injected script

### Issue 5: Chat architecture
- **Teleparty**: Chat is a full iframe from their CDN
- **Us**: We will inject raw HTML chat panel — this is actually better for our use case
- **No fix needed**: Our approach is simpler and we control both sides

### Issue 6: Rate-based drift correction
- **Teleparty**: Only seek when drift >= 1000ms. No rate adjustment found in source.
- **Our implementation**: Rate adjustment (0.95-1.05x) for small drift — we're ahead of Teleparty on this
- **Keep as-is**: Our rate adjustment is a better UX than Teleparty's hard-seek-only approach

### Issue 7: Task queue
- **Teleparty**: Uses a task queue to serialize all player operations (`Wn.pushTask(...)`)
- **Us**: Operations can race (e.g., seek + play simultaneously)
- **Fix**: Add a simple promise chain / flag to serialize apply operations

---

## 9. Platforms We Should Add (free-equivalent tier)

Based on Teleparty's platform list, these are easily implementable (standard `<video>` element):
- **Crunchyroll** — `crunchyroll.com/watch/*`
- **Peacock** — `peacocktv.com/watch/*`
- **Tubi** — `tubitv.com/movies/*`, `/tv-shows/*`
- **Fubo** — `fubo.tv/watch/*`
- **Shudder** — `shudder.com/watch/*`
- **Paramount+** — already have this ✅

Netflix, YouTube, Disney+, Max, Hulu, Prime, Apple TV+, Paramount+ — all done ✅

---

## 10. Features Teleparty Has That We Don't

In priority order:

1. **In-page chat sidebar** — the core social feature (iframe in theirs, we'll do direct HTML)
2. **On-screen emoji reactions** (3 animation variants, random X position)
3. **Presence indicators** — typing, user list, join/leave system messages
4. **User icons** — 20+ preset avatar options per session
5. **GIF picker** (via Tenor/Giphy API) in chat
6. **Full emoji picker** (native emoji-picker component)
7. **Next episode sync** — when Netflix auto-advances, syncs to partner
8. **Ad sync** — both partners wait through ads together
9. **Inactivity detection** — removes user after 120s idle (Teleparty removes after 2hrs `ks = 72e5`)
10. **Video chat** — premium, uses WebRTC (not worth implementing)
11. **Control lock toggle** — let user enable/disable host authority per session

---

## 11. Implementation Chunks (Revised from Phase 9 Plan)

### Chunk A — Netflix API rewrite (CRITICAL correctness fix)
Replace `document.querySelector('video')` with the real Netflix API. Required for reliability.

### Chunk B — Fix drift threshold (1s not 3s)
Small change, big correctness improvement.

### Chunk C — In-page chat overlay (highest user impact)
Fixed right sidebar, directly injected HTML (not iframe). Chat messages via Supabase broadcast.

### Chunk D — On-screen reactions
3 animation variants, random X, CSS keyframe floats.

### Chunk E — Presence (user list, join/leave messages, typing)
Presence events via Supabase Realtime presence channel.

### Chunk F — More platforms
Crunchyroll, Peacock, Tubi — each ~10 lines.

### Chunk G — Next episode sync (Netflix)
Use the `NEXT_EPISODE` postMessage API + URL change detection.
