"use strict";
(() => {
  // src/content/chat.js
  (function() {
    "use strict";
    if (document.getElementById("hiranda-party-host"))
      return;
    let userNickname = "Guest";
    let userIcon = "General/Popcorn.svg";
    let chatOpen = false;
    let unreadCount = 0;
    let partyId = null;
    let isHost = false;
    let partnerName = null;
    let partnerOnline = false;
    let partnerLastSeen = 0;
    let presencePollRef = null;
    let partyStartTime = 0;
    let timerRef = null;
    const ICONS = [
      "General/Batman.svg",
      "General/DeadPool.svg",
      "General/CptAmerica.svg",
      "General/Wolverine.svg",
      "General/IronMan.svg",
      "General/Goofy.svg",
      "General/Alien.svg",
      "General/Mulan.svg",
      "General/Snow-White.svg",
      "General/Poohbear.svg",
      "General/Sailormoon.svg",
      "General/Sailor Cat.svg",
      "General/Pizza.svg",
      "General/Cookie.svg",
      "General/Chocobar.svg",
      "General/hotdog.svg",
      "General/Hamburger.svg",
      "General/Popcorn.svg",
      "General/IceCream.svg",
      "General/ChickenLeg.svg"
    ];
    const REACTIONS = [
      { id: "heart", gif: "heart/heart.gif", static: "heart/heart_static.svg" },
      { id: "angry", gif: "angry/angry.gif", static: "angry/angry_static.svg" },
      { id: "cry", gif: "cry/cry.gif", static: "cry/cry_static.svg" },
      { id: "laugh", gif: "laugh/laugh.gif", static: "laugh/laugh_static.svg" },
      { id: "surprise", gif: "surprise/surprise.gif", static: "surprise/surprise_static.svg" },
      { id: "fire", gif: "fire/fire.gif", static: "fire/fire_static.svg" }
    ];
    const imgUrl = (path) => chrome.runtime.getURL(`img/${path}`);
    const reactionButtons = REACTIONS.map((r) => `
    <button class="tp-reaction-btn" data-reaction="${r.id}">
      <img class="tp-reaction-static" src="${imgUrl("reactions/" + r.static)}" />
      <img class="tp-reaction-gif"    src="${imgUrl("reactions/" + r.gif)}" />
    </button>`).join("");
    const CHAT_HTML = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root, :host {
    --base-width: 8px;
    --chat-width: calc(var(--base-width) * 42.5);

    /* \u2500\u2500 Hiranda roast palette \u2500\u2500 */
    --roast-950: #0e0804;
    --roast-900: #1a1008;
    --roast-800: #2d1f0e;
    --roast-700: #3d2c14;
    --roast-600: #54391a;

    /* \u2500\u2500 Amber accents \u2500\u2500 */
    --amber-glow:  #c8842a;
    --amber-light: #e8a040;
    --amber-dim:   #8a5a1a;

    /* \u2500\u2500 Parchment text \u2500\u2500 */
    --parchment-100: #f5efe6;
    --parchment-200: #ede4d4;
    --parchment-300: #d9ccb8;
    --parchment-muted: #a08060;
    --parchment-dim:   #7a6045;

    /* \u2500\u2500 Teleparty compat aliases (keep for any refs we haven't migrated) \u2500\u2500 */
    --base-red:    var(--amber-glow);
    --active-red:  var(--amber-light);
    --gradient-1:  linear-gradient(135deg, var(--amber-light), var(--amber-glow));
    --base-white:  var(--parchment-100);
    --white-10:    var(--parchment-200);
    --white-15:    var(--parchment-300);
    --white-20:    var(--parchment-300);
    --white-25:    var(--parchment-muted);
    --white-30:    var(--parchment-muted);
    --white-35:    var(--parchment-dim);
    --base-black:  var(--roast-900);
    --black-5:     var(--roast-600);
    --black-10:    var(--roast-700);
    --black-15:    var(--roast-800);
    --black-20:    #261a0c;
    --black-25:    #1e1408;
    --black-30:    var(--roast-950);
    --regular: 400; --medium: 500; --semi-bold: 600; --bold: 700;
  }

  /* Floating toggle button strip (when chat is closed) \u2014 Teleparty: #tp-buttons-container */
  /* Hidden initially \u2014 shown only when inside an active party and chat is minimized */
  #tp-buttons-container {
    width: 50px; right: 30px; top: 50px;
    position: fixed; z-index: 9999;
    background-color: rgba(14, 8, 4, 0.75);
    display: none; flex-direction: column; align-items: center;
    border-radius: 4px; transition: transform 1s;
    border: 1px solid rgba(61, 44, 20, 0.6);
    padding: 0;
  }
  #tp-icon-container {
    margin: 5px; width: 40px; height: 40px;
    display: flex; justify-content: center; align-items: center;
    border-radius: 4.8px; cursor: pointer;
  }
  #tp-icon-container:hover { background: var(--roast-800); }
  #tp-icon-container img { width: 24px; height: 24px; }
  #tp-message-indicator {
    background: linear-gradient(135deg, var(--amber-light), var(--amber-glow));
    width: 10px; height: 10px; border-radius: 50%;
    position: absolute; top: 10px; right: 12px;
    display: none;
  }

  /* Chat wrapper \u2014 Teleparty: #chat-wrapper */
  #chat-wrapper {
    width: var(--chat-width); height: 100%;
    position: fixed; top: 0; right: 0; bottom: 0; left: auto;
    z-index: 9999999999;
    background: var(--roast-900);
    display: flex; flex-direction: column;
    transition: width 0.2s linear;
    font-family: Inter, sans-serif;
    cursor: auto; user-select: text;
    border-left: 1px solid var(--roast-700);
  }

  /* Grain texture on chat panel */
  #chat-wrapper::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.045;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='250'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='250' height='250' filter='url(%23n)'/></svg>");
    background-repeat: repeat;
  }
  #chat-wrapper.hidden { display: none !important; }

  /* Video overlay (reactions land here) */
  .video-overlay {
    width: calc(100vw - var(--chat-width)); height: 100%;
    position: fixed; top: 0; left: 0; right: auto; bottom: 0;
    pointer-events: none; z-index: 9999999999;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 2px; }
  ::-webkit-scrollbar-thumb { background: var(--amber-glow); border-radius: 10px; }

  /* Header */
  #chat-header-container { padding: 20px; border-bottom: 1px solid var(--roast-700); flex-shrink: 0; }
  #chat-menu-container {
    display: flex; flex-flow: row wrap;
    justify-content: space-between; align-items: center;
    padding-bottom: 10px; list-style: none;
  }
  .extension-title {
    font-family: 'Playfair Display', Georgia, serif; font-weight: 700;
    background: linear-gradient(135deg, var(--amber-light), var(--amber-glow));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    font-size: 17px; letter-spacing: 0.2px;
  }
  #function-user { display: flex; align-items: center; gap: 10px; }
  #user-count-holder {
    display: flex; align-items: center; gap: 4px;
    background: var(--roast-800); border-radius: 4px;
    padding: 0 10px; height: 28px; cursor: pointer;
  }
  #user-count-holder img { width: 12px; height: 12px; }
  .extension-txt { color: var(--parchment-300); font-size: 14px; font-family: Inter, sans-serif; font-weight: var(--regular); }
  .tooltip-holder { position: relative; cursor: pointer; }
  #link-icon img, #close-chat img { width: 18px; height: 18px; opacity: 0.5; transition: opacity 0.3s; }
  #link-icon:hover img, #close-chat:hover img { opacity: 1; }
  #close-chat { background: none; border: none; cursor: pointer; display: flex; align-items: center; }

  /* Leave party button */
  #leave-party-btn {
    height: 26px; padding: 0 9px; border-radius: 4px;
    border: 1px solid rgba(239, 106, 74, 0.35);
    background: rgba(239, 106, 74, 0.08);
    cursor: pointer; font-family: Inter, sans-serif;
    font-size: 11px; font-weight: var(--semi-bold);
    color: #ef6a4a; letter-spacing: 0.04em;
    text-transform: uppercase; transition: background 0.2s, border-color 0.2s;
    white-space: nowrap;
  }
  #leave-party-btn:hover {
    background: rgba(239, 106, 74, 0.2);
    border-color: rgba(239, 106, 74, 0.6);
  }
  #user-icon img { width: 34px; height: 34px; border-radius: 50%; cursor: pointer; transition: transform 0.3s; }
  #user-icon img:hover { transform: scale(1.05); }

  /* Tabs */
  #sidebar-tabs-container {
    display: flex; flex-direction: row; height: 40px;
    border-radius: 4px; overflow: hidden;
    background: var(--roast-950); margin-top: 10px;
  }
  .sidebar-tab {
    width: 50%; height: 100%;
    display: flex; justify-content: center; align-items: center;
    background: var(--roast-800); cursor: pointer; border: none;
    font-family: Inter, sans-serif; color: var(--parchment-300); font-size: 14px;
    gap: 5px; transition: background 0.2s;
  }
  .sidebar-tab img { width: 12px; height: 12px; }
  .sidebar-tab-inactive { opacity: 0.5; background: none !important; }
  .sidebar-active { opacity: 1; background: var(--roast-800) !important; }

  /* Icon picker */
  #chat-icon-container { display: none; padding-top: 10px; }
  #icon-title-container { padding-bottom: 10px; }
  .extension-description { font-family: Inter, sans-serif; font-weight: var(--medium); color: var(--parchment-200); font-size: 13px; }
  #icon-holder { display: flex; flex-wrap: wrap; list-style: none; padding: 0; }
  .image-button { width: 25%; padding: 2px; cursor: pointer; }
  .image-button img { width: 100%; height: auto; border-radius: 50%; transform: scale(0.95); transition: transform 0.3s; }
  .image-button img:hover { transform: scale(1); border: 2px solid var(--amber-light); }

  /* Nickname edit */
  #setting-edit { display: none; flex-direction: column; padding-top: 10px; }
  .nickname-section { display: flex; flex-direction: column; margin-top: 10px; }
  .nickname-section input {
    background: var(--roast-800); border: 1px solid var(--roast-700); border-radius: 4px;
    color: var(--parchment-100); padding: 8px 10px; width: 100%; margin-top: 5px;
    font-family: Inter, sans-serif;
  }
  #settings-save { display: none; padding-top: 10px; }
  .extension-btn {
    width: 100%; background: var(--amber-glow); color: var(--roast-950);
    padding: 10px 0; border-radius: 4px; border: none; cursor: pointer;
    font-family: Inter, sans-serif; font-weight: var(--semi-bold); font-size: 14px;
    display: flex; justify-content: center; transition: background 0.3s;
  }
  .extension-btn:hover { background: var(--amber-light); }
  .cancel-btn { background: none !important; border: 1px solid var(--amber-glow); color: var(--amber-light); margin-top: 6px; }

  /* Chat history */
  #chat-container {
    flex: 1; display: flex; flex-direction: column;
    overflow: hidden; padding: 0 20px 20px;
  }
  #chat-history-container {
    display: flex; flex-direction: column; justify-content: flex-end;
    flex: 1; min-height: 0; margin-bottom: 10px;
  }
  #chat-history { overflow-y: auto; overflow-x: hidden; width: 100%; padding-top: 10px; }

  /* Messages */
  .msg-container {
    display: flex; flex-flow: row wrap; align-items: flex-start;
    padding: 4px 6px; margin-bottom: 2px; border-radius: 4px; transition: background 0.3s;
  }
  .msg-container:hover { background: rgba(61, 44, 20, 0.5); }
  .tp-icon-name { width: 40px; margin-right: 5px; flex-shrink: 0; }
  .tp-icon-name img { width: 36px; height: 36px; }
  .msg-txt { display: flex; flex-direction: column; flex: 1; }
  .msg-txt h3 { font-family: Inter, sans-serif; font-weight: var(--medium); color: var(--parchment-100); font-size: 14px; }
  .msg-txt p { font-family: Inter, sans-serif; font-size: 14px; color: var(--parchment-200); word-break: break-word; white-space: pre-line; margin-top: 4px; }
  .message-system p { color: var(--parchment-muted); }
  .tpLogEventMessage { margin-bottom: 20px; font-size: 12px; color: var(--parchment-muted); }

  /* Input area */
  #chat-input-container {
    justify-content: space-between;
    background: var(--roast-800);
    border: 1.5px solid var(--roast-700);
    border-radius: 6px;
    padding: var(--base-width);
    padding-top: 0;
    width: calc(var(--base-width) * 34);
    position: relative; left: 50%; transform: translate(-50%);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  }
  #chat-input {
    overflow-x: hidden; overflow-y: auto;
    min-height: calc(var(--base-width) * 4);
    max-height: calc(var(--base-width) * 10);
    width: 100%; border: none !important;
    white-space: pre-wrap; word-break: break-word;
    overflow-wrap: break-word; line-height: 150%;
    margin-top: var(--base-width); outline: none;
    font-family: Inter, sans-serif; font-size: 14px; color: var(--parchment-300);
    background: transparent;
  }
  #chat-input:empty:before {
    display: block; color: var(--parchment-dim);
    content: attr(data-placeholder); pointer-events: none;
  }
  #chat-input::-webkit-scrollbar { display: none; }
  #bottom-chat-controls {
    width: 100%; height: calc(var(--base-width) * 4);
    display: flex; flex-direction: row-reverse; align-items: center;
  }
  #emoji-picker-btn, #gif-btn, #reaction-btn {
    height: 28px; width: 28px; border-radius: 4px; border: none;
    background: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  #emoji-picker-btn img, #gif-btn img, #reaction-btn img {
    width: 18px; height: 18px; opacity: 0.5; transition: opacity 0.2s;
  }
  #emoji-picker-btn:hover img, #gif-btn:hover img, #reaction-btn:hover img { opacity: 1; }
  #emoji-picker-btn:hover, #gif-btn:hover, #reaction-btn:hover { background: var(--roast-700); }

  /* Reaction buttons */
  #reaction-holder {
    display: none; position: relative; left: 50%; transform: translate(-50%);
    flex-direction: row; justify-content: space-around; align-items: center;
    width: calc(var(--base-width) * 34); height: calc(var(--base-width) * 6);
    padding: calc(var(--base-width) * 1); padding-top: 0;
    border-bottom: 1.5px solid var(--roast-700);
  }
  .tp-reaction-btn {
    width: calc(var(--base-width) * 4); height: calc(var(--base-width) * 4);
    border: none; background: none; cursor: pointer; border-radius: 4px;
    display: flex; justify-content: center; align-items: center;
    transition: all 0.2s;
  }
  .tp-reaction-btn:hover { background: var(--roast-700); }
  .tp-reaction-btn .tp-reaction-static { display: block; width: calc(var(--base-width)*3); height: calc(var(--base-width)*3); }
  .tp-reaction-btn .tp-reaction-gif { display: none; width: calc(var(--base-width)*4); height: calc(var(--base-width)*4); }
  .tp-reaction-btn:hover .tp-reaction-gif { display: block; }
  .tp-reaction-btn:hover .tp-reaction-static { display: none; }

  /* Presence indicator (typing) */
  #presence-indicator { display: flex; height: 24px; align-items: flex-end; font-family: Inter, sans-serif; }
  .extension-txt-indicator { color: var(--parchment-dim); font-size: 11px; }

  /* \u2500\u2500 Party status line (header) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  #party-status-line {
    display: none; flex-direction: row; align-items: center; gap: 5px;
    margin-top: 3px;
  }
  .partner-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    background: var(--parchment-dim);  /* default: gray / offline */
    transition: background 0.4s;
  }
  .partner-dot.online  { background: #5fc695; }
  .partner-dot.offline { background: var(--parchment-dim); }
  #watching-with {
    font-family: Inter, sans-serif; font-size: 11px;
    color: var(--parchment-muted); white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 140px;
  }
  #session-timer {
    font-family: Inter, sans-serif; font-size: 11px;
    color: var(--amber-dim); letter-spacing: 0.04em;
    margin-left: auto; display: none; flex-shrink: 0;
  }
  #function-title-inner {
    display: flex; justify-content: space-between; align-items: flex-start;
    flex: 1;
  }

  /* \u2500\u2500 Icon selected state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .image-button img.icon-selected {
    border: 2px solid var(--amber-glow) !important;
    transform: scale(1) !important;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(200, 132, 42, 0.5);
  }

  /* On-screen reaction animations \u2014 exact from Teleparty's overlay.css */
  :root { --reaction-size: 0px; }
  .video-overlay { width: calc(100vw - var(--chat-width)); height: 100%; position: fixed; top: 0; left: 0; right: auto; bottom: 0; pointer-events: none; z-index: 9999999999; }
  .on-screen-reaction { position: absolute; bottom: 0; font-size: 100px; z-index: 9999999999; }
  .on-screen-reaction-1 { animation: on-screen-reaction-slide 5s cubic-bezier(.5,1,.89,1) forwards, on-screen-reaction-1 12s cubic-bezier(.5,1,.89,1) forwards; }
  .on-screen-reaction-2 { animation: on-screen-reaction-slide 6s cubic-bezier(.5,1,.89,1) forwards, on-screen-reaction-2 12s cubic-bezier(.5,1,.89,1) forwards; }
  .on-screen-reaction-3 { animation: on-screen-reaction-slide 7s cubic-bezier(.5,1,.89,1) forwards, on-screen-reaction-3 12s cubic-bezier(.5,1,.89,1) forwards; }
  @keyframes on-screen-reaction-slide {
    0%   { opacity: 0; transform: translateY(calc(0 - var(--reaction-size))); }
    20%  { opacity: 0.8; } 30% { opacity: 0.8; } 90% { opacity: 0; }
    to   { transform: translateY(-100vh) translateX(-10px); opacity: 0; }
  }
  @keyframes on-screen-reaction-1 {
    10%{margin-left:-6px}25%{margin-left:4px}30%{margin-left:-5px}45%{margin-left:5px}
    55%{margin-left:-3px}60%{margin-left:5px}70%{margin-left:-5px}85%{margin-left:5px}
    90%{margin-left:-7px}to{margin-left:5px}
  }
  @keyframes on-screen-reaction-2 {
    15%{margin-left:-2px}20%{margin-left:5px}35%{margin-left:-6px}40%{margin-left:5px}
    50%{margin-left:-5px}65%{margin-left:5px}70%{margin-left:-5px}80%{margin-left:4px}
    95%{margin-left:-5px}to{margin-left:5px}
  }
  @keyframes on-screen-reaction-3 {
    15%{margin-left:-4px}20%{margin-left:5px}35%{margin-left:-2px}40%{margin-left:5px}
    50%{margin-left:-3px}65%{margin-left:5px}70%{margin-left:-5px}80%{margin-left:5px}
    95%{margin-left:-4px}to{margin-left:5px}
  }

  /* Sync toast \u2014 briefly visible on the video when a remote action is applied */
  #sync-toast {
    position: fixed;
    bottom: 72px;
    left: calc(50% - var(--chat-width) / 2);
    transform: translateX(-50%);
    background: rgba(14, 8, 4, 0.82);
    border: 1px solid rgba(200, 132, 42, 0.45);
    border-radius: 20px;
    padding: 5px 15px;
    color: var(--parchment-200);
    font-family: Inter, sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    pointer-events: none;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 9999999999;
  }
  #sync-toast.visible { opacity: 1; }
