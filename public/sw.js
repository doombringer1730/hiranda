// Hiranda service worker — kept deliberately small.
//
// It keeps the app installable and shows push notifications from your
// partner. It has NO fetch
// handler on purpose: intercepting page loads made Safari show a bare
// "Response served by service worker has redirections" text page whenever
// the server redirected (e.g. signed-out -> /login in the home-screen app).
// So it never touches navigations, API calls, media, or /watch and /party.

self.addEventListener('install', () => self.skipWaiting())

// Take over open pages right away and clear caches left by the old version
// (which cached an offline page).
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Push notifications ──
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(data.title || 'Hiranda', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  }))
})

// Tapping a notification focuses an open Hiranda window (navigating it to the
// right page) or opens a new one. A window on /watch or /party is never
// navigated away — that would drop a synced watch session.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      const at = new URL(client.url)
      if (at.pathname.startsWith('/watch') || at.pathname.startsWith('/party')) continue
      if (at.origin === self.location.origin && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) return client.navigate(url)
        return
      }
    }
    return self.clients.openWindow(url)
  })())
})
