// ISOLATED world — Hiranda Watch Party sync engine
// Mirrors Teleparty's sync algorithm exactly (from decompiled source):
//   YouTube drift threshold: 2500ms  (Teleparty Pt() function)
//   Other platforms:         1000ms
//   NTP: rolling median of 5 RTT + 5 offset samples
//   zn() = On + (PLAYING ? Date.now() - (Pn + un) : 0)
//   Fn() normalizes: lastKnownTimeUpdatedAt -= clockOffsetMs
//
// Transport: Supabase Realtime broadcast (replaces wss://ws.teleparty.com)

import { createClient } from '@supabase/supabase-js'

// ── Constants (from Teleparty source) ────────────────────────────────────────
const DRIFT_THRESHOLD    = 1000   // default drift threshold (ms)
const DRIFT_THRESHOLD_YT = 2500   // YouTube-specific threshold — Teleparty Pt() uses <=2500
const NTP_SAMPLE_MAX     = 5      // max samples per rolling window
const HEARTBEAT_MS       = 4000   // broadcast interval when playing
const NTP_INTERVAL_MS    = 30000  // how often to re-sync clock

const SUPABASE_URL  = 'https://nqmawsssiutarjylnmhg.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xbWF3c3NzaXV0YXJqeWxubWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDYzODQsImV4cCI6MjA5NDU4MjM4NH0.MtuvqyUxeztP1scGTrebMKBaA6JjC2b0P1qARKmgPZw'
const HIRANDA_URL   = 'https://hiranda-616i.vercel.app'

// ── Teleparty's NTP helpers ──────────────────────────────────────────────────
// vn(arr, val, max) — push to rolling window
function vn(arr, val, max) {
  arr.push(val)
  if (arr.length > max) arr.splice(0, arr.length - max)
}
// gn(arr) — median
function gn(arr) {
  return arr.concat().sort((a, b) => a - b)[Math.floor(arr.length / 2)]
}

// ── Platform detection ────────────────────────────────────────────────────────
const host = location.hostname
const PLATFORM =
  host.includes('netflix.com')   ? 'netflix'  :
  host.includes('youtube.com')   ? 'youtube'  :
  host.includes('disneyplus.com')? 'disney'   :
  host.includes('amazon.com') || host.includes('primevideo.com') ? 'amazon' :
  host.includes('hiranda-616i.vercel.app') ? 'hiranda' :
  null

if (!PLATFORM) { /* not a supported page */ }

// ── Sync state (mirrors Teleparty's Qr class fields) ─────────────────────────
let On = 0          // lastKnownTime (ms)
let Pn = 0          // lastKnownTimeUpdatedAt (server-time frame)
let In = 'PAUSED'   // 'PLAYING' | 'PAUSED'
let un = 0          // clockOffsetMs (localTime - serverTime)
let sn = []         // rttSamples
let rn = 0          // rttMedian
let an = []         // offsetSamples

// uiEventsHappening — Teleparty's counter to suppress echoes
let uiEventsHappening = 0

let partyId   = null
let isHost    = false
let channel   = null
let heartbeatTimer = null
let ntpTimer  = null

// Guards against duplicate local event listeners on re-join
let localListenersAttached = false
let moRef = null

// Tracks whether the guest has received its first sync payload this session.
// Force-applies the first one so drift threshold doesn't suppress the initial seek.
let hasReceivedFirstSync = false

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── Teleparty's cs() + zn() — live position reconstruction ──────────────────
function cs() {
  return In === 'PLAYING' ? Date.now() - (Pn + un) : 0
}
function zn() {
  return On + cs()
}

// ── NTP — exact Teleparty algorithm ─────────────────────────────────────────
async function syncClock() {
  try {
    const sentAt = Date.now()
    const res = await fetch(`${HIRANDA_URL}/api/time`)
    const { t: serverTime } = await res.json()
    const now = Date.now()
    vn(sn, now - sentAt, NTP_SAMPLE_MAX)               // push RTT
    rn = gn(sn)                                         // rttMedian
    vn(an, now - Math.round(rn / 2) - serverTime, NTP_SAMPLE_MAX)  // push offset
    un = gn(an)                                         // clockOffsetMs = gn(offsetSamples)
  } catch (e) {
    console.log('[Hiranda] NTP error:', e)
  }
}

