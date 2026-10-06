// Hiranda service worker — kept deliberately small.
//
// It exists so the app stays installable (and, later, for push
// notifications). It has NO fetch
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
