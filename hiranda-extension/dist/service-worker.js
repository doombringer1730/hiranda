// src/background/service-worker.js
async function ensureUserId() {
  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) {
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ userId: id });
    return id;
  }
  return userId;
}
async function updateBadge(count) {
  await chrome.storage.local.set({ unreadCount: count });
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: "#ef3e3a" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}
async function incrementBadge() {
  const { unreadCount = 0, activeTabId } = await chrome.storage.local.get(["unreadCount", "activeTabId"]);
  let shouldIncrement = true;
  if (activeTabId) {
    try {
      const tab = await chrome.tabs.get(activeTabId);
      if (tab.active) {
        const win = await chrome.windows.get(tab.windowId);
        if (win.focused)
          shouldIncrement = false;
      }
    } catch {
    }
  }
  if (shouldIncrement) {
    await updateBadge(unreadCount + 1);
  }
}
function generatePartyId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
async function sendToTab(message) {
  const { activeTabId } = await chrome.storage.local.get("activeTabId");
  if (!activeTabId)
    return;
  try {
    await chrome.tabs.sendMessage(activeTabId, message);
  } catch (e) {
    console.log("Hiranda SW: tab send failed", e?.message);
  }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => {
    console.error("Hiranda SW error:", err);
    sendResponse({ error: err.message });
  });
  return true;
});
async function handleMessage(msg, sender) {
  const { type } = msg;
  if (type === "CREATE_PARTY") {
    const userId = await ensureUserId();
    const partyId = generatePartyId();
    const { hpNickname: username = "Guest", hpIcon: userIcon = "General/Popcorn.svg" } = await chrome.storage.local.get(["hpNickname", "hpIcon"]);
    const tabId = sender.tab?.id || msg.tabId;
    await chrome.storage.local.set({
      partyId,
      isHost: true,
      userId,
      activeTabId: tabId,
      unreadCount: 0
    });
    await updateBadge(0);
    if (tabId) {
      const joinMsg = { type: "JOIN_PARTY", partyId, isHost: true, userId, username, userIcon };
      try {
        await chrome.tabs.sendMessage(tabId, joinMsg);
      } catch {
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, joinMsg);
          } catch {
          }
        }, 1500);
      }
    }
    return { partyId, isHost: true, userId, username, userIcon };
  }
  if (type === "JOIN_PARTY") {
    const userId = await ensureUserId();
    const { partyId } = msg;
    const { hpNickname: username = "Guest", hpIcon: userIcon = "General/Popcorn.svg" } = await chrome.storage.local.get(["hpNickname", "hpIcon"]);
    const tabId = sender.tab?.id || msg.tabId;
    await chrome.storage.local.set({
      partyId,
      isHost: false,
      userId,
      activeTabId: tabId,
      unreadCount: 0
    });
    await updateBadge(0);
    if (tabId) {
      const joinMsg = { type: "JOIN_PARTY", partyId, isHost: false, userId, username, userIcon };
      try {
        await chrome.tabs.sendMessage(tabId, joinMsg);
      } catch {
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, joinMsg);
          } catch {
          }
        }, 1500);
      }
    }
    return { partyId, isHost: false, userId, username, userIcon };
  }
  if (type === "LEAVE_PARTY") {
    const { activeTabId } = await chrome.storage.local.get("activeTabId");
    if (activeTabId) {
      try {
        await chrome.tabs.sendMessage(activeTabId, { type: "LEAVE_PARTY" });
      } catch {
      }
    }
    await chrome.storage.local.set({
      partyId: null,
      isHost: false,
      activeTabId: null,
      unreadCount: 0
    });
    await updateBadge(0);
    return { ok: true };
  }
  if (type === "GET_PARTY_STATE") {
    const state = await chrome.storage.local.get([
      "partyId",
      "isHost",
      "userId",
      "activeTabId",
      "unreadCount"
    ]);
    return state;
  }
  if (type === "SET_ACTIVE_TAB") {
    await chrome.storage.local.set({ activeTabId: msg.tabId });
    return { ok: true };
  }
  if (type === "MARK_READ") {
    await updateBadge(0);
    return { ok: true };
  }
  if (type === "CHAT_RECEIVED") {
    await incrementBadge();
    return { ok: true };
  }
  if (type === "UPDATE_PROFILE") {
    const { username, userIcon } = msg;
    const updates = {};
    if (username !== void 0)
      updates.hpNickname = username;
    if (userIcon !== void 0)
      updates.hpIcon = userIcon;
    if (Object.keys(updates).length)
      await chrome.storage.local.set(updates);
    await sendToTab({ type: "UPDATE_PROFILE", username, userIcon });
    return { ok: true };
  }
  if (type === "RELAY_TO_TAB") {
    await sendToTab(msg.payload);
    return { ok: true };
  }
  return { error: "unknown type: " + type };
}
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { activeTabId, partyId } = await chrome.storage.local.get(["activeTabId", "partyId"]);
  if (tabId === activeTabId && partyId) {
    await chrome.storage.local.set({
      partyId: null,
      isHost: false,
      activeTabId: null,
      unreadCount: 0
    });
    await updateBadge(0);
  }
});
chrome.runtime.onStartup.addListener(async () => {
  await ensureUserId();
  const { unreadCount = 0 } = await chrome.storage.local.get("unreadCount");
  await updateBadge(unreadCount);
});
chrome.runtime.onInstalled.addListener(async () => {
  await ensureUserId();
  await updateBadge(0);
});
console.log("Hiranda: service worker loaded");
