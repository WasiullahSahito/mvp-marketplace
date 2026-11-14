// Minimal service worker: caches the app shell so the PWA installs and opens fast.
// API calls always go to the network (data is never served stale).
const CACHE = 'mm-shell-v2';
const SHELL = ['/', '/style.css', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  const isApi = u.pathname.startsWith('/api/') && !u.pathname.startsWith('/api/placeholder');
  if (e.request.method !== 'GET' || u.origin !== location.origin || isApi) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('/')))
  );
});