// ── Adapter — platform-specific player control ────────────────────────────────
const adapter = {
  // Netflix uses postMessage → MAIN world → FromNode CustomEvent back
  netflix: {
    driftThreshold: 1000,
    async getCurrentTime() {
      return new Promise(resolve => {
        const handler = e => {
          if (e.detail?.type === 'CurrentTime') {
            window.removeEventListener('FromNode', handler)
            resolve(e.detail.time)
          }
        }
        window.addEventListener('FromNode', handler)
        window.postMessage({ type: 'GetCurrentTime' }, '*')
        setTimeout(() => { window.removeEventListener('FromNode', handler); resolve(0) }, 500)
      })
    },
    async isPaused() {
      return new Promise(resolve => {
        const handler = e => {
          if (e.detail?.type === 'IsPaused') {
            window.removeEventListener('FromNode', handler)
            resolve(e.detail.paused)
          }
        }
        window.addEventListener('FromNode', handler)
        window.postMessage({ type: 'IsPaused' }, '*')
        setTimeout(() => { window.removeEventListener('FromNode', handler); resolve(true) }, 500)
      })
    },
    seek(ms)  { window.postMessage({ type: 'SEEK',  time: ms }, '*') },
    play()    { window.postMessage({ type: 'PLAY'  }, '*') },
    pause()   { window.postMessage({ type: 'PAUSE' }, '*') },
    showControls() { window.postMessage({ type: 'ShowControls' }, '*') },
  },

  // ── YouTube — mirrors Teleparty exactly ─────────────────────────────────────
  // State is read from the raw HTML5 <video> element (.video-stream.html5-main-video)
  // directly from ISOLATED world — no postMessage round-trip needed for reads.
  // Commands (seek/play/pause) still go through the MAIN-world bridge.
  //
  // Key Teleparty findings:
  //   • getRawVideoElement() → .video-stream.html5-main-video for /watch
  //                           → #shorts-player .video-stream for /shorts/
  //   • nr() state: video.paused → PAUSED | readyState<4 → LOADING | else → PLAYING
  //   • setCurrentTime: wait 500ms post-seek then waitVideoDoneLoadingAsync
  //   • Drift threshold: 2500ms (Teleparty Pt() uses <=2500)
  youtube: {
    driftThreshold: DRIFT_THRESHOLD_YT,

    // Raw HTML5 video element — accessible from ISOLATED world
    get video() {
      const href = location.href
      if (href.includes('/watch'))
        return document.querySelector('.video-stream.html5-main-video')
      if (href.includes('/shorts/'))
        return document.querySelector('#shorts-player .video-stream.html5-main-video') ||
               document.querySelector('#shorts-player video')
      return null
    },

    // Synchronous reads — no round-trip to MAIN world
    getCurrentTime() { return (this.video?.currentTime ?? 0) * 1000 },
    isPaused()       { return this.video?.paused ?? true },
    // Teleparty nr(): readyState < 4 && !paused = buffering/loading (treat as PLAYING intent)
    isLoading()      { const v = this.video; return !!v && !v.paused && v.readyState < 4 },

    // Wait for video to finish loading — Teleparty's waitVideoDoneLoadingAsync()
    async waitForLoaded(timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const v = this.video
        if (v && (v.paused || v.readyState >= 4)) return  // paused or fully loaded
        await new Promise(r => setTimeout(r, 50))
      }
    },

    // Commands go to MAIN world (youtube-main.js)
    async seek(ms) {
      window.dispatchEvent(new CustomEvent('YoutubeVideoMessage', {
        detail: { type: 'seekTo', seekTo: ms / 1000 }
      }))
      // Teleparty: yield Oi(500)() → yield this.waitVideoDoneLoadingAsync()
      await new Promise(r => setTimeout(r, 500))
      await this.waitForLoaded(5000)
    },
    play()  { window.dispatchEvent(new CustomEvent('YoutubeVideoMessage', { detail: { type: 'playVideo'  } })) },
    pause() { window.dispatchEvent(new CustomEvent('YoutubeVideoMessage', { detail: { type: 'pauseVideo' } })) },
  },

  // Standard HTML5 <video> — Disney+, Prime Video, Hiranda app
  standard: {
    driftThreshold: 1000,
    get video() { return document.querySelector('video') },
    getCurrentTime() { return (this.video?.currentTime ?? 0) * 1000 },
    isPaused()       { return this.video?.paused ?? true },
    seek(ms)         { if (this.video) this.video.currentTime = ms / 1000 },
    play()           { return this.video?.play() },
    pause()          { return this.video?.pause() },
  },
}

