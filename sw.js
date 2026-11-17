/* Active Care Pharmacy - Single Branch - Service Worker v7 - Offline First */
const CACHE_NAME = 'activecare-single-v7';
const CORE_FILES = ['./', './index.html', './manifest.json', './logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)).then(() => self.skipWaiting()).catch((err) => console.log('Active Care - Cache failed', err)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('firebase') || url.includes('gstatic.com') || url.includes('googleapis.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (e.request.method === 'GET' && res.status === 200 && url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline - Active Care', { status: 503 });
      });
    })
  );
});
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.text() : 'Active Care Pharmacy';
  e.waitUntil(self.registration.showNotification('Active Care Pharmacy', { body: data, icon: './logo.png', badge: './logo.png' }));
});
