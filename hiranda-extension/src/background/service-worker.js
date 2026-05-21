import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nqmawsssiutarjylnmhg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xbWF3c3NzaXV0YXJqeWxubWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDYzODQsImV4cCI6MjA5NDU4MjM4NH0.MtuvqyUxeztP1scGTrebMKBaA6JjC2b0P1qARKmgPZw'

// ── Supabase ──────────────────────────────────────────────────────────────────

const chromeStorage = {
  getItem:    k => new Promise(r => chrome.storage.local.get(k, d => r(d[k] ?? null))),
  setItem:    (k, v) => chrome.storage.local.set({ [k]: v }),
  removeItem: k => chrome.storage.local.remove(k),
}

let _sb = null
function sb() {
  if (_sb) return _sb
  _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: chromeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })
  return _sb
}

// ── Session state ─────────────────────────────────────────────────────────────

let channel      = null
let sessionId    = null
let userId       = null
let activeTabId  = null
let isHost       = false

// Last authoritative state from host — used to snap guest back on divergence
let lastHostState = null

// NTP clock offset (local ms - partner ms), rolling median of 5 samples
let ntpSamples   = []
let clockOffsetMs = 0

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function log(...args) { console.log('[Hiranda SW]', ...args) }

// ── NTP ───────────────────────────────────────────────────────────────────────

function sendNtpPings() {
  let n = 0
  const id = setInterval(() => {
    if (!channel || n >= 5) { clearInterval(id); return }
    channel.send({ type: 'broadcast', event: 'ntp_ping', payload: { t0: Date.now(), from: userId } })
    n++
  }, 300)
}

// ── Channel ───────────────────────────────────────────────────────────────────

async function joinChannel(sid, uid, tabId, host) {
  if (channel) await sb().removeChannel(channel)

  sessionId   = sid
  userId      = uid
  isHost      = host
  ntpSamples  = []
  clockOffsetMs = 0
  if (tabId) activeTabId = tabId

  log('joining channel', sid, host ? '(host)' : '(guest)')

  channel = sb()
    .channel(`watch:${sid}`)

    // ── Sync ──
    .on('broadcast', { event: 'sync' }, ({ payload }) => {
      if (payload.from === userId) return
      log('sync received', payload.kind, payload.state, payload.position?.toFixed(1))

      // Apply network latency correction to position
      const delayMs = Math.max(0, Date.now() - payload.sentAt)
      const corrected = payload.state === 'playing'
        ? payload.position + (delayMs - clockOffsetMs) / 1000
        : payload.position

      const correctedPayload = { ...payload, position: corrected }

      // Store authoritative host state so we can snap guest back if they diverge
      lastHostState = correctedPayload

      sendToTab({ type: 'APPLY_SYNC', payload: correctedPayload })
    })

    // ── NTP ping (partner sent, we respond) ──
    .on('broadcast', { event: 'ntp_ping' }, ({ payload }) => {
      if (payload.from === userId) return
      channel.send({ type: 'broadcast', event: 'ntp_pong', payload: { t0: payload.t0, t1: Date.now(), from: userId } })
    })

    // ── NTP pong (we sent ping, partner responded) ──
    .on('broadcast', { event: 'ntp_pong' }, ({ payload }) => {
      if (payload.from === userId) return
      const rtt    = Date.now() - payload.t0
      const offset = Date.now() - payload.t1 - rtt / 2  // local - partner
      ntpSamples.push(offset)
      if (ntpSamples.length > 5) ntpSamples.shift()
      clockOffsetMs = median(ntpSamples)
      log('NTP offset updated:', clockOffsetMs, 'ms  rtt:', rtt, 'ms')
    })

    .subscribe((status, err) => {
      log('channel status:', status, err ?? '')
      if (status === 'SUBSCRIBED') {
        // Wait 1s for partner to also subscribe, then ping
        setTimeout(sendNtpPings, 1000)
      }
    })

  await chrome.storage.local.set({ session_id: sid, user_id: uid, is_host: host })
}

async function leaveChannel() {
  if (channel) { await sb().removeChannel(channel); channel = null }
  sessionId   = null
  userId      = null
  isHost      = false
  ntpSamples  = []
  clockOffsetMs = 0
  await chrome.storage.local.remove(['session_id', 'is_host'])
  log('left channel')
}

async function ensureChannel() {
  if (channel) return
  const { data: { user } } = await sb().auth.getUser()
  if (!user) return
  const s = await chrome.storage.local.get(['session_id', 'active_tab_id', 'is_host'])
  if (s.session_id) {
    log('rejoining after SW restart')
    await joinChannel(s.session_id, user.id, s.active_tab_id ?? null, s.is_host ?? false)
  }
}

// ── Tab messaging ─────────────────────────────────────────────────────────────

async function sendToTab(msg) {
  let tid = activeTabId
  if (!tid) {
    const s = await chrome.storage.local.get('active_tab_id')
    tid = s.active_tab_id ?? null
  }
  if (!tid) { log('no active tab'); return }
  chrome.tabs.sendMessage(tid, msg).catch(e => log('sendMessage error:', e.message))
}