const A = PLATFORM === 'netflix' ? adapter.netflix
        : PLATFORM === 'youtube' ? adapter.youtube
        : adapter.standard

// ── Inject Netflix MAIN-world script ─────────────────────────────────────────
// Note: youtube-main.js is declared in manifest content_scripts (world:MAIN),
// so it does NOT need manual injection here. Netflix is also manifest-injected
// but we keep this fallback for reliability on older Chrome versions.
function injectNetflixScript() {
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL('netflix-main.js')
  s.setAttribute('tpInjected', '')
  ;(document.head || document.documentElement).appendChild(s)
  s.remove()
}

// ── Teleparty's bn() — sync decision ─────────────────────────────────────────
// Compares LOCAL player state against reconstructed remote position (zn()).
// On/Pn/In must be updated BEFORE calling this so zn() reflects remote state.
// Uses adapter.driftThreshold: 2500ms for YouTube, 1000ms for Netflix/standard.
//
// Event-driven threshold:
//   'pause' / 'seek' → 10ms  (host explicitly set an exact frame — match it precisely)
//   'play'           → DRIFT (play position drifts forward, normal threshold is fine)
//   'heartbeat'      → DRIFT (steady-state correction, avoid churn when close)
async function bn(sessionData, force = false) {
  const actions = []
  // sessionData is always normalised by the time bn() is called (position + triggeredAt)
  if (sessionData.position == null || sessionData.triggeredAt == null || !sessionData.state) {
    return actions
  }

  const DRIFT = A.driftThreshold ?? DRIFT_THRESHOLD

  // For an explicit pause or seek: use a near-zero threshold so we always land on the
  // exact frame the host froze at, regardless of where the guest's player currently sits.
  // Play and heartbeat use the normal drift window to avoid choppy corrections.
  const ev = sessionData.event
  const effectiveDrift = (ev === 'pause' || ev === 'seek') ? 10 : DRIFT

  // Skip if paused at the very start of content (< 500ms) and not forced.
  // 500ms is a fixed small epsilon — intentionally NOT scaled by DRIFT_THRESHOLD,
  // which was the previous bug (2500ms threshold on YouTube was suppressing too much).
  if (!force && sessionData.state === 'PAUSED' && sessionData.position < 500) {
    return actions
  }

  // Reconstructed current remote position (using updated On/Pn/In + NTP offset)
  const remoteNow = zn()

  // Read actual local player state — synchronous for YouTube/standard, async for Netflix
  let localTime, localPaused
  try {
    localTime   = await A.getCurrentTime()
    localPaused = await A.isPaused()
  } catch {
    return actions  // Can't read player — skip this cycle
  }

  // If YouTube is currently buffering, treat as PLAYING (video is trying to play)
  if (PLATFORM === 'youtube' && A.isLoading?.()) {
    localPaused = false
  }

  const localState = localPaused ? 'PAUSED' : 'PLAYING'

  const drift = Math.abs(localTime - remoteNow)

  // Already in sync — nothing to do (only skip when not forced)
  if (!force && localState === sessionData.state && drift < effectiveDrift) return actions

  // On force (first-join sync): use a tiny epsilon (50ms) so we always position
  // exactly — don't let the full drift threshold suppress an initial seek.
  const seekThreshold = force ? 50 : effectiveDrift
  if (drift >= seekThreshold) actions.push('SEEK')
  if (localState !== sessionData.state) {
    actions.push(sessionData.state === 'PLAYING' ? 'PLAY' : 'PAUSE')
  }
  return actions
}

