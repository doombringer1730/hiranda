// YouTube's internal player API — raw video element writes are ignored by YouTube's player
// movie_player exposes: playVideo(), pauseVideo(), seekTo(s, true), getCurrentTime(), getPlayerState()
// Player states: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued

function waitForPlayer(cb) {
  const check = () => {
    const p = document.getElementById('movie_player')
    if (p && typeof p.playVideo === 'function') { cb(p); return true }
    return false
  }
  if (check()) return
  const obs = new MutationObserver(() => { if (check()) obs.disconnect() })
  obs.observe(document.body, { childList: true, subtree: true })
}

waitForPlayer((player) => {
  window.__hirandaAdapter = {
    getPosition() { return player.getCurrentTime() ?? 0 },
    getState() { return player.getPlayerState() === 1 ? 'playing' : 'paused' },
    play() { player.playVideo() },
    pause() { player.pauseVideo() },
    seek(pos) { player.seekTo(pos, true) },
    hookEvents(onAction) {
      player.addEventListener('onStateChange', (state) => {
        if (state === 1) onAction('playing', player.getCurrentTime())
        else if (state === 2) onAction('paused', player.getCurrentTime())
        // state 3 = buffering — ignore, don't broadcast
      })
    },
  }
  window.dispatchEvent(new CustomEvent('hiranda:adapter-ready'))
})
