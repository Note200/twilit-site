// ==========================================
// Twilit Site — Service Worker v1.0
// Offline cache + install-to-home-screen ready
// ==========================================

const CACHE_NAME = 'twilit-v1';

// Assets to pre-cache on install
const PRE_CACHE = [
  '/',
  '/index.html',
  '/_assets/theme.css',
  '/_data/plugins.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for static assets, network-first for plugin pages
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API / data requests: network first
  if (url.pathname.startsWith('/_api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets & pages: cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
（内容由AI生成，仅供参考）
