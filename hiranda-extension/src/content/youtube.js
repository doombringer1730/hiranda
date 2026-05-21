// MAIN world — direct access to YouTube's movie_player API
// Communicates with base.js (ISOLATED world) via window.postMessage

let suppressUntil = 0
let frozen        = false
let prevState     = -1

function suppressed() { return Date.now() < suppressUntil || frozen }
function suppress(ms = 1500) { suppressUntil = Date.now() + ms }

function getPlayer() {
  try {
    const p = document.getElementById('movie_player')
    if (p
      && typeof p.playVideo    === 'function'
      && typeof p.pauseVideo   === 'function'
      && typeof p.seekTo       === 'function'
      && typeof p.getCurrentTime === 'function'
      && typeof p.getPlayerState === 'function') return p
  } catch (_) {}
  return null
}

function waitForPlayer(cb) {
  if (getPlayer()) { cb(); return }
  const id = setInterval(() => { if (getPlayer()) { clearInterval(id); cb() } }, 500)
}

waitForPlayer(() => {
  const p0 = getPlayer()
  if (!p0) return
  console.log('[Hiranda YT] player found')

  // ── Outbound: player events → base.js ────────────────────────────────────

  p0.addEventListener('onStateChange', state => {
    if (suppressed()) { prevState = state; return }
    const p = getPlayer()
    if (!p) return

    const pos = p.getCurrentTime()      // seconds
    const dur = p.getDuration()         // seconds
    const ts  = Date.now()

    if (state === 1) {
      // playing — if recovering from buffering send 'resume' so partner unfreezes
      const type = prevState === 3 ? 'RESUME' : 'ACTION'
      window.postMessage({ source: 'hiranda-yt', type, state: 'playing', position: pos, sentAt: ts, duration: dur }, '*')
      console.log('[Hiranda YT] outbound', type, pos.toFixed(1))
    } else if (state === 2) {
      window.postMessage({ source: 'hiranda-yt', type: 'ACTION', state: 'paused', position: pos, sentAt: ts, duration: dur }, '*')
      console.log('[Hiranda YT] outbound ACTION paused', pos.toFixed(1))
    } else if (state === 3) {
      window.postMessage({ source: 'hiranda-yt', type: 'BUFFERING', state: 'buffering', position: pos, sentAt: ts, duration: dur }, '*')
      console.log('[Hiranda YT] outbound BUFFERING')
    }

    prevState = state
  })

  // ── Heartbeat every 5s ────────────────────────────────────────────────────

  setInterval(() => {
    if (frozen) return
    const p = getPlayer()
    if (!p) return
    const s = p.getPlayerState()
    if (s === -1 || s === 5 || s === 3) return  // unstarted / cued / buffering
    window.postMessage({
      source: 'hiranda-yt',
      type: 'HEARTBEAT',
      state: s === 1 ? 'playing' : 'paused',
      position: p.getCurrentTime(),
      sentAt: Date.now(),
      duration: p.getDuration(),
    }, '*')
  }, 1000)

  // ── Inbound: apply sync from base.js ──────────────────────────────────────

  window.addEventListener('message', e => {
    if (e.data?.source !== 'hiranda-base' || e.data.type !== 'APPLY_SYNC') return

    const p = getPlayer()
    if (!p) return

    const { state, position, kind } = e.data

    // ── Buffering: partner is buffering, freeze us ──
    if (kind === 'buffering') {
      suppress()
      p.pauseVideo()
      frozen = true
      console.log('[Hiranda YT] frozen (partner buffering)')
      return
    }

    // ── Resume: partner recovered from buffering ──
    if (kind === 'resume') {
      frozen = false
      suppress()
      if (Math.abs(p.getCurrentTime() - position) > 0.5) p.seekTo(position, true)
      if (state === 'playing') p.playVideo()
      p.setPlaybackRate(1.0)
      console.log('[Hiranda YT] resumed from buffering')
      return
    }

    // ── Normal sync (action or heartbeat) ──
    const current  = p.getCurrentTime()
    const drift    = position - current   // positive = we're behind
    const absDrift = Math.abs(drift)

    console.log('[Hiranda YT] apply', kind, 'drift:', drift.toFixed(2), 's')

    suppress()

    if (absDrift > 2) {
      p.seekTo(position, true)
      p.setPlaybackRate(1.0)
    } else if (absDrift > 1.0 && state === 'playing') {
      p.setPlaybackRate(drift > 0 ? 1.05 : 0.95)
    } else {
      p.setPlaybackRate(1.0)
    }

    // Apply play/pause after a short delay so any seek has time to settle
    const applyPlayPause = () => {
      const playing = p.getPlayerState() === 1
      if      (state === 'playing' && !playing) { p.playVideo();  console.log('[Hiranda YT] applied play') }
      else if (state === 'paused'  &&  playing) { p.pauseVideo(); console.log('[Hiranda YT] applied pause') }
    }

    if (absDrift > 2) {
      setTimeout(applyPlayPause, 300)  // give seek time to settle
    } else {
      applyPlayPause()
    }
  })
})
