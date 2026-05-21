// ISOLATED world — chrome.runtime access, no page JS access
// YouTube: bridges postMessage ↔ chrome.runtime (youtube.js owns the player in MAIN world)
// Other platforms: owns the video element adapter directly

const _port = chrome.runtime.connect({ name: 'keepalive' })

let inParty        = false
let adapter        = null
let eventsHooked   = false
let suppressUntil  = 0   // suppress outbound events until this timestamp
let frozen         = false  // partner is buffering — hold playback

const isYouTube = location.hostname === 'www.youtube.com'

function suppressed() { return Date.now() < suppressUntil || frozen }
function suppress(ms = 1500) { suppressUntil = Date.now() + ms }

// ── YouTube bridge ────────────────────────────────────────────────────────────
// youtube.js (MAIN world) → base.js (ISOLATED) via window.postMessage

if (isYouTube) {
  window.addEventListener('message', e => {
    if (e.data?.source !== 'hiranda-yt') return
    if (!inParty || suppressed()) return
    const { type, state, position, sentAt, duration } = e.data
    if (type === 'ACTION' || type === 'HEARTBEAT' || type === 'BUFFERING' || type === 'RESUME') {
      const kind = type.toLowerCase()  // 'action' | 'heartbeat' | 'buffering' | 'resume'
      sendSync(kind, state, position, sentAt, duration)
    }
  })
}

// ── Video element adapter (Netflix, Disney+, etc.) ────────────────────────────

function makeAdapter(v) {
  return {
    getPos()      { return v.currentTime },
    getDur()      { return v.duration || 0 },
    getState()    { return v.paused ? 'paused' : 'playing' },
    play()        { suppress(); v.play().catch(() => {}) },
    pause()       { suppress(); v.pause() },
    seek(t)       { suppress(); v.currentTime = t },
    setRate(r)    { v.playbackRate = r },
    hookEvents(cb, onBuffer, onResume) {
      v.addEventListener('play',    () => { if (suppressed() || !inParty) return; cb('playing', v.currentTime, v.duration) })
      v.addEventListener('pause',   () => { if (suppressed() || !inParty) return; cb('paused',  v.currentTime, v.duration) })
      v.addEventListener('seeked',  () => { if (suppressed() || !inParty) return; cb(v.paused ? 'paused' : 'playing', v.currentTime, v.duration) })
      v.addEventListener('waiting', () => { if (suppressed() || !inParty || frozen) return; onBuffer(v.currentTime, v.duration) })
      v.addEventListener('canplay', () => { if (suppressed() || !inParty || frozen) return; onResume(v.paused ? 'paused' : 'playing', v.currentTime, v.duration) })
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
  adapter = makeAdapter(v)
  if (!eventsHooked) {
    eventsHooked = true
    adapter.hookEvents(
      (state, pos, dur) => sendSync('action',    state,       pos, Date.now(), dur),
      (pos, dur)        => sendSync('buffering', 'buffering', pos, Date.now(), dur),
      (state, pos, dur) => sendSync('resume',    state,       pos, Date.now(), dur),
    )
  }
  return true
}

function waitForAdapter() {
  if (initAdapter()) return
  const id = setInterval(() => { if (initAdapter()) clearInterval(id) }, 500)
}

// ── Outbound sync ─────────────────────────────────────────────────────────────

function ctxOk() { try { return !!chrome.runtime?.id } catch (_) { return false } }

function sendSync(kind, state, position, sentAt, duration) {
  if (!ctxOk()) return
  chrome.runtime.sendMessage({
    type: 'SYNC_ACTION',
    payload: { kind, state, position, sentAt: sentAt ?? Date.now(), duration: duration ?? 0 },
  }).catch(() => {})
}

// ── Inbound sync ──────────────────────────────────────────────────────────────

function applySync(payload) {
  const { state, position, kind } = payload

  if (isYouTube) {
    // Let youtube.js (MAIN world) handle it
    window.postMessage({ source: 'hiranda-base', type: 'APPLY_SYNC', ...payload }, '*')
    return
  }

  if (!adapter) return

  if (kind === 'buffering') {
    suppress()
    adapter.pause()
    frozen = true
    return
  }

  if (kind === 'resume') {
    frozen = false
    suppress()
    const drift = Math.abs(adapter.getPos() - position)
    if (drift > 0.5) adapter.seek(position)
    if (state === 'playing') adapter.play()
    adapter.setRate(1.0)
    return
  }

  // action or heartbeat
  const drift    = position - adapter.getPos()
  const absDrift = Math.abs(drift)

  suppress()

  if (absDrift > 2) {
    // Large drift: hard seek + reset rate
    adapter.seek(position)
    adapter.setRate(1.0)
  } else if (absDrift > 1.0 && state === 'playing') {
    // Small drift (1–2s): smooth rate adjustment (Teleparty approach)
    adapter.setRate(drift > 0 ? 1.05 : 0.95)
  } else {
    adapter.setRate(1.0)
  }

  const cur = adapter.getState()
  if (state === 'playing' && cur === 'paused') adapter.play()
  else if (state === 'paused' && cur === 'playing') adapter.pause()
}

// ── Chrome message handlers ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'APPLY_SYNC') {
    if (!isYouTube && !adapter) initAdapter()
    applySync(msg.payload)
  }

  if (msg.type === 'PARTY_STARTED') {
    inParty = true
    suppressUntil = 0
    frozen = false
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB' }).catch(() => {})
    if (!isYouTube) waitForAdapter()
    console.log('[Hiranda] party started, inParty=true')
  }

  if (msg.type === 'PARTY_ENDED') {
    inParty = false
    frozen = false
    if (adapter) adapter.setRate(1.0)
    console.log('[Hiranda] party ended')
  }

  if (msg.type === 'REINIT_ADAPTER') {
    adapter = null
    eventsHooked = false
    frozen = false
    waitForAdapter()
    console.log('[Hiranda] adapter reinitialized')
  }
})

// ── Heartbeat (non-YouTube) ───────────────────────────────────────────────────

setInterval(() => {
  if (isYouTube || !adapter || !inParty || frozen) return
  sendSync('heartbeat', adapter.getState(), adapter.getPos(), Date.now(), adapter.getDur())
}, 1000)

// ── On page load: restore party state if already in session ──────────────────

chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, res => {
  if (res?.sessionId) {
    inParty = true
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB' }).catch(() => {})
    console.log('[Hiranda] restored party state on page load')
  }
})

// Auto-join if URL contains ?hiranda=SESSION_ID (guest clicked "Open on [platform]" from party page)
const _autoJoinId = new URLSearchParams(location.search).get('hiranda')
if (_autoJoinId && !inParty) {
  console.log('[Hiranda] auto-joining from URL:', _autoJoinId)
  chrome.runtime.sendMessage({ type: 'JOIN_SESSION', sessionId: _autoJoinId }, res => {
    if (res && !res.error) {
      console.log('[Hiranda] auto-joined:', _autoJoinId)
    } else {
      console.log('[Hiranda] auto-join failed:', res?.error)
    }
  })
}

waitForAdapter()
