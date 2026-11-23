const CACHE_NAME = 'activecare-single-v11';
const CORE_FILES = ['./manifest.json', './logo.png', './print.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('Cache failed', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // 1. Firebase - network only
  if (url.includes('firestore.googleapis.com') || url.includes('firebase') || url.includes('gstatic.com') || url.includes('googleapis.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }

  // 2. index.html - always from network, never from cache - this is the fix
  // If offline, get it from cache as a fallback only
  if (e.request.mode === 'navigate' || url.endsWith('index.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3. Other files - cache first for speed
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
        return new Response('Offline - Active Care', { status: 503 });
      });
    })
  );
});
