// The service worker that makes Star Lattice installable and lets it open offline.
// Network first, so every load gets the latest files when online; each file fetched is kept in a
// cache, which answers when the network doesn't. serve.py's file API (/api/) is never cached:
// saves are written there, or kept in the browser's IndexedDB (storage.js).
const CACHE = 'star-lattice-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(hit => hit ?? Response.error())));
});
