// Persistent port — keeps the MV3 service worker alive while on a streaming page
const _port = chrome.runtime.connect({ name: 'keepalive' })

let inParty = false
let adapter = null
let eventsHooked = false
let suppressUntil = 0  // timestamp; suppress outbound events until this time

// ── Adapter resolution ────────────────────────────────────────────────────────
// Platform scripts set window.__hirandaAdapter (preferred) or window.__hirandaGetVideo.
// If neither, fall back to document.querySelector('video').

function makeVideoAdapter(v) {
  return {
    getPosition() { return v.currentTime },
    getState()    { return v.paused ? 'paused' : 'playing' },
    play()        { v.play().catch(() => {}) },
    pause()       { v.pause() },
    seek(pos)     { v.currentTime = pos },
    hookEvents(onAction) {
      v.addEventListener('play',   () => onAction('playing', v.currentTime))
      v.addEventListener('pause',  () => onAction('paused',  v.currentTime))
      v.addEventListener('seeked', () => onAction(v.paused ? 'paused' : 'playing', v.currentTime))
    },
  }
}

function resolveAdapter() {
  if (typeof window.__hirandaAdapter !== 'undefined') return window.__hirandaAdapter
  const v = typeof window.__hirandaGetVideo === 'function'
    ? window.__hirandaGetVideo()
    : document.querySelector('video')
  return v ? makeVideoAdapter(v) : null
}

function initAdapter() {
  const a = resolveAdapter()
  if (!a) return false
  adapter = a
  if (!eventsHooked) {
    eventsHooked = true
    adapter.hookEvents((state, position) => {
      if (Date.now() < suppressUntil || !inParty) return
      push('action', state, position)
    })
  }
  return true
}

function waitForAdapter() {
  if (initAdapter()) return
  // youtube.js fires this event when movie_player is ready
  window.addEventListener('hiranda:adapter-ready', () => initAdapter(), { once: true })
  // For other platforms: watch for video element to appear
  const obs = new MutationObserver(() => { if (initAdapter()) obs.disconnect() })
  obs.observe(document.body, { childList: true, subtree: true })
}

// ── Sync protocol ─────────────────────────────────────────────────────────────
// sentAt enables clock compensation: receiver corrects position for network RTT.
// Action threshold: tight (0.5s) — user-triggered, apply immediately.
// Heartbeat threshold: loose (3s) — only correct significant drift.
// suppressUntil: prevents echo-loop after applying remote state (YouTube fires
// onStateChange during buffering, so we suppress for 1.5s after any remote apply).

function push(kind, state, position) {
  chrome.runtime.sendMessage({
    type: 'SYNC_ACTION',
    payload: { kind, state, position, sentAt: Date.now() },
  }).catch(() => {})
}

function applySync(payload) {
  if (!adapter) return
  const { state, position, kind, sentAt } = payload

  // Compensate for network latency: if playing, video has advanced since sentAt
  const latency = sentAt ? Math.max(0, (Date.now() - sentAt) / 1000) : 0
  const corrected = state === 'playing' ? position + latency : position

  const drift = Math.abs(adapter.getPosition() - corrected)
  const threshold = kind === 'action' ? 0.5 : 3

  // Suppress outbound events while we apply (covers YouTube's buffering state changes)
  suppressUntil = Date.now() + 1500

  if (drift > threshold) adapter.seek(corrected)

  const curState = adapter.getState()
  if (state === 'playing' && curState === 'paused') adapter.play()
  else if (state === 'paused' && curState === 'playing') adapter.pause()
}

// ── Message handlers ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'APPLY_SYNC') {
    if (!adapter) initAdapter()
    applySync(msg.payload)
  }

  if (msg.type === 'PARTY_STARTED') {
    inParty = true
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB' }).catch(() => {})
    if (!adapter) waitForAdapter()
  }

  if (msg.type === 'PARTY_ENDED') {
    inParty = false
  }
})

// Heartbeat every 5s — corrects drift without flooding the channel
setInterval(() => {
  if (!adapter || !inParty) return
  push('heartbeat', adapter.getState(), adapter.getPosition())
}, 5000)

// Restore party state after page reload mid-session
chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (res) => {
  if (res?.sessionId) {
    inParty = true
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB' }).catch(() => {})
  }
})

waitForAdapter()