// ── Apply remote state (after receiving updateSession) ────────────────────────
let _applyQueue = Promise.resolve()
function applyRemoteState(sessionData, force = false) {
  _applyQueue = _applyQueue.then(async () => {
    let incremented = false
    try {
      // Update remote state tracker FIRST so zn() reconstructs current host position.
      // Accept both new field names (position / triggeredAt) and legacy ones for
      // backward compat with any old client still using lastKnownTime / lastKnownTimeUpdatedAt.
      On = sessionData.position    ?? sessionData.lastKnownTime
      Pn = sessionData.triggeredAt ?? sessionData.lastKnownTimeUpdatedAt
      In = sessionData.state

      const actions = await bn(sessionData, force)
      if (actions.length === 0) return

      // Capture seek target NOW before any async ops shift zn()
      const seekTarget = zn()

      uiEventsHappening++
      incremented = true
      for (const action of actions) {
        if (action === 'SEEK')  await A.seek(seekTarget)
        if (action === 'PLAY')  await A.play()
        if (action === 'PAUSE') await A.pause()
      }
      uiEventsHappening--
      incremented = false

      // Notify chat overlay so it can show a sync toast.
      // Only fires when a real adjustment was made (actions is non-empty).
      window.dispatchEvent(new CustomEvent('HirandaSyncAction', {
        detail: {
          event:    sessionData.event || 'heartbeat',  // 'pause'|'play'|'seek'|'heartbeat'
          position: seekTarget,                         // ms we synced to
          actions,                                      // ['SEEK','PAUSE'] etc.
        }
      }))
    } catch (e) {
      console.log('[Hiranda] applyRemoteState error:', e)
      if (incremented) uiEventsHappening = Math.max(0, uiEventsHappening - 1)
    }
  })
}

// ── broadcast: capture position + timestamp, send to all peers ───────────────
// triggeredAt — server-normalized ms timestamp of the ACTION that caused the
//   broadcast (captured before any async reads so it reflects the true moment
//   the user pressed play/pause/seeked, not when the async read completed).
//   Callers that already have it pass it in; heartbeat / force calls omit it
//   and the current moment is used as the default.
// force=true bypasses the uiEventsHappening guard (used for new-guest sync).
// eventType — 'play' | 'pause' | 'seek' | 'heartbeat'
//   Tells receivers exactly what action triggered this broadcast so they can:
//   (a) apply the appropriate drift threshold (10ms for pause/seek → exact frame)
//   (b) show a labelled sync toast ("Host paused", "Host resumed", etc.)
async function broadcast(force = false, triggeredAt = null, eventType = 'heartbeat') {
  if (!partyId || !channel) return
  if (!force && uiEventsHappening > 0) return

  // Lock in the action timestamp BEFORE any async player reads.
  // For event-driven calls (play/pause/seeked), triggeredAt is passed in from
  // the event handler — that's as close to the real action moment as possible.
  // For heartbeat/force calls we use right now.
  const actionAt = triggeredAt ?? (Date.now() - un)

  try {
    // YouTube: getCurrentTime/isPaused read raw DOM directly — no round-trip
    // Netflix: async postMessage handled by adapter
    const time   = await A.getCurrentTime()
    const paused = await A.isPaused()
    const payload = {
      position:    Math.round(time),        // video position in ms at moment of action
      triggeredAt: actionAt,                // server-normalised UTC wall-clock ms of the action
      state:       paused ? 'PAUSED' : 'PLAYING',
      event:       eventType,               // 'play'|'pause'|'seek'|'heartbeat'
    }
    await channel.send({ type: 'broadcast', event: 'sync', payload })
  } catch (e) {
    console.log('[Hiranda] broadcast error:', e)
  }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(async () => {
    if (isHost) await broadcast()
  }, HEARTBEAT_MS)
}
function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
}

