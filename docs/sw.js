/* Offline cache for the Budget app.
 * Same-origin files are served from the cache (so the app opens without connection)
 * and refreshed in the background; requests to the Google Sheet API are never cached.
 * Change VERSION when you publish a new version of the files. */
const VERSION = 'budget-v11';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'bg.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // API calls go straight to the network
  e.respondWith(caches.open(VERSION).then(cache =>
    cache.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  ));
});
