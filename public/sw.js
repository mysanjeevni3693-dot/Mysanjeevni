/* MySanjeevni PWA service worker.
 * Caches only the offline page and static files.
 * Never caches HTML documents, RSC payloads, /api, auth, or payments.
 */
const CACHE_NAME = 'mysanjeevani-static-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [OFFLINE_URL, '/pwa/icon-192.png', '/pwa/icon-512.png', '/manifest.webmanifest'];

function isStaticAsset(pathname) {
  if (pathname.startsWith('/_next/static/')) return true;
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(pathname);
}

function mustBypass(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;

  const path = url.pathname;
  if (path.startsWith('/api/') || path === '/api') return true;

  const headers = request.headers;
  if (
    headers.get('rsc') ||
    headers.get('next-router-prefetch') ||
    headers.get('next-router-state-tree') ||
    headers.get('next-url')
  ) {
    return true;
  }

  if (url.searchParams.has('_rsc')) return true;

  const accept = headers.get('accept') || '';
  if (accept.includes('text/x-component')) return true;

  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (mustBypass(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || new Response('You are offline. Reconnect to use MySanjeevni.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    return;
  }

  if (!isStaticAsset(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