// ── Keepalive port (prevents MV3 SW termination while in party) ───────────────

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'keepalive') return
  ensureChannel()
  port.onDisconnect.addListener(() => {})
})

// ── SPA navigation: reinit content script adapter after URL change ─────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== activeTabId || !sessionId) return
  if (changeInfo.url) {
    log('SPA navigation detected, reiniting adapter')
    setTimeout(() => chrome.tabs.sendMessage(tabId, { type: 'REINIT_ADAPTER' }).catch(() => {}), 1500)
  }
})

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse).catch(e => sendResponse({ error: e.message }))
  return true
})

async function handle(msg, sender) {
  switch (msg.type) {

    case 'GET_AUTH': {
      const { data: { user } } = await sb().auth.getUser()
      const s = await chrome.storage.local.get('session_id')
      return { user: user ? { id: user.id, email: user.email } : null, sessionId: s.session_id ?? null }
    }

    case 'SIGN_IN': {
      const { data, error } = await sb().auth.signInWithPassword({ email: msg.email, password: msg.password })
      if (error) return { error: error.message }
      log('signed in:', data.user.email)
      return { user: { id: data.user.id, email: data.user.email } }
    }

    case 'SIGN_OUT': {
      await sb().auth.signOut()
      await leaveChannel()
      _sb = null
      return { ok: true }
    }

    case 'REGISTER_TAB': {
      if (sender.tab?.id) {
        activeTabId = sender.tab.id
        await chrome.storage.local.set({ active_tab_id: activeTabId })
        log('registered tab:', activeTabId)
      }
      return { ok: true }
    }

    case 'CREATE_SESSION': {
      const { data: { user } } = await sb().auth.getUser()
      if (!user) return { error: 'Not signed in' }

      const { data, error } = await sb().from('watch_sessions').insert({
        title:        msg.title,
        source_type:  'party',
        platform:     msg.platform ?? null,
        party_url:    msg.partyUrl ?? null,
        thumbnail_url: msg.thumbnailUrl ?? null,
        storage_path: '',
        created_by:   user.id,
      }).select().single()

      if (error || !data) return { error: error?.message ?? 'Failed to create session' }

      await joinChannel(data.id, user.id, msg.tabId ?? null, true)
      if (msg.tabId) chrome.tabs.sendMessage(msg.tabId, { type: 'PARTY_STARTED' }).catch(() => {})
      log('session created:', data.id)
      return { sessionId: data.id }
    }

    case 'JOIN_SESSION': {
      const { data: { user } } = await sb().auth.getUser()
      if (!user) return { error: 'Not signed in' }

      const { data, error } = await sb().from('watch_sessions')
        .select('id, title, platform')
        .eq('id', msg.sessionId)
        .eq('source_type', 'party')
        .single()

      if (error || !data) return { error: 'Party session not found' }

      // tabId from popup message, or sender tab when auto-joining from content script URL param
      const tabId = msg.tabId ?? sender.tab?.id ?? null
      await joinChannel(data.id, user.id, tabId, false)
      if (tabId) chrome.tabs.sendMessage(tabId, { type: 'PARTY_STARTED' }).catch(() => {})
      log('joined session:', data.id, 'tab:', tabId)
      return { ok: true, title: data.title, platform: data.platform }
    }

    case 'LEAVE_SESSION': {
      if (activeTabId) chrome.tabs.sendMessage(activeTabId, { type: 'PARTY_ENDED' }).catch(() => {})
      await leaveChannel()
      return { ok: true }
    }

    case 'SYNC_ACTION': {
      await ensureChannel()
      if (!channel || !userId) return { ok: false }

      const { kind } = msg.payload

      // Only host broadcasts play/pause/seek — prevents oscillation.
      // Either partner can broadcast buffering events.
      if (!isHost && kind !== 'buffering' && kind !== 'resume') return { ok: true }

      if (sender.tab?.id) {
        activeTabId = sender.tab.id
        chrome.storage.local.set({ active_tab_id: activeTabId })
      }

      log('broadcasting', kind, msg.payload.state, msg.payload.position?.toFixed(1))

      channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: { ...msg.payload, from: userId },
      })

      // Persist state to DB on action events (not every heartbeat)
      if (kind === 'action') {
        await sb().from('watch_sessions').update({
          state: msg.payload.state,
          playback_position_seconds: msg.payload.position,
          last_updated_by: userId,
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId)
      }

      return { ok: true }
    }

    case 'GET_SESSION_STATUS': {
      await ensureChannel()
      return { sessionId, connected: !!channel, isHost }
    }
  }
}

// ── Startup: rejoin active session after browser restart ──────────────────────

chrome.runtime.onStartup.addListener(async () => {
  const { data: { user } } = await sb().auth.getUser()
  if (!user) return
  const s = await chrome.storage.local.get(['session_id', 'active_tab_id', 'is_host'])
  if (s.session_id) {
    log('rejoining on startup')
    await joinChannel(s.session_id, user.id, s.active_tab_id ?? null, s.is_host ?? false)
  }
})
