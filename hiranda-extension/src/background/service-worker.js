import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nqmawsssiutarjylnmhg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xbWF3c3NzaXV0YXJqeWxubWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDYzODQsImV4cCI6MjA5NDU4MjM4NH0.MtuvqyUxeztP1scGTrebMKBaA6JjC2b0P1qARKmgPZw'

// chrome.storage.local adapter — service workers have no localStorage
const chromeStorage = {
  getItem:    (key) => new Promise(r => chrome.storage.local.get(key, d => r(d[key] ?? null))),
  setItem:    (key, val) => chrome.storage.local.set({ [key]: val }),
  removeItem: (key) => chrome.storage.local.remove(key),
}

let _sb = null
function getSupabase() {
  if (_sb) return _sb
  _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: chromeStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  return _sb
}

let channel = null
let currentSessionId = null
let currentUserId = null
let activeTabId = null

async function joinChannel(sessionId, userId, tabId) {
  const sb = getSupabase()
  if (channel) await sb.removeChannel(channel)

  currentSessionId = sessionId
  currentUserId = userId
  if (tabId) activeTabId = tabId

  channel = sb
    .channel(`watch:${sessionId}`)
    .on('broadcast', { event: 'sync' }, async ({ payload }) => {
      console.log('[Hiranda SW] broadcast received from:', payload.from, 'me:', userId)
      if (payload.from === userId) return
      let tid = activeTabId
      if (!tid) {
        const stored = await chrome.storage.local.get('active_tab_id')
        tid = stored.active_tab_id ?? null
      }
      console.log('[Hiranda SW] sending APPLY_SYNC to tab:', tid)
      if (tid) chrome.tabs.sendMessage(tid, { type: 'APPLY_SYNC', payload }).catch((e) => console.error('[Hiranda SW] sendMessage error:', e))
    })
    .subscribe((status, err) => {
      console.log('[Hiranda SW] channel status:', status, err ?? '')
    })

  await chrome.storage.local.set({ session_id: sessionId, user_id: userId })
}

async function leaveChannel() {
  const sb = getSupabase()
  if (channel) { await sb.removeChannel(channel); channel = null }
  currentSessionId = null
  currentUserId = null
  await chrome.storage.local.remove(['session_id'])
}

// Rejoin the Supabase channel if the service worker was terminated and lost in-memory state.
// MV3 service workers are ephemeral — channel is null after any idle termination.
async function ensureChannel() {
  if (channel) return
  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return
  const stored = await chrome.storage.local.get(['session_id', 'active_tab_id'])
  if (stored.session_id) {
    console.log('[Hiranda SW] rejoining channel after termination')
    await joinChannel(stored.session_id, user.id, stored.active_tab_id ?? null)
  }
}

// Keep service worker alive via persistent port from content scripts.
// Port held open = SW stays alive. Disconnect = SW may terminate.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'keepalive') return
  // Rejoin channel on reconnect (covers page reloads mid-party)
  ensureChannel()
  port.onDisconnect.addListener(() => {})
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse).catch(err => sendResponse({ error: err.message }))
  return true // async response
})

async function handle(msg, sender) {
  const sb = getSupabase()

  switch (msg.type) {
    case 'GET_AUTH': {
      const { data: { user } } = await sb.auth.getUser()
      const stored = await chrome.storage.local.get(['session_id'])
      return {
        user: user ? { id: user.id, email: user.email } : null,
        sessionId: stored.session_id ?? null,
      }
    }

    case 'SIGN_IN': {
      const { data, error } = await sb.auth.signInWithPassword({ email: msg.email, password: msg.password })
      if (error) return { error: error.message }
      return { user: { id: data.user.id, email: data.user.email } }
    }

    case 'SIGN_OUT': {
      await sb.auth.signOut()
      await leaveChannel()
      _sb = null
      return { ok: true }
    }

    case 'REGISTER_TAB': {
      if (sender.tab?.id) {
        activeTabId = sender.tab.id
        await chrome.storage.local.set({ active_tab_id: activeTabId })
      }
      return { ok: true }
    }

    case 'CREATE_SESSION': {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return { error: 'Not signed in' }

      const { data, error } = await sb.from('watch_sessions').insert({
        title: msg.title,
        source_type: 'party',
        platform: msg.platform ?? null,
        party_url: msg.partyUrl ?? null,
        thumbnail_url: msg.thumbnailUrl ?? null,
        storage_path: '',
        created_by: user.id,
      }).select().single()

      if (error || !data) return { error: error?.message ?? 'Failed to create session' }

      await joinChannel(data.id, user.id, msg.tabId ?? null)
      if (msg.tabId) {
        chrome.tabs.sendMessage(msg.tabId, { type: 'PARTY_STARTED' }).catch(() => {})
      }
      return { sessionId: data.id }
    }

    case 'JOIN_SESSION': {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return { error: 'Not signed in' }

      const { data, error } = await sb.from('watch_sessions')
        .select('id, title, platform')
        .eq('id', msg.sessionId)
        .eq('source_type', 'party')
        .single()

      if (error || !data) return { error: 'Party session not found' }

      await joinChannel(data.id, user.id, msg.tabId ?? null)
      if (msg.tabId) {
        chrome.tabs.sendMessage(msg.tabId, { type: 'PARTY_STARTED' }).catch(() => {})
      }
      return { ok: true, title: data.title, platform: data.platform }
    }

    case 'LEAVE_SESSION': {
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'PARTY_ENDED' }).catch(() => {})
      }
      await leaveChannel()
      return { ok: true }
    }

    case 'SYNC_ACTION': {
      await ensureChannel()
      if (!channel || !currentUserId) return { ok: false }
      if (sender.tab?.id) activeTabId = sender.tab.id
      console.log('[Hiranda SW] broadcasting', msg.payload?.kind, msg.payload?.state)
      channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: { ...msg.payload, from: currentUserId },
      })
      // Persist state on action events (not heartbeats — too many writes)
      if (msg.payload.kind === 'action') {
        await sb.from('watch_sessions').update({
          state: msg.payload.state,
          playback_position_seconds: msg.payload.position,
          last_updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        }).eq('id', currentSessionId)
      }
      return { ok: true }
    }

    case 'GET_SESSION_STATUS': {
      await ensureChannel()
      return { sessionId: currentSessionId, connected: !!channel }
    }
  }
}

// Rejoin active session after browser restart / service worker cold start
chrome.runtime.onStartup.addListener(async () => {
  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return
  const stored = await chrome.storage.local.get(['session_id', 'active_tab_id'])
  if (stored.session_id) {
    await joinChannel(stored.session_id, user.id, stored.active_tab_id ?? null)
  }
})
