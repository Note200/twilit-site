// ==========================================
// Twilit Site — Service Worker v1.1
// Offline cache + install-to-home-screen ready
//
// v1.1 修复：
//   1. 删掉文件末尾一句非 JS 的文字（全角括号 → SyntaxError，整个 SW 无法解析）
//   2. 预缓存路径 /_assets/theme.css → /_assets/twilit-theme.css（原路径 404）
//   3. 预缓存改为逐个 add，单个 404 不再让整个 install 失败
// ==========================================

const CACHE_NAME = 'twilit-v3';

// Assets to pre-cache on install
const PRE_CACHE = [
  '/',
  '/index.html',
  '/_assets/twilit-theme.css',
  '/_data/plugins.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // 逐个缓存：任何一项失败只跳过它自己，不会让 install 整体 reject
      Promise.all(
        PRE_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] 预缓存跳过:', url, err))
        )
      )
    )
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

// Network-first for HTML navigations, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';

  // API / data requests: network first
  if (url.pathname.startsWith('/_api/') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML page navigations: network first, never serve stale index.html for other pages
  if (isNavigation || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets (CSS/JS/images/fonts): cache first
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
