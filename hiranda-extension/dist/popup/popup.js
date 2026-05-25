// Hiranda Watch Party — Popup Script
// Manages party create/join/leave UI

;(async function () {
  'use strict'

  const SUPPORTED_PATTERNS = [
    /^https:\/\/www\.netflix\.com\/watch\//,
    /^https:\/\/www\.youtube\.com\/watch/,
    /^https:\/\/www\.disneyplus\.com\//,
    /^https:\/\/www\.amazon\.com\//,
    /^https:\/\/www\.primevideo\.com\//,
  ]

  function isSupported(url) {
    if (!url) return false
    return SUPPORTED_PATTERNS.some(p => p.test(url))
  }

  // ── Screen management ──────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.hp-screen').forEach(el => el.classList.remove('active'))
    document.getElementById(id)?.classList.add('active')
  }

  // ── Get active tab ─────────────────────────────────────────────────────────
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab
  }

  // ── Send message to service worker ─────────────────────────────────────────
  function sw(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  }

  // ── Member count (read from Supabase presence via content script) ──────────
  async function getMemberCount(tabId) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: 'GET_PARTY_STATE' })
      return resp?.memberCount ?? 1
    } catch {
      return 1
    }
  }

  // ── Init: check tab + party state ─────────────────────────────────────────
  async function init() {
    const tab = await getActiveTab()
    const state = await sw({ type: 'GET_PARTY_STATE' })

    // If in a party, register this tab as active
    if (state.partyId) {
      await sw({ type: 'SET_ACTIVE_TAB', tabId: tab?.id })
    }

    // Unsupported page + no active party
    if (!isSupported(tab?.url) && !state.partyId) {
      showScreen('screen-unsupported')
      return
    }

    if (!state.partyId) {
      showScreen('screen-noparty')
      return
    }

    // Party is active
    if (state.isHost) {
      showHostScreen(state, tab)
    } else {
      showGuestScreen(state, tab)
    }

    // Mark read
    await sw({ type: 'MARK_READ' })
  }

  function buildPartyUrl(tabUrl, partyId) {
    const base = tabUrl?.split('#')[0] || ''
    return `${base}#hp=${partyId}`
  }

  function showHostScreen(state, tab) {
    showScreen('screen-host')
    const partyUrl = buildPartyUrl(tab?.url, state.partyId)
    document.getElementById('host-code').textContent = state.partyId
    document.getElementById('host-link').textContent = partyUrl
    document.getElementById('host-link').title = partyUrl

    // Update member count from presence
    if (tab?.id) {
      getMemberCount(tab.id).then(count => {
        document.getElementById('host-member-count').textContent =
          count === 1 ? '1 member' : `${count} members`
      })
    }
  }

  function showGuestScreen(state, tab) {
    showScreen('screen-guest')
    document.getElementById('guest-code').textContent = state.partyId

    if (tab?.id) {
      getMemberCount(tab.id).then(count => {
        document.getElementById('guest-member-count').textContent =
          count === 1 ? '1 member' : `${count} members`
      })
    }
  }

  // ── Button: Start Party ────────────────────────────────────────────────────
  document.getElementById('btn-create').addEventListener('click', async () => {
    const btn = document.getElementById('btn-create')
    btn.disabled = true
    btn.textContent = 'Starting…'

    try {
      const tab = await getActiveTab()
      if (!isSupported(tab?.url)) {
        alert('Please open a supported streaming site first (Netflix, YouTube, Disney+, or Prime Video).')
        btn.disabled = false
        btn.textContent = '▶ Start Party'
        return
      }

      // Register tab as active first
      await sw({ type: 'SET_ACTIVE_TAB', tabId: tab.id })

      const result = await sw({ type: 'CREATE_PARTY', tabId: tab.id })
      if (result.error) throw new Error(result.error)

      showHostScreen(result, tab)

      // Directly tell the content script to join as host.
      // The SW relay already did this, but sending it again from the popup
      // guarantees delivery: if the SW's sendMessage raced with document_idle
      // the retry (1.5 s) would have covered it, but this makes it synchronous
      // with the popup still open. base.js's joinParty() is idempotent — it
      // unsubscribes any old channel before re-subscribing, so double-calling
      // is safe.
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type:      'JOIN_PARTY',
          partyId:   result.partyId,
          isHost:    true,
          userId:    result.userId,
          username:  result.username,
          userIcon:  result.userIcon,
        })
      } catch {}

      // Auto-copy link
      const partyUrl = buildPartyUrl(tab.url, result.partyId)
      try {
        await navigator.clipboard.writeText(partyUrl)
      } catch {}

    } catch (err) {
      console.error('Create party error:', err)
      btn.disabled = false
      btn.textContent = '▶ Start Party'
    }
  })

  // ── Button: Join Party ─────────────────────────────────────────────────────
  document.getElementById('btn-join').addEventListener('click', async () => {
    const codeInput = document.getElementById('input-code')
    const errorEl = document.getElementById('join-error')
    const code = codeInput.value.trim().toUpperCase()

    errorEl.textContent = ''

    if (!code || code.length < 4) {
      errorEl.textContent = 'Please enter a valid party code.'
      return
    }

    const btn = document.getElementById('btn-join')
    btn.disabled = true
    btn.textContent = 'Joining…'

    try {
      const tab = await getActiveTab()
      if (!isSupported(tab?.url)) {
        errorEl.textContent = 'Please open a supported streaming site first.'
        btn.disabled = false
        btn.textContent = 'Join Party'
        return
      }

      await sw({ type: 'SET_ACTIVE_TAB', tabId: tab.id })
      const result = await sw({ type: 'JOIN_PARTY', partyId: code, tabId: tab.id })
      if (result.error) throw new Error(result.error)

      showGuestScreen(result, tab)

    } catch (err) {
      console.error('Join party error:', err)
      errorEl.textContent = 'Failed to join party. Check the code and try again.'
      btn.disabled = false
      btn.textContent = 'Join Party'
    }
  })

  // Allow Enter key in code input
  document.getElementById('input-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join').click()
  })

  // ── Button: Copy Link ──────────────────────────────────────────────────────
  document.getElementById('btn-copy').addEventListener('click', async () => {
    const linkEl = document.getElementById('host-link')
    const btn = document.getElementById('btn-copy')
    const url = linkEl.textContent

    try {
      await navigator.clipboard.writeText(url)
      btn.textContent = 'Copied!'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = 'Copy'
        btn.classList.remove('copied')
      }, 2000)
    } catch {}
  })

  // ── Button: End Party ──────────────────────────────────────────────────────
  document.getElementById('btn-end').addEventListener('click', async () => {
    const btn = document.getElementById('btn-end')
    btn.disabled = true
    btn.textContent = 'Ending…'

    try {
      await sw({ type: 'LEAVE_PARTY' })
      showScreen('screen-noparty')
    } catch (err) {
      console.error('End party error:', err)
      btn.disabled = false
      btn.textContent = 'End Party'
    }
  })

  // ── Button: Leave Party ────────────────────────────────────────────────────
  document.getElementById('btn-leave').addEventListener('click', async () => {
    const btn = document.getElementById('btn-leave')
    btn.disabled = true
    btn.textContent = 'Leaving…'

    try {
      await sw({ type: 'LEAVE_PARTY' })
      showScreen('screen-noparty')
    } catch (err) {
      console.error('Leave party error:', err)
      btn.disabled = false
      btn.textContent = 'Leave Party'
    }
  })

  // ── Run init ───────────────────────────────────────────────────────────────
  await init()
})()
