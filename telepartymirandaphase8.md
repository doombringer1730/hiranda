# Teleparty × Miranda — Phase 8 Research

Deep-dive into how Teleparty actually works, what we can adopt, and where we already diverge for the better.

---

## 1. Teleparty Architecture Overview

Teleparty is a Chrome extension (Manifest V3). Three moving parts:

| Layer | File | World | Job |
|---|---|---|---|
| Background service worker | `background.js` | Service worker | Holds socket.io connection to their relay server; routes messages between tabs |
| Isolated content script | `content.js` | ISOLATED | Bridges chrome.runtime ↔ page; injects MAIN-world script |
| MAIN world script | Injected dynamically | MAIN | Talks directly to the streaming platform's JS API |

This is the same model we use. Our `base.js` = their isolated script; our `youtube.js` = their MAIN-world script.

### Transport

Teleparty bundles `socket.io-client` directly into the extension and opens a persistent WebSocket to their relay server. Every session is a socket.io room. All sync events go through the relay — there is no P2P.

**We use Supabase Realtime broadcast channels instead.** This is equivalent and actually better for us since we already have auth, RLS, and session state in Supabase.

---

## 2. The Sync Algorithm (the important part)

### State model

Teleparty does NOT just relay play/pause. Every sync event carries:

```js
{
  lastKnownTime:          number,  // video position in ms at moment of broadcast
  lastKnownTimeUpdatedAt: Date,    // wall-clock timestamp when that position was recorded
  state:                  'playing' | 'paused' | 'buffering',
  videoDuration:          number,  // total ms (for validation)
  bufferingState:         boolean,
}
```

### Reconstructing current position on the receiver

When a receiver gets a sync payload, they don't just seek to `lastKnownTime`. They reconstruct where the video *should be right now*:

```js
// serverTime = where the video should be at this exact moment
const serverTime = lastKnownTime + (
  state === 'playing'
    ? (Date.now() - (lastKnownTimeUpdatedAt + localTimeMinusServerTimeMedian))
    : 0
)
```

This is an NTP-style offset calculation. Because `lastKnownTimeUpdatedAt` was recorded at the *sender's* wall clock, you correct for the clock difference between sender and receiver via `localTimeMinusServerTimeMedian`.

### Clock offset (NTP-style)

On session start and periodically:

```
client sends: getServerTime (with client timestamp t0)
server replies: serverTimestamp ts, echoes t0
client calculates:
  roundTripTime = Date.now() - t0
  serverTimeNow = ts + roundTripTime / 2
  offset = Date.now() - serverTimeNow
```

Teleparty keeps a **rolling median of the last 5 samples** for both:
- `roundTripTimeMedian`
- `localTimeMinusServerTimeMedian`

Medians are used (not averages) to resist network spikes.

### Drift correction thresholds

The `sync()` function runs on an interval and compares local position to `serverTime`:

```
drift = |currentTime - serverTime|

if paused:  correct if drift > maxTimeError (2500 ms)
if playing: correct continuously (smooth correction)
```

For small playing drift, Teleparty adjusts **playback rate** (0.95x–1.10x) instead of hard-seeking. Hard seek only for drift > ~2s.

### Suppress / UI gate

After applying a sync (seek/play/pause), Teleparty suppresses outbound events via a `uiEventsHappening` counter. Every simulated player interaction increments it; the completion callback decrements it. Outbound broadcasts only fire when `uiEventsHappening === 0`.

This is equivalent to our `suppressUntil = Date.now() + 1500` pattern, but more precise because it's event-counted rather than time-based.

### Host authority

Only the **host** can broadcast state updates (play/pause/seek). Guests emit buffering events but not playback control. This prevents feedback loops where two clients fight over position.

**We currently don't enforce this.** Both partners can emit sync events, which is why we can get oscillation.

---

## 3. Buffering Sync

When a user starts buffering:

1. Emit `buffering: true` to room
2. All other clients call `freeze(ms)` — pause temporarily and wait
3. When buffering clears, emit `buffering: false`
4. All clients resume from the reconstructed `serverTime`

