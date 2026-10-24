/*
 * Service worker di Seul 2027: rende il sito installabile e lo apre anche senza rete.
 *
 * - Pagine (navigazione): prima la rete, così ogni push si vede subito; senza rete, l'ultima versione salvata.
 * - File della build (/assets/nome-HASH.js|css): in cache per sempre (il nome cambia a ogni versione).
 * - Altri file del sito (icone, PDF, immagini): subito dalla cache, aggiornati in background.
 * - Font Google e CSS di Leaflet: come sopra.
 * - Firebase, Google Maps, meteo e ogni altra API: mai toccati dal service worker.
 */
const SHELL_CACHE = 'seul2027-shell-v1';
const ASSET_CACHE = 'seul2027-assets-v1';
const EXT_CACHE = 'seul2027-ext-v1';
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
    const response = await fetch(request, { signal: controller.signal });
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    if (HASHED_ASSET.test(url.pathname)) event.respondWith(cacheFirst(request, ASSET_CACHE));
    else event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, event));
    return;
  }
  if (EXTERNAL_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, EXT_CACHE, event));
  }
  // Tutto il resto (Firebase, Google, mappe, meteo…) passa direttamente alla rete
});
