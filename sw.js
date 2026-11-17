/* Active Care Pharmacy - Service Worker v6 - Professional Offline First */
const CACHE_NAME = 'activecare-v6';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

// Install - Cache core files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('Active Care - Cache failed', err))
  );
});

// Activate - Delete old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Cache First for app shell, Network First for Firebase
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Never cache Firebase / Google APIs - always fresh data
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('gstatic.com') ||
    url.includes('googleapis.com')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }

  // For everything else - Cache First, fallback to network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          // Cache new files dynamically (only GET + same origin)
          if (e.request.method === 'GET' && res.status === 200 && url.startsWith(self.location.origin)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline fallback - show app even without internet
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline - Active Care', { status: 503 });
        });
    })
  );
});

// Push - Ready for future notifications (expiry / low stock)
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.text() : 'Active Care Pharmacy';
  e.waitUntil(
    self.registration.showNotification('Active Care Pharmacy', {
      body: data,
      icon: './logo.png',
      badge: './logo.png'
    })
  );
});