// Runs in MAIN world — has access to YouTube's page JS (movie_player API)
// Communicates with base.js (ISOLATED world) via window.postMessage

let suppressUntil = 0

function getPlayer() {
  try {
    const p = document.getElementById('movie_player')
    if (p && typeof p.playVideo === 'function' && typeof p.getPlayerState === 'function'
        && typeof p.getCurrentTime === 'function' && typeof p.seekTo === 'function') return p
  } catch (_) {}
  return null
}

function waitForPlayer(cb) {
  if (getPlayer()) { cb(); return }
  const obs = new MutationObserver(() => {
    if (getPlayer()) { obs.disconnect(); cb() }
  })
  obs.observe(document.body, { childList: true, subtree: true })
}

waitForPlayer(() => {
  // Outbound: player state changes → base.js (ISOLATED world)
  const p0 = getPlayer()
  if (!p0) return
  p0.addEventListener('onStateChange', (state) => {
    if (Date.now() < suppressUntil) return
    const p = getPlayer()
    if (!p) return
    try {
      if (state === 1) {
        window.postMessage({ source: 'hiranda-yt', type: 'ACTION', state: 'playing', position: p.getCurrentTime(), sentAt: Date.now() }, '*')
      } else if (state === 2) {
        window.postMessage({ source: 'hiranda-yt', type: 'ACTION', state: 'paused', position: p.getCurrentTime(), sentAt: Date.now() }, '*')
      }
      // state 3 = buffering — ignore
    } catch (_) {}
  })

  // Heartbeat every 5s so base.js can relay position to partner for drift correction
  setInterval(() => {
    try {
      const p = getPlayer()
      if (!p) return
      const s = p.getPlayerState()
      if (s === -1 || s === 5) return
      window.postMessage({
        source: 'hiranda-yt',
        type: 'HEARTBEAT',
        state: s === 1 ? 'playing' : 'paused',
        position: p.getCurrentTime(),
        sentAt: Date.now(),
      }, '*')
    } catch (_) {}
  }, 5000)

  // Inbound: apply sync commands from base.js (ISOLATED world)
  window.addEventListener('message', (e) => {
    if (e.data?.source !== 'hiranda-base' || e.data.type !== 'APPLY_SYNC') return
    try {
      const p = getPlayer()
      if (!p) return
      const { state, position, kind, sentAt } = e.data
      const latency = sentAt ? Math.max(0, (Date.now() - sentAt) / 1000) : 0
      const corrected = state === 'playing' ? position + latency : position
      const drift = Math.abs(p.getCurrentTime() - corrected)
      const threshold = kind === 'action' ? 0.5 : 3
      suppressUntil = Date.now() + 1500
      if (drift > threshold) p.seekTo(corrected, true)
      const playing = p.getPlayerState() === 1
      if (state === 'playing' && !playing) p.playVideo()
      else if (state === 'paused' && playing) p.pauseVideo()
    } catch (_) {}
  })
})