</style>

<!-- Floating toggle strip (shown when chat closed) -->
<div id="tp-buttons-container">
  <div id="tp-icon-container" title="Hiranda Watch Party">
    <img src="${chrome.runtime.getURL("icons/icon48.png")}" style="width:32px;height:32px;" />
  </div>
  <div id="tp-message-indicator"></div>
</div>

<!-- Video overlay (reactions and sync toasts spawn here) -->
<div class="video-overlay" id="video-overlay">
  <div id="sync-toast"></div>
</div>

<!-- Main chat wrapper -->
<div id="chat-wrapper" class="hidden">
  <div id="chat-header-container">
    <ul id="chat-menu-container">
      <li id="function-title" style="flex:1;min-width:0;">
        <div id="function-title-inner">
          <div style="min-width:0;">
            <p class="extension-title">Hiranda</p>
            <div id="party-status-line">
              <span class="partner-dot" id="partner-dot"></span>
              <span id="watching-with">Starting...</span>
            </div>
          </div>
          <span id="session-timer">00:00</span>
        </div>
      </li>
      <li id="function-user">
        <div id="user-count-holder" class="tooltip-holder" title="Member list">
          <img src="${chrome.runtime.getURL("img/Friends.svg")}" id="user-count-image" />
          <p class="extension-txt txt-white" id="user-count">1</p>
        </div>
        <div id="link-icon" class="tooltip-holder" title="Copy link">
          <img class="chat-link" src="${chrome.runtime.getURL("img/icon_link_active.svg")}" />
          <input id="share-url" type="text" readonly style="display:none;" />
        </div>
        <a id="user-icon" class="tooltip-holder" title="Change icon & nickname">
          <img src="${chrome.runtime.getURL("img/icons/General/Popcorn.svg")}" id="user-icon-img" />
        </a>
        <button id="leave-party-btn" title="Leave party">Leave</button>
        <button id="close-chat" title="Minimize Chat">
          <img src="${chrome.runtime.getURL("img/HideChat.svg")}" />
        </button>
      </li>
    </ul>

    <div id="sidebar-tabs-container">
      <button class="sidebar-tab sidebar-active" id="party-tab">
        <img src="${chrome.runtime.getURL("img/icon_chat_active.svg")}" />
        <p class="extension-txt txt-white">Party</p>
      </button>
      <button class="sidebar-tab sidebar-tab-inactive" id="icons-tab">
        <img src="${chrome.runtime.getURL("img/Friends.svg")}" />
        <p class="extension-txt">Settings</p>
      </button>
    </div>

    <!-- Icon picker -->
    <div id="chat-icon-container">
      <div id="icon-title-container">
        <p class="extension-description">Click to switch icon</p>
      </div>
      <div id="icon-holder-container" style="max-height:160px;overflow-y:auto;">
        <ul id="icon-holder">
          ${ICONS.map((icon) => `
            <li class="image-button" data-icon="${icon}">
              <img src="${chrome.runtime.getURL("img/icons/" + icon)}" title="${icon.split("/")[1].replace(".svg", "")}" />
            </li>`).join("")}
        </ul>
      </div>
      <div class="nickname-section">
        <p class="extension-description">Nickname</p>
        <input id="nickname-edit" type="text" placeholder="Enter nickname..." autocomplete="off" />
      </div>
      <div id="settings-save" style="display:block;margin-top:8px;">
        <button id="saveChanges" class="extension-btn">Save Changes</button>
        <button id="cancelNickname" class="extension-btn cancel-btn">Cancel</button>
      </div>
    </div>
  </div>

  <div id="chat-container">
    <div id="chat-history-container">
      <div id="chat-history"></div>
    </div>

    <!-- Reaction bar -->
    <div id="reaction-holder">
      ${reactionButtons}
    </div>

    <!-- Input box -->
    <div id="chat-input-container">
      <div id="chat-input" contenteditable="true" spellcheck="false"
        data-placeholder="Type a message..." role="textbox"></div>
      <div id="bottom-chat-controls">
        <button id="reaction-btn" title="Reactions">
          <img src="${chrome.runtime.getURL("img/reaction-popup.svg")}" />
        </button>
        <button id="emoji-picker-btn" title="Emoji">
          <img src="${chrome.runtime.getURL("img/emoji_picker.svg")}" />
        </button>
      </div>
    </div>

    <div id="presence-indicator" style="display:none;">
      <p class="extension-txt-indicator">Partner is typing...</p>
    </div>
  </div>
