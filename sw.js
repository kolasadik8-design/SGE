const CACHE_NAME = 'active-care-v2';
const FILES_TO_CACHE = ['./','./index.html','./manifest.json','./logo.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES_TO_CACHE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => { e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => { if (e.request.mode === 'navigate') return caches.match('./index.html'); }))); });
