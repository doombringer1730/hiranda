// Hiranda in-page chat overlay — shadow DOM, isolated world
// Handles chat + emoji reactions on every supported streaming page

let inParty   = false
let panelOpen = false
let unread    = 0
let myId      = null
let myName    = 'You'
let msgCount  = 0

// ── Shadow DOM ────────────────────────────────────────────────────────────────

const host = document.createElement('div')
host.id = 'hiranda-overlay-host'
;(document.body || document.documentElement).appendChild(host)
const shadow = host.attachShadow({ mode: 'open' })

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Reaction float layer — covers full viewport, pointer-events: none */
#rx-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483646;
  overflow: hidden;
}

/* Toggle tab */
#toggle {
  display: none;
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  background: rgba(12, 10, 9, 0.88);
  border: 1px solid #44302a;
  border-right: none;
  border-radius: 10px 0 0 10px;
  padding: 14px 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2147483647;
  transition: background 0.15s;
  user-select: none;
}
#toggle:hover { background: rgba(30, 20, 12, 0.96); }
.hi-logo { font-family: Georgia, serif; font-size: 15px; color: #d97706; line-height: 1; }
#unread-dot {
  display: none;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e34248, #bc4d7a 57%, #9e55a0);
}

/* Panel */
#panel {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 320px;
  background: rgba(10, 8, 7, 0.93);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-left: 1px solid #2c2320;
  display: flex;
  flex-direction: column;
  z-index: 2147483647;
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #fef3c7;
}
#panel.open {
  transform: translateX(0);
  pointer-events: auto;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border-bottom: 1px solid #1f1816;
  flex-shrink: 0;
  background: rgba(0,0,0,0.25);
  gap: 8px;
}
.header-left { display: flex; align-items: center; gap: 7px; min-width: 0; }
.header-dot  { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
#header-label {
  font-size: 12px; color: #a8a29e; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.close-btn {
  background: none; border: none; color: #57534e; cursor: pointer;
  font-size: 18px; line-height: 1; padding: 4px 6px; border-radius: 6px;
  transition: color 0.15s, background 0.15s; flex-shrink: 0;
}
.close-btn:hover { color: #fef3c7; background: #292524; }

/* Messages */
#messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
#messages::-webkit-scrollbar { width: 3px; }
#messages::-webkit-scrollbar-track { background: transparent; }
#messages::-webkit-scrollbar-thumb { background: #3d3330; border-radius: 2px; }

.msg-system {
  text-align: center; font-size: 11px; color: #57534e;
  padding: 3px 0; font-style: italic;
}
.msg { display: flex; flex-direction: column; max-width: 82%; gap: 2px; }
.msg-me   { align-self: flex-end;   align-items: flex-end; }
.msg-them { align-self: flex-start; align-items: flex-start; }
.msg-sender { font-size: 10px; color: #78716c; padding: 0 8px; }
.bubble {
  display: inline-block; padding: 7px 12px; border-radius: 16px;
  font-size: 13px; line-height: 1.4; word-break: break-word; max-width: 100%;
}
.msg-me   .bubble { background: #92400e; color: #fef3c7; border-radius: 16px 16px 4px 16px; }
.msg-them .bubble { background: #1c1917; color: #e7e5e4; border: 1px solid #2c2320; border-radius: 16px 16px 16px 4px; }
.bubble-rx { background: none !important; border: none !important; padding: 3px 4px !important; font-size: 28px; line-height: 1; }

/* Reactions row */
.reactions-row {
  display: flex; justify-content: space-around;
  padding: 7px 12px; border-top: 1px solid #1a1513;
  background: rgba(0,0,0,0.18); flex-shrink: 0;
}
.rx-btn {
  background: none; border: none; font-size: 20px; cursor: pointer;
  padding: 6px 4px; border-radius: 8px; line-height: 1;
  transition: transform 0.1s, background 0.15s;
}
.rx-btn:hover  { background: #29211e; transform: scale(1.25); }
.rx-btn:active { transform: scale(0.9); }

/* Input row */
.input-row {
  display: flex; padding: 10px 12px; gap: 0;
  border-top: 1px solid #1f1816; flex-shrink: 0;
  background: rgba(0,0,0,0.2);
}
#chat-input {
  flex: 1;
  background: #1c1917; border: 1px solid #2c2320;
  border-radius: 20px 0 0 20px; padding: 8px 14px;
  color: #fef3c7; font-size: 13px; outline: none; font-family: inherit;
  transition: border-color 0.15s;
}
#chat-input::placeholder { color: #57534e; }
#chat-input:focus { border-color: #78350f; }
#send-btn {
  background: #b45309; border: none; border-radius: 0 20px 20px 0;
  padding: 8px 14px; color: #fef3c7; font-size: 15px;
  cursor: pointer; transition: background 0.15s;
}
#send-btn:hover { background: #d97706; }

/* Floating reactions */
.rx-float {
  position: absolute; bottom: 0; font-size: 48px; line-height: 1; pointer-events: none;
}
.rx-float-1 { animation: rx-rise 4.0s ease-out forwards; }
.rx-float-2 { animation: rx-rise 5.0s ease-out forwards; }
.rx-float-3 { animation: rx-rise 3.5s ease-out forwards; }
@keyframes rx-rise {
  0%   { opacity: 0; transform: translateY(0) scale(0.6); }
  12%  { opacity: 1; transform: translateY(-50px) scale(1.1); }
  75%  { opacity: 0.85; }
  100% { opacity: 0; transform: translateY(-80vh) scale(0.7); }
}
`

const HTML = `
<div id="rx-layer"></div>
<div id="toggle">
  <span class="hi-logo">H</span>
  <span id="unread-dot"></span>
</div>
<div id="panel">
  <div class="panel-header">
    <div class="header-left">
      <span class="header-dot"></span>
      <span id="header-label">Hiranda Party</span>
    </div>
    <button class="close-btn" id="close-btn">×</button>
  </div>
  <div id="messages"></div>
  <div class="reactions-row">
    <button class="rx-btn" data-emoji="❤️">❤️</button>
    <button class="rx-btn" data-emoji="😂">😂</button>
    <button class="rx-btn" data-emoji="😮">😮</button>
    <button class="rx-btn" data-emoji="😭">😭</button>
    <button class="rx-btn" data-emoji="🔥">🔥</button>
    <button class="rx-btn" data-emoji="👏">👏</button>
  </div>
  <div class="input-row">
    <input id="chat-input" type="text" placeholder="Say something…" maxlength="500" autocomplete="off">
    <button id="send-btn">↑</button>
  </div>
</div>
`

shadow.innerHTML = `<style>${CSS}</style>${HTML}`

// ── Element refs ──────────────────────────────────────────────────────────────

const panel       = shadow.getElementById('panel')
const toggleTab   = shadow.getElementById('toggle')
const rxLayer     = shadow.getElementById('rx-layer')
const msgsEl      = shadow.getElementById('messages')
const chatInput   = shadow.getElementById('chat-input')
const headerLabel = shadow.getElementById('header-label')
const unreadDot   = shadow.getElementById('unread-dot')

// ── Panel open / close ────────────────────────────────────────────────────────

function openPanel() {
  panelOpen = true
  unread = 0
  unreadDot.style.display = 'none'
  toggleTab.style.display = 'none'
  panel.classList.add('open')
  chatInput.focus()
  scrollBottom()
}

function closePanel() {
  panelOpen = false
  panel.classList.remove('open')
  if (inParty) toggleTab.style.display = 'flex'
}

function scrollBottom() {
  msgsEl.scrollTop = msgsEl.scrollHeight
}

// ── Party lifecycle ───────────────────────────────────────────────────────────

function startParty(userId, username) {
  inParty = true
  myId    = userId
  myName  = username || 'You'
  toggleTab.style.display = 'flex'
  addSystem('Party started · Ctrl+Shift+H to chat')
}

function endParty() {
  inParty   = false
  panelOpen = false
  panel.classList.remove('open')
  toggleTab.style.display = 'none'
  msgsEl.innerHTML = ''
  msgCount = 0
  unread = 0
}

// ── Messages ──────────────────────────────────────────────────────────────────

function addSystem(text) {
  const div = document.createElement('div')
  div.className = 'msg-system'
  div.textContent = text
  appendMsg(div)
}

function addChat(fromId, senderName, text) {
  const isMe = fromId === myId
  const wrap = document.createElement('div')
  wrap.className = `msg ${isMe ? 'msg-me' : 'msg-them'}`
  if (!isMe) {
    const s = document.createElement('span')
    s.className = 'msg-sender'
    s.textContent = senderName || 'Partner'
    wrap.appendChild(s)
  }
  const bubble = document.createElement('span')
  bubble.className = 'bubble'
  bubble.textContent = text
  wrap.appendChild(bubble)
  appendMsg(wrap)
  if (!panelOpen) bumpUnread()
}

function addReaction(fromId, emoji) {
  const isMe = fromId === myId
  const wrap = document.createElement('div')
  wrap.className = `msg ${isMe ? 'msg-me' : 'msg-them'}`
  const bubble = document.createElement('span')
  bubble.className = 'bubble bubble-rx'
  bubble.textContent = emoji
  wrap.appendChild(bubble)
  appendMsg(wrap)
  spawnFloat(emoji)
  if (!panelOpen) bumpUnread()
}

function appendMsg(el) {
  msgsEl.appendChild(el)
  msgCount++
  // Keep at most 60 messages in DOM
  if (msgCount > 60) {
    msgsEl.removeChild(msgsEl.firstChild)
    msgCount = 60
  }
  scrollBottom()
  // Auto-open panel on first incoming message while closed
  if (!panelOpen && inParty) {
    openPanel()
  }
}

function bumpUnread() {
  unread++
  unreadDot.style.display = 'block'
}

// ── Floating emoji ────────────────────────────────────────────────────────────

function spawnFloat(emoji) {
  const el = document.createElement('div')
  el.className = `rx-float rx-float-${Math.floor(Math.random() * 3) + 1}`
  el.textContent = emoji
  el.style.left = `${Math.floor(Math.random() * 70 + 5)}%`
  rxLayer.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

// ── Send ──────────────────────────────────────────────────────────────────────

function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return
  chatInput.value = ''
  if (!ctxOk()) return
  chrome.runtime.sendMessage({ type: 'SEND_CHAT', text })
  addChat(myId, myName, text)
}

function sendReaction(emoji) {
  if (!ctxOk()) return
  chrome.runtime.sendMessage({ type: 'SEND_REACTION', emoji })
  addReaction(myId, emoji)
}

function ctxOk() { try { return !!chrome.runtime?.id } catch (_) { return false } }

// ── Event listeners ───────────────────────────────────────────────────────────

toggleTab.addEventListener('click', () => { if (inParty) openPanel() })
shadow.getElementById('close-btn').addEventListener('click', closePanel)

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
})
shadow.getElementById('send-btn').addEventListener('click', sendChat)

shadow.querySelectorAll('.rx-btn').forEach(btn => {
  btn.addEventListener('click', () => sendReaction(btn.dataset.emoji))
})

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
    if (!inParty) return
    e.preventDefault()
    panelOpen ? closePanel() : openPanel()
  }
}, { capture: true })

// ── Chrome message handler ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case 'PARTY_STARTED':
      startParty(msg.userId, msg.username)
      break
    case 'PARTY_ENDED':
      endParty()
      break
    case 'CHAT_MESSAGE':
      addChat(msg.payload.from, msg.payload.username, msg.payload.text)
      break
    case 'REACTION_MESSAGE':
      addReaction(msg.payload.from, msg.payload.emoji)
      break
  }
})

// Restore overlay if already in a party when page loads
chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, res => {
  if (res?.sessionId) startParty(res.userId, res.username)
})
