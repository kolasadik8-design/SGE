const CACHE_NAME = 'activecare-v9';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['./', './index.html', './manifest.json', './logo.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firestore') || e.request.url.includes('gstatic') || e.request.url.includes('googleapis')) { e.respondWith(fetch(e.request).catch(() => caches.match('./index.html'))); return; }
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => caches.match('./index.html'))));
});
