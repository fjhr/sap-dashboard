// SAP B1 Dashboard - Service Worker
// Subir la versión del cache con cada cambio en index.html/sw.js fuerza la actualización
const CACHE_NAME = 'sap-dashboard-v2';
const STATIC_ASSETS = [
  '/sap-dashboard/',
  '/sap-dashboard/index.html',
  '/sap-dashboard/manifest.json'
];

// Install: pre-cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first para el documento y la API, cache-first para el resto
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network for Apps Script API calls
  if (url.hostname === 'script.google.com') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Network-first para el documento: si no, un deploy nuevo de index.html
  // queda invisible para siempre (el SW viejo lo servía cache-first)
  if (e.request.mode === 'navigate' || url.pathname === '/sap-dashboard/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