// ── Attach video element events ───────────────────────────────────────────────
// Shared helper: attach play/pause/seeked to a raw <video> element if not already done.
// triggeredAt is captured synchronously at the instant the DOM event fires —
// before broadcast()'s async player reads — so the timestamp reflects the true
// moment of the user action, not when we finished reading state.
function attachVideoEvents(vid) {
  if (!vid || vid._hirandaListeners) return
  vid._hirandaListeners = true
  const guard = () => uiEventsHappening > 0 || !isHost || !channel
  // Capture timestamp synchronously at event fire — before any async reads in broadcast().
  // Pass explicit event type so receivers can apply the correct drift threshold and toast label.
  vid.addEventListener('play',   () => { if (guard()) return; broadcast(false, Date.now() - un, 'play') })
  vid.addEventListener('pause',  () => { if (guard()) return; broadcast(false, Date.now() - un, 'pause') })
  vid.addEventListener('seeked', () => { if (guard()) return; broadcast(false, Date.now() - un, 'seek') })
}

// ── Local player event listeners ─────────────────────────────────────────────
// Guard: only attach once. Old listeners stay active and read current module-level
// isHost / uiEventsHappening / channel on each fire, so they self-manage across
// leave/rejoin cycles without needing to be re-added.
function attachLocalListeners() {
  if (localListenersAttached) return
  localListenersAttached = true

  if (PLATFORM === 'netflix') {
    // Netflix: keep UpdateState listener for forwards-compat / future use.
    // (Nothing currently sends GetState, so this is a no-op for now.)
    window.addEventListener('FromNode', e => {
      if (e.detail?.type !== 'UpdateState') return
      if (uiEventsHappening > 0 || !isHost || !channel) return
      // Infer event type from reported state so receivers get the right drift threshold.
      // updatedAt is Date.now() in local time — subtract un to get server-normalised ms
      const evType = e.detail.state === 'PAUSED' ? 'pause' : 'play'
      broadcast(false, (e.detail.updatedAt ?? Date.now()) - un, evType)
    })

    // Primary: attach to the raw <video> element — Netflix's internal player still
    // drives a standard HTML5 <video>. This gives the host the same immediacy as
    // YouTube/standard: play/pause/seeked fire broadcast() instantly instead of
    // waiting up to HEARTBEAT_MS (4 s) for the next heartbeat tick.
    // uiEventsHappening suppresses echoes from our own sync commands.
    const getVid = () => document.querySelector('video')
    moRef = new MutationObserver(() => { attachVideoEvents(getVid()) })
    moRef.observe(document, { childList: true, subtree: true })
    attachVideoEvents(getVid())

  } else if (PLATFORM === 'youtube') {
    // YouTube: read state directly from raw <video> element (.video-stream.html5-main-video)
    // This matches Teleparty's getRawVideoElement() + nr() approach exactly.
    // MutationObserver catches the element when it appears (and new elements after SPA nav).
    const getVid = () => A.video  // uses adapter's getter (handles /watch vs /shorts/)

    moRef = new MutationObserver(() => { attachVideoEvents(getVid()) })
    moRef.observe(document, { childList: true, subtree: true })
    attachVideoEvents(getVid())  // try immediately

    // SPA navigation: youtube-main.js dispatches FromNode{type:'SpaNavigated'}
    // on yt-navigate-finish. Re-attach listeners to any new video element.
    window.addEventListener('FromNode', e => {
      if (e.detail?.type !== 'SpaNavigated') return
      // Clear listener flag so MO can re-attach to the new/reset video element
      const vid = getVid()
      if (vid) delete vid._hirandaListeners
      attachVideoEvents(getVid())
      // Host should broadcast immediately so guest knows new video state
      if (isHost && channel) setTimeout(() => broadcast(), 1000)
    })

  } else {
    // Standard video element (Disney+, Prime, Hiranda)
    const getVid = () => document.querySelector('video')

    moRef = new MutationObserver(() => { attachVideoEvents(getVid()) })
    moRef.observe(document, { childList: true, subtree: true })
    attachVideoEvents(getVid())
  }
}

