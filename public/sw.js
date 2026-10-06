// Hiranda service worker — kept deliberately small.
//
// Its only job today is an offline fallback for page navigations. It never
// touches API calls, media, or anything on /watch or /party (the sync
// feature), and it doesn't cache app pages, so a deploy is always live.

const CACHE = 'hiranda-v1'
const OFFLINE = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.mode !== 'navigate') return
  const path = new URL(req.url).pathname
  if (path.startsWith('/watch') || path.startsWith('/party')) return
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
})
