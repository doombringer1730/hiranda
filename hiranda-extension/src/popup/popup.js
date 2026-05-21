const HIRANDA_URL = 'https://hiranda-616i.vercel.app'
const TMDB_KEY = '1483ba76994a6e42ea695e3ea04382f9'

const PLATFORM_LABELS = {
  netflix: 'Netflix', youtube: 'YouTube', disney: 'Disney+',
  prime: 'Prime Video', max: 'Max', hulu: 'Hulu',
  appletv: 'Apple TV+', paramount: 'Paramount+',
}

const SUPPORTED = ['Netflix', 'YouTube', 'Disney+', 'Prime Video', 'Max', 'Hulu', 'Apple TV+', 'Paramount+']

function detectPlatform(url) {
  if (!url) return null
  if (/netflix\.com\/watch/.test(url))          return 'netflix'
  if (/youtube\.com\/watch/.test(url))          return 'youtube'
  if (/disneyplus\.com/.test(url))              return 'disney'
  if (/amazon\.com|primevideo\.com/.test(url))  return 'prime'
  if (/play\.max\.com/.test(url))               return 'max'
  if (/hulu\.com\/watch/.test(url))             return 'hulu'
  if (/tv\.apple\.com/.test(url))               return 'appletv'
  if (/paramountplus\.com/.test(url))           return 'paramount'
  return null
}

function cleanTitle(raw) {
  if (!raw) return 'Untitled'
  let t = raw
  t = t.replace(/\s*[|–—]\s*(Netflix|YouTube|Prime Video|Amazon Prime Video|Disney\+|Hulu|Max|Apple TV\+|Paramount\+|HBO Max).*$/i, '')
  t = t.replace(/\s+-\s+YouTube$/i, '')
  t = t.replace(/^Watch\s+/i, '')
  t = t.replace(/\s*[:|–-]\s*Season\s+\d+.*$/i, '')
  t = t.replace(/\s*[:|–-]\s*Episode\s+\d+.*$/i, '')
  return t.trim() || 'Untitled'
}

function extractSessionId(input) {
  const match = (input || '').match(/party\/([0-9a-f-]{36})/i)
  if (match) return match[1]
  if (/^[0-9a-f-]{36}$/.test((input || '').trim())) return input.trim()
  return null
}

async function fetchPoster(title) {
  try {
    const q = encodeURIComponent(title)
    const base = `https://api.themoviedb.org/3`
    const r1 = await fetch(`${base}/search/movie?query=${q}&api_key=${TMDB_KEY}`)
    const d1 = await r1.json()
    if (d1.results?.[0]?.poster_path) return `https://image.tmdb.org/t/p/w500${d1.results[0].poster_path}`
    const r2 = await fetch(`${base}/search/tv?query=${q}&api_key=${TMDB_KEY}`)
    const d2 = await r2.json()
    if (d2.results?.[0]?.poster_path) return `https://image.tmdb.org/t/p/w500${d2.results[0].poster_path}`
  } catch (_) {}
  return null
}

// Send a message to the background service worker
function send(type, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...data }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      resolve(res)
    })
  })
}

// ── State machine ──
let view = 'loading'
let d = {} // state data

const root = document.getElementById('root')