`freezeUntil(condition, maxDelay)` pauses until a given condition is true (e.g., video `readyState >= 3`) or a max timeout expires.

**We don't handle buffering at all.** If one partner's stream buffers, they fall behind with no recovery until the next heartbeat drift correction.

---

## 4. Per-Platform Player Control

### Netflix

Netflix's player is not a `<video>` element you can control directly from outside. Teleparty posts messages into the page:

```js
window.postMessage({ type: "SEEK",  time: milliseconds }, "*")
window.postMessage({ type: "PLAY"  }, "*")
window.postMessage({ type: "PAUSE" }, "*")
```

Netflix's own page scripts listen for these. This is why their content script must run in MAIN world for Netflix.

**Current Hiranda:** Our `netflix.js` does not exist yet (only `base.js` is loaded for Netflix). We rely on `document.querySelector('video')` and direct `.play()/.pause()/.currentTime`. This works but is fragile — Netflix can unmount/remount the video element.

### YouTube

YouTube exposes the `movie_player` DOM element with a full API:
```js
player.playVideo()
player.pauseVideo()
player.seekTo(seconds, allowSeekAhead)
player.getCurrentTime()    // seconds
player.getPlayerState()    // -1=unstarted, 1=playing, 2=paused, 3=buffering, 5=cued
```

We already do this correctly in `youtube.js`.

**Note:** Netflix uses milliseconds; YouTube uses seconds. Always check units.

### Disney+, Hulu, Max, Prime

These all have accessible `<video>` elements. Teleparty uses direct DOM control:

```js
video.play()
video.pause()
video.currentTime = seconds
```

Same as our current approach. Some SPAs (Prime especially) remount the video element on navigation — need MutationObserver or polling to re-acquire.

### Apple TV+

Uses an EME-protected video element. Direct `video.currentTime` writes often silently fail. Must use their internal player API or the seek-via-button approach.

---

## 5. Extension Architecture Details

### Content script injection pattern

Teleparty uses `chrome.scripting.executeScript` from the service worker (not manifest `content_scripts`) to inject the MAIN-world script dynamically. This lets them inject *after* confirming a party is active, avoiding unnecessary injection on every page load.

```js
// From service worker
chrome.scripting.executeScript({
  target: { tabId },
  files: ['content/mainworld.js'],
  world: 'MAIN',
})
```

**Current Hiranda:** We declare `youtube.js` in manifest `content_scripts` with `"world": "MAIN"`, so it runs on every YouTube watch page whether or not a party is active. Not wrong, just slightly wasteful.

### keepalive port

Both Teleparty and we use a persistent `chrome.runtime.connect` port from the content script to keep the service worker alive (prevent MV3 idle termination while in a party).

### Session state persistence

MV3 service workers are ephemeral — they die after ~30s idle. On any message, the service worker must check if the channel is still live and rejoin if not. We already do this with `ensureChannel()`.

### The `reInject` message

Teleparty's service worker has a `reInject` message that re-executes a content script in a tab. This is their fallback when a tab navigates within the same origin (e.g., switching Netflix titles) and the content script needs to re-initialize.

---

## 6. Session URL Format

```
teleparty.com/join/<sessionId>
```

Session IDs are hex strings. The join URL routes through a redirect server that resolves to the actual streaming URL + session parameters.

**Our approach:** We use Supabase session records with UUID session IDs. The partner navigates to the video URL themselves; we don't bundle it into the join link. Phase 8 could add deep-link support.

---

## 7. Chat & Presence

- Messages stored in socket.io room state, not a database (ephemeral)
- Message DOM: `<div class="msg-container">` with user icon, nickname, body
- System messages (join/leave) get a separate CSS class
- `setPresence` event updates avatar/name in sidebar
- jQuery `$.data()` used to attach metadata to DOM nodes for name-change refresh

**We use Supabase realtime for chat.** More persistent, queryable, already integrated.

---

## 8. Known Teleparty Weaknesses

