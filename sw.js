/* Prevención en terreno - service worker (funciona sin señal) */
const VERSION = 'ppt-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const EXTRA = ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
const HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(CORE.map(async u => { try { await c.add(u); } catch (_) {} }));
    await Promise.all(EXTRA.map(async u => {
      try { const req = new Request(u, { mode: 'no-cors' }); await c.put(req, await fetch(req)); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la app: primero la red (así llegan las actualizaciones), y sin señal la copia guardada
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-cache' });
        if (net && net.ok) { const c = await caches.open(VERSION); c.put(req, net.clone()); }
        return net;
      } catch (_) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') { const idx = await caches.match('./index.html'); if (idx) return idx; }
        return Response.error();
      }
    })());
    return;
  }

  // Librería de PDF y tipografías: primero la copia guardada
  if (HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
  // El clima (Open-Meteo) no se guarda: es un dato en vivo
});
