const CACHE_NAME = 'active-care-offline-v20';
const FILES_TO_CACHE = ['./','./index.html','./manifest.json','./logo.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : null)))); self.clients.claim(); });
self.addEventListener('fetch', (e) => { e.respondWith(caches.match(e.request).then((cached) => { if (cached) return cached; return fetch(e.request).then((res) => { let copy = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)); return res; }).catch(() => caches.match('./index.html')); })); });