</div>`;
    const host = document.createElement("div");
    host.id = "hiranda-party-host";
    host.setAttribute("tpInjected", "");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = CHAT_HTML;
    const $ = (id) => shadow.getElementById(id);
    const chatWrapper = $("chat-wrapper");
    const chatContainer = shadow.querySelector("#chat-container");
    const toggleStrip = $("tp-buttons-container");
    const iconBtn = $("tp-icon-container");
    const badge = $("tp-message-indicator");
    const closeBtn = $("close-chat");
    const chatHistory = $("chat-history");
    const chatInput = $("chat-input");
    const linkIcon = $("link-icon");
    const userIconEl = $("user-icon");
    const userIconImg = $("user-icon-img");
    const userCount = $("user-count");
    const reactionHolder = $("reaction-holder");
    const reactionBtn = $("reaction-btn");
    const videoOverlay = $("video-overlay");
    const syncToast = $("sync-toast");
    const partyTab = $("party-tab");
    const iconsTab = $("icons-tab");
    const iconContainer = $("chat-icon-container");
    const nicknameEdit = $("nickname-edit");
    const saveBtn = $("saveChanges");
    const cancelBtn = $("cancelNickname");
    const presenceEl = $("presence-indicator");
    const partyStatusLine = $("party-status-line");
    const partnerDot = $("partner-dot");
    const watchingWithEl = $("watching-with");
    const sessionTimerEl = $("session-timer");
    const leaveBtn = $("leave-party-btn");
    chrome.storage.local.get(["hpNickname", "hpIcon"], (r) => {
      try {
        if (r.hpNickname)
          userNickname = r.hpNickname;
        if (r.hpIcon) {
          userIcon = r.hpIcon;
          if (userIconImg)
            userIconImg.src = chrome.runtime.getURL(`img/icons/${userIcon}`);
        }
      } catch (e) {
        console.warn("[Hiranda] icon init error:", e);
      }
    });
    function openChat() {
      chatOpen = true;
      chatWrapper.classList.remove("hidden");
      toggleStrip.style.display = "none";
      badge.style.display = "none";
      unreadCount = 0;
      chrome.storage.local.set({ hpChatOpen: true });
      chrome.runtime.sendMessage({ type: "MARK_READ" });
    }
    function closeChat() {
      chatOpen = false;
      chatWrapper.classList.add("hidden");
      if (partyId)
        toggleStrip.style.display = "flex";
      chrome.storage.local.set({ hpChatOpen: false });
    }
    iconBtn.addEventListener("click", openChat);
    closeBtn.addEventListener("click", closeChat);
    leaveBtn?.addEventListener("click", async () => {
      if (!leaveBtn)
        return;
      leaveBtn.disabled = true;
      leaveBtn.textContent = "Leaving\u2026";
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "LEAVE_PARTY" }, (res) => {
            if (chrome.runtime.lastError)
              reject(chrome.runtime.lastError);
            else
              resolve(res);
          });
        });
      } catch {
      }
      partyId = null;
      stopTimer();
      stopPresencePoll();
      clearPartyHeader();
      toggleStrip.style.display = "none";
      addSystemMessage("Left the party.");
      closeChat();
      leaveBtn.disabled = false;
      leaveBtn.textContent = "Leave";
    });
    partyTab.addEventListener("click", () => {
      partyTab.classList.add("sidebar-active");
      partyTab.classList.remove("sidebar-tab-inactive");
      iconsTab.classList.remove("sidebar-active");
      iconsTab.classList.add("sidebar-tab-inactive");
      iconContainer.style.display = "none";
      chatContainer.style.display = "flex";
    });
    iconsTab.addEventListener("click", () => {
      iconsTab.classList.add("sidebar-active");
      iconsTab.classList.remove("sidebar-tab-inactive");
      partyTab.classList.remove("sidebar-active");
      partyTab.classList.add("sidebar-tab-inactive");
      chatContainer.style.display = "none";
      iconContainer.style.display = "block";
      nicknameEdit.value = userNickname;
      shadow.querySelectorAll(".image-button img").forEach((img) => {
        const iconPath = img.closest(".image-button").dataset.icon;
        img.classList.toggle("icon-selected", iconPath === userIcon);
      });
    });
    shadow.querySelectorAll(".image-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        userIcon = btn.dataset.icon;
        if (userIconImg)
          userIconImg.src = chrome.runtime.getURL(`img/icons/${userIcon}`);
        shadow.querySelectorAll(".image-button img").forEach((img) => {
          img.classList.toggle("icon-selected", img.closest(".image-button").dataset.icon === userIcon);
        });
      });
    });
    saveBtn.addEventListener("click", () => {
      if (nicknameEdit.value.trim())
        userNickname = nicknameEdit.value.trim();
      chrome.storage.local.set({ hpNickname: userNickname, hpIcon: userIcon });
      if (userIconImg)
        userIconImg.src = chrome.runtime.getURL(`img/icons/${userIcon}`);
      chrome.runtime.sendMessage({ type: "UPDATE_PROFILE", username: userNickname, userIcon });
      partyTab.click();
      addSystemMessage(`You are now "${userNickname}"`);
    });
    cancelBtn.addEventListener("click", () => partyTab.click());
    linkIcon.addEventListener("click", () => {
      if (!partyId)
        return;
      const url = `${location.href.split("#")[0]}#hp=${partyId}`;
      navigator.clipboard.writeText(url).then(() => {
        addSystemMessage("Party link copied to clipboard!");
      });
    });
    function addMessage({ content, username, userIcon: icon, ts }) {
      const wrap = document.createElement("div");
      wrap.className = "msg-container";
      const iconSrc = chrome.runtime.getURL(`img/icons/${icon || "General/Popcorn.svg"}`);
      wrap.innerHTML = `
      <div class="tp-icon-name"><img src="${iconSrc}" /></div>
      <div class="msg-txt">
        <h3>${escapeHtml(username || "Guest")}</h3>
        <p>${escapeHtml(content)}</p>
      </div>`;
      chatHistory.appendChild(wrap);
      chatHistory.scrollTop = chatHistory.scrollHeight;
      if (!chatOpen) {
        unreadCount++;
        badge.style.display = "block";
        chrome.runtime.sendMessage({ type: "CHAT_RECEIVED" });
      }
    }
    function addSystemMessage(text) {
      const el = document.createElement("div");
      el.className = "msg-container message-system";
      el.innerHTML = `<div class="msg-txt"><p>${escapeHtml(text)}</p></div>`;
      chatHistory.appendChild(el);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    function escapeHtml(str) {
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    let _syncToastTimer = null;
    function showSyncToast(eventType) {
      const labels = {
        pause: "\u23F8 Synced",
        play: "\u25B6 Synced",
        seek: "\u23ED Synced",
        heartbeat: "\u21BB Corrected"
      };
      syncToast.textContent = labels[eventType] || "\u21BB Synced";
      syncToast.classList.add("visible");
      clearTimeout(_syncToastTimer);
      _syncToastTimer = setTimeout(() => syncToast.classList.remove("visible"), 2e3);
    }
    function sendMessage() {
      const content = chatInput.textContent.trim();
      if (!content)
        return;
      chatInput.textContent = "";
      window.dispatchEvent(new CustomEvent("HirandaSendChat", {
        detail: { content, username: userNickname, userIcon }
      }));
      addMessage({ content, username: userNickname, userIcon, ts: Date.now() });
    }
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    reactionBtn.addEventListener("click", () => {
      const showing = reactionHolder.style.display === "flex";
      reactionHolder.style.display = showing ? "none" : "flex";
    });
    shadow.querySelectorAll(".tp-reaction-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reactionType = btn.dataset.reaction;
        window.dispatchEvent(new CustomEvent("HirandaSendReaction", { detail: { reactionType } }));
        spawnReaction(reactionType);
      });
    });
    const REACTION_GIFS = {
      heart: "heart/heart.gif",
      angry: "angry/angry.gif",
      cry: "cry/cry.gif",
      laugh: "laugh/laugh.gif",
      surprise: "surprise/surprise.gif",
      fire: "fire/fire.gif"
    };
    function spawnReaction(reactionType) {
      const variants = ["on-screen-reaction-1", "on-screen-reaction-2", "on-screen-reaction-3"];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const el = document.createElement("img");
      el.className = `on-screen-reaction ${variant}`;
      const gifPath = REACTION_GIFS[reactionType] || `${reactionType}/${reactionType}.gif`;
      el.src = chrome.runtime.getURL(`img/reactions/${gifPath}`);
      el.style.left = 10 + Math.random() * 60 + "%";
      el.style.width = "100px";
      el.style.height = "100px";
      el.onload = () => {
        el.style.setProperty("--reaction-size", el.offsetHeight + "px");
      };
      videoOverlay.appendChild(el);
      setTimeout(() => el.remove(), 7500);
    }
    function startTimer() {
      partyStartTime = Date.now();
      sessionTimerEl.style.display = "block";
      if (timerRef)
        clearInterval(timerRef);
      timerRef = setInterval(() => {
        const elapsed = Math.floor((Date.now() - partyStartTime) / 1e3);
        const h = Math.floor(elapsed / 3600);
        const m = Math.floor(elapsed % 3600 / 60);
        const s = elapsed % 60;
        sessionTimerEl.textContent = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }, 1e3);
    }
    function stopTimer() {
      if (timerRef) {
        clearInterval(timerRef);
        timerRef = null;
      }
      sessionTimerEl.style.display = "none";
      sessionTimerEl.textContent = "00:00";
    }
    function updatePartyHeader() {
      partyStatusLine.style.display = "flex";
      sessionTimerEl.style.display = "block";
      if (partnerName) {
        watchingWithEl.textContent = `Watching with ${partnerName}`;
      } else {
        watchingWithEl.textContent = isHost ? "Waiting for partner\u2026" : "Connecting\u2026";
      }
      partnerDot.classList.toggle("online", partnerOnline);
      partnerDot.classList.toggle("offline", !partnerOnline);
    }
    function clearPartyHeader() {
      partyStatusLine.style.display = "none";
      sessionTimerEl.style.display = "none";
      partnerName = null;
      partnerOnline = false;
      partnerDot.className = "partner-dot offline";
    }
    function startPresencePoll() {
      if (presencePollRef)
        clearInterval(presencePollRef);
      presencePollRef = setInterval(() => {
        if (partnerLastSeen && Date.now() - partnerLastSeen > 15e3) {
          partnerOnline = false;
          partnerDot.classList.remove("online");
          partnerDot.classList.add("offline");
        }
      }, 5e3);
    }
    function stopPresencePoll() {
      if (presencePollRef) {
        clearInterval(presencePollRef);
        presencePollRef = null;
      }
    }
    window.addEventListener("HirandaPartyJoined", (e) => {
      partyId = e.detail.partyId;
      isHost = e.detail.isHost;
      openChat();
      startTimer();
      updatePartyHeader();
      startPresencePoll();
      addSystemMessage(isHost ? "Party started! Share the link to invite." : "Joined the party!");
    });
    window.addEventListener("HirandaPartyLeft", () => {
      partyId = null;
      stopTimer();
      stopPresencePoll();
      clearPartyHeader();
      toggleStrip.style.display = "none";
      addSystemMessage("Left the party.");
      closeChat();
    });
    window.addEventListener("HirandaChatMsg", (e) => {
      addMessage(e.detail);
    });
    window.addEventListener("HirandaReaction", (e) => {
      spawnReaction(e.detail.reactionType);
    });
    window.addEventListener("HirandaSyncAction", (e) => {
      const { event: evType } = e.detail;
      if (evType && evType !== "heartbeat") {
        showSyncToast(evType);
      }
    });
    window.addEventListener("HirandaPresence", (e) => {
      const { type, username, userIcon: icon } = e.detail;
      const name = username || "Your partner";
      if (type === "join") {
        partnerName = name;
        partnerOnline = true;
        partnerLastSeen = Date.now();
        partnerDot.classList.add("online");
        partnerDot.classList.remove("offline");
        userCount.textContent = "2";
        updatePartyHeader();
        addSystemMessage(`${name} joined the party!`);
      } else if (type === "leave") {
        partnerName = null;
        partnerOnline = false;
        partnerDot.classList.remove("online");
        partnerDot.classList.add("offline");
        userCount.textContent = "1";
        updatePartyHeader();
        addSystemMessage(`${name} left.`);
      } else if (type === "update") {
        partnerName = name;
        partnerLastSeen = Date.now();
        partnerOnline = true;
        partnerDot.classList.add("online");
        partnerDot.classList.remove("offline");
        updatePartyHeader();
      }
    });
    chrome.runtime.sendMessage({ type: "GET_PARTY_STATE" }, (res) => {
      if (res?.partyId) {
        partyId = res.partyId;
        isHost = res.isHost;
        openChat();
        startTimer();
        updatePartyHeader();
        startPresencePoll();
      }
    });
  })();
})();