// ── Join / create party ───────────────────────────────────────────────────────
async function joinParty(id, host = false) {
  if (channel) channel.unsubscribe()
  partyId = id
  isHost  = host

  // Reset per-session sync state
  hasReceivedFirstSync = false
  _applyQueue = Promise.resolve()

  await syncClock()
  if (ntpTimer) clearInterval(ntpTimer)
  ntpTimer = setInterval(syncClock, NTP_INTERVAL_MS)

  channel = supabase.channel(`party:${partyId}`, { config: { broadcast: { self: false } } })

  // ── Receive remote sync state ──────────────────────────────────────────────
  // Normalise the payload at the channel boundary so the rest of the pipeline
  // always works with { position, triggeredAt, state, event } regardless of whether
  // the sender is on the new or legacy field names.
  // force-apply the FIRST payload so the initial seek fires regardless of threshold.
  channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
    if (isHost) return  // host is authoritative — never apply remote state to itself
    const normalised = {
      position:    payload.position    ?? payload.lastKnownTime,
      triggeredAt: payload.triggeredAt ?? payload.lastKnownTimeUpdatedAt,
      state:       payload.state,
      event:       payload.event       ?? 'heartbeat',  // 'play'|'pause'|'seek'|'heartbeat'
    }
    const force = !hasReceivedFirstSync
    hasReceivedFirstSync = true
    applyRemoteState(normalised, force)
  })

  // ── requestSync — guest asks for immediate state ───────────────────────────
  // Bug fix: gives the guest a second mechanism to pull state if the presence
  // handler response raced ahead of its subscription window.
  channel.on('broadcast', { event: 'requestSync' }, () => {
    if (isHost && channel) broadcast(true)
  })

  // ── Chat messages → forward to chat overlay ────────────────────────────────
  channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
    window.dispatchEvent(new CustomEvent('HirandaChatMsg', { detail: payload }))
  })

  // ── Reactions → forward to overlay ────────────────────────────────────────
  channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
    window.dispatchEvent(new CustomEvent('HirandaReaction', { detail: payload }))
  })

  // ── Presence (join/leave with identity) ───────────────────────────────────
  // Bug fix: when host sees a new guest join, immediately broadcast current state
  // so the guest doesn't have to wait up to HEARTBEAT_MS (4s) for the next tick.
  channel.on('broadcast', { event: 'presence' }, ({ payload }) => {
    if (isHost && payload.type === 'join' && channel) {
      // Small delay (200ms) to give the guest's channel subscription time to settle
      // before the sync payload arrives. force=true bypasses uiEventsHappening guard.
      setTimeout(() => broadcast(true), 200)
    }
    window.dispatchEvent(new CustomEvent('HirandaPresence', { detail: payload }))
  })

  await channel.subscribe()

  // Read local profile then announce join with identity
  const stored = await chrome.storage.local.get(['hpNickname', 'hpIcon'])
  const selfName = stored.hpNickname || 'Guest'
  const selfIcon = stored.hpIcon    || 'General/Popcorn.svg'

  await channel.send({
    type: 'broadcast', event: 'presence',
    payload: { type: 'join', isHost, username: selfName, userIcon: selfIcon, ts: Date.now() }
  })

  // Bug fix: guest explicitly requests sync state 500ms after subscribing.
  // Belt-and-suspenders alongside the host's presence-triggered broadcast —
  // handles the race where the host's response arrived before we subscribed.
  if (!isHost) {
    setTimeout(async () => {
      if (channel && partyId) {
        await channel.send({ type: 'broadcast', event: 'requestSync', payload: { ts: Date.now() } })
      }
    }, 500)
  }

  if (isHost) startHeartbeat()
  attachLocalListeners()

  // Notify chat overlay
  window.dispatchEvent(new CustomEvent('HirandaPartyJoined', { detail: { partyId, isHost } }))
}

