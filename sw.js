// Service Worker: hält die App offline verfügbar. Bei neuer Version CACHE erhöhen.
const CACHE = 'radix-0.7.4';
const DATEIEN = ['./', 'index.html', 'kern.js', 'peptide.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'logo-kopf.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Erst Netz (für Updates), sonst gespeicherte Version (offline)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
