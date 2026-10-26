/*
 * Service worker di Seul 2027: rende il sito installabile e lo apre anche senza rete.
 *
 * - Pagine (navigazione): prima la rete, saltando la cache HTTP del browser (GitHub Pages la tiene 10 minuti),
 *   così ogni push si vede subito; senza rete, l'ultima versione salvata.
 * - File della build (/assets/nome-HASH.js|css): in cache per sempre (il nome cambia a ogni versione).
 * - Altri file del sito (icone, PDF, immagini): subito dalla cache, aggiornati in background.
 * - Font Google e CSS di Leaflet: come sopra.
 * - Firebase, Google Maps, meteo e ogni altra API: mai toccati dal service worker.
 */
const SHELL_CACHE = 'seul2027-shell-v2';
const ASSET_CACHE = 'seul2027-assets-v2';
const EXT_CACHE = 'seul2027-ext-v2';
const KEEP = [SHELL_CACHE, ASSET_CACHE, EXT_CACHE];
const MAX_ASSETS = 120;

const SHELL_FILES = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];
const HASHED_ASSET = /\/assets\/[^/]+-[\w-]{8,}\.(?:js|css|woff2?|svg|png|jpe?g|webp|json)$/;
const EXTERNAL_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('seul2027-') && !KEEP.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    // cache: 'reload' ignora la cache HTTP: altrimenti per 10 minuti dopo un deploy arriva l'index.html vecchio
    const response = await fetch(request.url, { cache: 'reload', credentials: 'same-origin', signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put('./', response.clone());
    return response;
  } catch {
    return (await cache.match('./')) || (await cache.match(request)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    trimCache(cacheName, MAX_ASSETS);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return (await update) || Response.error();
}

// Notifiche push (Firebase Cloud Messaging): messaggi "solo dati" con title, body, url e tag.
// Su iPhone ogni push deve mostrare un avviso, quindi lo mostriamo sempre.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  const d = Object.assign({}, payload.data || {}, payload.notification || {});
  const options = {
    body: d.body || '',
    icon: './icons/icon-192.png',
    tag: d.tag || 'seul2027',
    renotify: true,
    data: { url: d.url || './' }
  };
  event.waitUntil(self.registration.showNotification(d.title || 'Seul 2027', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.json')) return;
    if (HASHED_ASSET.test(url.pathname)) event.respondWith(cacheFirst(request, ASSET_CACHE));
    else event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, event));
    return;
  }
  if (EXTERNAL_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, EXT_CACHE, event));
  }
  // Tutto il resto (Firebase, Google, mappe, meteo…) passa direttamente alla rete
});