async function leaveParty() {
  if (!channel) return
  const stored = await chrome.storage.local.get(['hpNickname', 'hpIcon'])
  const selfName = stored.hpNickname || 'Guest'
  const selfIcon = stored.hpIcon    || 'General/Popcorn.svg'
  await channel.send({
    type: 'broadcast', event: 'presence',
    payload: { type: 'leave', username: selfName, userIcon: selfIcon, ts: Date.now() }
  })
  channel.unsubscribe()
  channel = null
  partyId = null
  stopHeartbeat()
  if (ntpTimer) { clearInterval(ntpTimer); ntpTimer = null }

  // Reset per-session sync state so a rejoin starts clean
  hasReceivedFirstSync = false
  _applyQueue = Promise.resolve()

  window.dispatchEvent(new CustomEvent('HirandaPartyLeft'))
}

// ── Chat send ────────────────────────────────────────────────────────────────
async function sendChatMessage(content, username, userIcon) {
  if (!channel) return
  await channel.send({
    type: 'broadcast', event: 'chat',
    payload: { content, username, userIcon, ts: Date.now() }
  })
}

// ── Reaction send ─────────────────────────────────────────────────────────────
async function sendReaction(reactionType) {
  if (!channel) return
  await channel.send({
    type: 'broadcast', event: 'reaction',
    payload: { reactionType, ts: Date.now() }
  })
}

// ── Messages from service worker / popup ──────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'JOIN_PARTY') {
    joinParty(msg.partyId, msg.isHost).then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg.type === 'LEAVE_PARTY') {
    leaveParty().then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg.type === 'SEND_CHAT') {
    sendChatMessage(msg.content, msg.username, msg.userIcon).then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg.type === 'SEND_REACTION') {
    sendReaction(msg.reactionType).then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg.type === 'GET_PARTY_STATE') {
    sendResponse({ partyId, isHost, inParty: !!channel })
    return false
  }
  if (msg.type === 'UPDATE_PROFILE') {
    // Re-broadcast presence with updated identity
    if (channel) {
      channel.send({
        type: 'broadcast', event: 'presence',
        payload: {
          type: 'update',
          username: msg.username || 'Guest',
          userIcon: msg.userIcon || 'General/Popcorn.svg',
          isHost,
          ts: Date.now(),
        }
      })
    }
    sendResponse({ ok: true })
    return false
  }
})

// ── Chat/reaction events from chat.js (same ISOLATED world, same tab) ────────
window.addEventListener('HirandaSendChat', e => {
  const { content, username, userIcon } = e.detail
  sendChatMessage(content, username, userIcon)
})

window.addEventListener('HirandaSendReaction', e => {
  sendReaction(e.detail.reactionType)
})

// ── Auto-join from URL hash (#hp=PARTY_ID) ────────────────────────────────────
function checkUrlHash() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const id = hash.get('hp')
  if (id && !partyId) {
    // Small delay to let the page load
    setTimeout(() => joinParty(id, false), 2000)
  }
}

// ── Platform-specific injection ───────────────────────────────────────────────
// Netflix MAIN world script — inject via script tag as a belt-and-suspenders
// fallback (manifest also injects it at document_start).
// YouTube MAIN world script is purely manifest-managed (no injection needed here).
if (PLATFORM === 'netflix') injectNetflixScript()

// Run
checkUrlHash()

// Auto-rejoin from stored party state (handles page reload / SPA navigation).
// checkUrlHash() covers the guest-via-share-link case; this covers everything else:
//   - host refreshing the tab mid-party
//   - guest navigating between pages on the same site
//   - any reload where the SW still holds a valid partyId
// The `if (partyId) return` guard prevents a double-join if checkUrlHash already fired.
;(async () => {
  // Give checkUrlHash's 2 s setTimeout a chance to set partyId first if both
  // apply (shouldn't happen in practice, but be defensive).
  if (partyId) return
  const state = await new Promise(r =>
    chrome.runtime.sendMessage({ type: 'GET_PARTY_STATE' }, r))
  if (state?.partyId && !partyId) {
    await joinParty(state.partyId, state.isHost)
  }
})()