1. **No P2P** — all traffic routes through their relay servers. If server goes down, party dies.
2. **Separate CDN streams** — each person pulls from Netflix/etc independently. True frame-perfect sync is impossible; they paper over it with the clock-offset math.
3. **jQuery 2.1.4** — ancient dependency bundled in extension.
4. **MAIN-world injection security** — the host page can interfere with injected MAIN-world scripts.
5. **Host authority not strictly enforced client-side** — guests technically can emit sync if they bypass the UI gate.
6. **No buffering sync in current versions** — the freeze logic exists in older source but may not be active.

---

## 9. What Phase 8 Should Adopt

### Immediate wins (port directly)

| What | Why |
|---|---|
| `lastKnownTime` + `lastKnownTimeUpdatedAt` in every sync payload | Receiver reconstructs live position instead of seeking to stale timestamp |
| NTP-style clock offset (5-sample rolling median) | Corrects for clock skew between partners |
| Playback-rate drift correction for small drift (<2s) | Smooth catch-up instead of jarring seek |
| `uiEventsHappening` counter instead of `suppressUntil` timeout | Suppression tied to actual events, not an arbitrary window |
| Host authority — only host emits play/pause/seek | Eliminates oscillation |

### Medium effort

| What | Why |
|---|---|
| Buffering sync (`freeze` / `freezeUntil`) | Partners don't drift when one buffers |
| Dynamic MAIN-world injection from service worker | Only inject when party is active |
| Platform-specific seek strategies (rate adjust vs hard seek) | Better UX per platform |
| Netflix MAIN-world postMessage control | More reliable than direct video element |

### Keep as-is (we're already better)

| What | Why |
|---|---|
| Supabase Realtime instead of socket.io relay | Auth, RLS, persistence built in; no self-hosted relay needed |
| Supabase chat with DB persistence | Messages survive page refresh |
| Supabase session records | Query history, connect to Hiranda web app |

---

## 10. Revised Sync Payload for Hiranda Phase 8

```js
// What we should send (both heartbeat and action)
{
  kind:                   'action' | 'heartbeat',
  state:                  'playing' | 'paused' | 'buffering',
  position:               number,    // seconds (current)
  positionUpdatedAt:      number,    // Date.now() ms when position was sampled
  duration:               number,    // total seconds (for validation)
  from:                   string,    // userId
}

// How receiver calculates target position
const elapsedMs = Date.now() - payload.positionUpdatedAt - clockOffsetMs
const targetPosition = payload.state === 'playing'
  ? payload.position + elapsedMs / 1000
  : payload.position
```

---

## 11. Phase 8 Task List

- [ ] Add `positionUpdatedAt` to all sync payloads (extension + service worker)
- [ ] Implement NTP clock offset: ping/pong via Supabase broadcast on party join
- [ ] Receiver reconstructs target position using `positionUpdatedAt` + clock offset
- [ ] Add playback-rate adjustment (0.95–1.05x) for drift < 2s; hard seek for ≥ 2s
- [ ] Replace `suppressUntil` with event-counter gate in base.js
- [ ] Enforce host authority: only host user emits play/pause/seek actions
- [ ] Add buffering detection and freeze-until-ready logic
- [ ] Fix `waitForAdapter` in base.js: use `setInterval` poll instead of `MutationObserver` on `document.body` (avoids null-body error on document_start or fast SPAs)
- [ ] Investigate Netflix MAIN-world postMessage API for more reliable seek
- [ ] Add `reInject` handler in service worker for mid-session tab navigation

---

## Sources

- [Party time: Injecting code into Teleparty extension | Almost Secure](https://palant.info/2022/03/14/party-time-injecting-code-into-teleparty-extension/)
- [netflixparty.js (old open-source source) · GitHub Gist](https://gist.github.com/ollybritton/3826013e3738fd69e05087fe223d3928)
- [The problem with every watch-party app ever made · DEV Community](https://dev.to/devpratyush/the-problem-with-every-watch-party-app-ever-made-ip9)
- [VidParty — Teleparty clone · GitHub](https://github.com/rubychi/vidparty)
- [Socket.IO import in Chrome extensions · Chromium Extensions Group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/reskCCOYTR4)
- [Manifest - content scripts | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
