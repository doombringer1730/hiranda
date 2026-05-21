// Runs in ISOLATED world — has chrome.runtime access
// On YouTube: bridges postMessage ↔ chrome.runtime (youtube.js handles player in MAIN world)
// On other platforms: uses video element adapter directly

const _port = chrome.runtime.connect({ name: 'keepalive' })

let inParty = false
let adapter = null
let eventsHooked = false
let suppressUntil = 0

const isYouTube = location.hostname === 'www.youtube.com'

// ── YouTube bridge ────────────────────────────────────────────────────────────
// youtube.js (MAIN world) ↔ base.js (ISOLATED world) via window.postMessage

if (isYouTube) {
  window.addEventListener('message', (e) => {
    if (e.data?.source !== 'hiranda-yt') return
    if (!inParty) return
    const { type, state, position, sentAt } = e.data
    if (type === 'ACTION' || type === 'HEARTBEAT') {
      chrome.runtime.sendMessage({
        type: 'SYNC_ACTION',
        payload: { kind: type === 'ACTION' ? 'action' : 'heartbeat', state, position, sentAt },
      }).catch(() => {})
    }
  })
}

// ── Video element adapter (non-YouTube) ───────────────────────────────────────

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

function initAdapter() {
  if (isYouTube) return true
  if (adapter) return true
  const v = typeof window.__hirandaGetVideo === 'function'
    ? window.__hirandaGetVideo()
    : document.querySelector('video')
  if (!v) return false
  adapter = makeVideoAdapter(v)
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
  const obs = new MutationObserver(() => { if (initAdapter()) obs.disconnect() })
  obs.observe(document.body, { childList: true, subtree: true })
}

// ── Sync ──────────────────────────────────────────────────────────────────────

function ctxOk() {
  try { return !!chrome.runtime?.id } catch (_) { return false }
}

function push(kind, state, position) {
  if (!ctxOk()) return
  try {
    chrome.runtime.sendMessage({
      type: 'SYNC_ACTION',
      payload: { kind, state, position, sentAt: Date.now() },
    }).catch(() => {})
  } catch (_) {}
}

function applySync(payload) {
  if (isYouTube) {
    // Forward to youtube.js in MAIN world — it owns the player
    window.postMessage({ source: 'hiranda-base', type: 'APPLY_SYNC', ...payload }, '*')
    return
  }
  if (!adapter) return
  const { state, position, kind, sentAt } = payload
  const latency = sentAt ? Math.max(0, (Date.now() - sentAt) / 1000) : 0
  const corrected = state === 'playing' ? position + latency : position
  const drift = Math.abs(adapter.getPosition() - corrected)
  const threshold = kind === 'action' ? 0.5 : 3
  suppressUntil = Date.now() + 1500
  if (drift > threshold) adapter.seek(corrected)
  const curState = adapter.getState()
  if (state === 'playing' && curState === 'paused') adapter.play()
  else if (state === 'paused' && curState === 'playing') adapter.pause()
}

// ── Chrome message handlers ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'APPLY_SYNC') {
    if (!isYouTube && !adapter) initAdapter()
    applySync(msg.payload)
  }
  if (msg.type === 'PARTY_STARTED') {
    inParty = true
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB' }).catch(() => {})
    if (!isYouTube) waitForAdapter()
  }
  if (msg.type === 'PARTY_ENDED') {
    inParty = false
  }
})

// Non-YouTube heartbeat
setInterval(() => {
  if (isYouTube || !adapter || !inParty) return
  push('heartbeat', adapter.getState(), adapter.getPosition())
}, 5000)

chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (res) => {
  if (res?.sessionId) {
    inParty = true
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB' }).catch(() => {})
  }
})

waitForAdapter()
