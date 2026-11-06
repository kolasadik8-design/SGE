const CACHE_NAME = "splm-war-room-v2";
const FILES = ["./","./index.html","./manifest.json","./logo.png"];
self.addEventListener("install", e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>k!==CACHE_NAME?caches.delete(k):null)))); self.clients.claim(); });
self.addEventListener("fetch", e=>{ if(e.request.url.includes("firebase")||e.request.url.includes("googleapis")||e.request.url.includes("unpkg")||e.request.url.includes("openstreetmap")||e.request.url.includes("tile.openstreetmap")) return fetch(e.request).catch(()=>caches.match("./index.html")); e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{ return caches.open(CACHE_NAME).then(cache=>{ cache.put(e.request,r.clone()); return r; }); }).catch(()=>caches.match("./index.html")))); });