function render() {
  if (view === 'loading') {
    root.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
    return
  }

  if (view === 'auth') {
    root.innerHTML = `
      <div class="header">
        <div class="logo">H</div>
        <div>
          <div class="brand">Hiranda Party</div>
          <div class="brand-sub">Sign in to get started</div>
        </div>
      </div>
      <div class="body">
        ${d.error ? `<div class="error">${esc(d.error)}</div>` : ''}
        <form id="auth-form" class="form">
          <input id="email" type="email" placeholder="Email" class="input" autocomplete="email" required>
          <input id="pass"  type="password" placeholder="Password" class="input" autocomplete="current-password" required>
          <button type="submit" class="btn-primary" ${d.loading ? 'disabled' : ''}>
            ${d.loading ? '<span class="spinner-sm"></span>&nbsp;Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    `
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value.trim()
      const pass  = document.getElementById('pass').value
      d = { loading: true }
      render()
      const res = await send('SIGN_IN', { email, password: pass })
      if (res.error) { d = { error: res.error }; render() }
      else await boot()
    })
    return
  }

  if (view === 'idle') {
    const { user, platform, tabTitle } = d
    const platformLabel = platform ? (PLATFORM_LABELS[platform] || platform) : null
    const onSite = !!platform

    root.innerHTML = `
      <div class="header">
        <div class="logo">H</div>
        <div>
          <div class="brand">Hiranda Party</div>
          <div class="brand-sub" title="${esc(user.email)}">${esc(user.email)}</div>
        </div>
        <button id="sign-out" class="btn-ghost" title="Sign out">↩</button>
      </div>
      <div class="body">
        ${onSite ? `
          <div class="platform-row">
            <span class="platform-dot"></span>
            <span class="platform-label">${esc(platformLabel)}</span>
            ${tabTitle ? `<span class="tab-title">${esc(tabTitle)}</span>` : ''}
          </div>
          ${d.startError ? `<div class="error">${esc(d.startError)}</div>` : ''}
          <button id="start-btn" class="btn-primary" ${d.starting ? 'disabled' : ''}>
            ${d.starting ? '<span class="spinner-sm"></span>&nbsp;Starting…' : '🎬&nbsp;Start Party'}
          </button>
          <div class="divider-label">or join one</div>
        ` : `
          <div class="no-platform">
            <div class="no-platform-icon">🎬</div>
            <p class="no-platform-text">Open a supported streaming site to start a watch party.</p>
            <div class="platforms-list">
              ${SUPPORTED.map(p => `<span class="platform-chip">${esc(p)}</span>`).join('')}
            </div>
          </div>
          <div class="divider-label">join a party</div>
        `}
        <div class="join-row">
          <input id="join-input" type="text" placeholder="Paste invite link…" class="input input-sm">
          <button id="join-btn" class="btn-secondary">Join</button>
        </div>
        ${d.joinError ? `<div class="error">${esc(d.joinError)}</div>` : ''}
      </div>
    `

    document.getElementById('sign-out').addEventListener('click', async () => {
      await send('SIGN_OUT')
      view = 'auth'; d = {}; render()
    })

    if (onSite) {
      document.getElementById('start-btn').addEventListener('click', async () => {
        d = { ...d, starting: true, startError: null }
        render()
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const title = cleanTitle(tab.title)
        const thumbnailUrl = await fetchPoster(title)
        const res = await send('CREATE_SESSION', { title, platform, partyUrl: tab.url, thumbnailUrl, tabId: tab.id })
        if (res.error) {
          d = { ...d, starting: false, startError: res.error }
          render()
        } else {
          view = 'party'
          d = { sessionId: res.sessionId, title, platform, user: d.user }
          render()
        }
      })
    }

    document.getElementById('join-btn').addEventListener('click', async () => {
      const input = document.getElementById('join-input').value.trim()
      const sessionId = extractSessionId(input)
      if (!sessionId) { d = { ...d, joinError: 'Invalid link — paste the full Hiranda party URL' }; render(); return }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const res = await send('JOIN_SESSION', { sessionId, tabId: tab.id })
      if (res.error) { d = { ...d, joinError: res.error }; render(); return }
      view = 'party'
      d = { sessionId, title: res.title, platform: res.platform, user: d.user }
      render()
    })
    return
  }

  if (view === 'party') {
    const { sessionId, title, platform, user, isHost } = d
    const platformLabel = platform ? (PLATFORM_LABELS[platform] || platform) : null
    const link = `${HIRANDA_URL}/party/${sessionId}`

    root.innerHTML = `
      <div class="header">
        <div class="logo active">H</div>
        <div>
          <div class="brand">Hiranda Party</div>
          <div class="brand-sub"><span class="party-dot"></span>In a party</div>
        </div>
        <button id="sign-out" class="btn-ghost" title="Sign out">↩</button>
      </div>
      <div class="body">
        <div class="session-card">
          <div class="session-title">${esc(title || 'Party session')}</div>
          <div class="session-meta">
            ${platformLabel ? `<span class="platform-badge">${esc(platformLabel)}</span>` : ''}
            <span class="role-badge ${isHost ? 'role-host' : 'role-guest'}">${isHost ? 'Host' : 'Guest'}</span>
          </div>
        </div>
        ${!isHost ? `<p class="guest-hint">Your partner controls playback. Sit back and enjoy.</p>` : ''}
        <div class="divider-label">invite link</div>
        <div class="invite-row">
          <span class="invite-link">${esc(link)}</span>
          <button id="copy-btn" class="btn-copy">Copy</button>
        </div>
        <p class="invite-hint">Your partner opens this in Hiranda or pastes it here.</p>
        <button id="leave-btn" class="btn-danger">Leave party</button>
      </div>
    `

    document.getElementById('copy-btn').addEventListener('click', async () => {
      await navigator.clipboard.writeText(link)
      const btn = document.getElementById('copy-btn')
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { if (btn) btn.textContent = 'Copy' }, 2000) }
    })

    document.getElementById('leave-btn').addEventListener('click', async () => {
      await send('LEAVE_SESSION')
      await boot()
    })

    document.getElementById('sign-out').addEventListener('click', async () => {
      await send('SIGN_OUT')
      view = 'auth'; d = {}; render()
    })
  }
}

// Escape HTML to prevent injection via tab titles etc.
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

async function boot() {
  view = 'loading'; render()

  const auth = await send('GET_AUTH')
  if (!auth.user) { view = 'auth'; d = {}; render(); return }

  if (auth.sessionId) {
    const status = await send('GET_SESSION_STATUS')
    view = 'party'
    d = { sessionId: auth.sessionId, title: '', platform: null, user: auth.user, isHost: status?.isHost ?? false }
    render()
    return
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const platform = detectPlatform(tab?.url)
  view = 'idle'
  d = { user: auth.user, platform, tabTitle: platform ? cleanTitle(tab?.title) : null }
  render()
}

boot()
