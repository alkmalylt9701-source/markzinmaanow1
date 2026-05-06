// Advanced PWA Service Worker - Offline first
const VERSION = 'v2';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/auth',
  '/documents',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Helper: network-first with cache fallback
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/') || await caches.match('/');
      if (fallback) return fallback;
    }
    throw err;
  }
}

// Helper: cache-first for static assets
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Skip non-http
  if (!url.protocol.startsWith('http')) return;

  // Skip Supabase API and other cross-origin POST-like calls
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) {
    return;
  }

  // HTML navigations -> network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // Images -> cache-first
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Fonts, styles, scripts -> cache-first
  if (['style', 'script', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default: try network, fall back to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
