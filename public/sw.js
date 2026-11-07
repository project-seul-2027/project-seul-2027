/*
 * Service worker di Seul 2027: rende il sito installabile e lo apre anche senza rete.
 *
 * - Pagine (navigazione): prima la rete, saltando la cache HTTP del browser (GitHub Pages la tiene 10 minuti),
 *   così ogni push si vede subito; senza rete, l'ultima versione salvata.
 * - File della build (/assets/nome-HASH.js|css): in cache per sempre (il nome cambia a ogni versione).
 * - Altri file del sito (icone, PDF, immagini): subito dalla cache, aggiornati in background.
 * - Font Google e CSS di Leaflet: come sopra.
 * - Pacchetto offline (pulsante "Scarica per l'offline"): letto se il file non è già nella cache normale.
 * - Sfondo della mappa (pulsante "Scarica lo sfondo della mappa"): riquadri OpenFreeMap letti dalla cache se scaricati.
 * - Firebase, Google Maps, meteo e ogni altra API: mai toccati dal service worker.
 */
const SHELL_CACHE = 'seul2027-shell-v2';
const ASSET_CACHE = 'seul2027-assets-v2';
const EXT_CACHE = 'seul2027-ext-v2';
// Pacchetto scaricato con il pulsante "Scarica per l'offline": lo gestisce la pagina, il service worker lo legge soltanto
const OFFLINE_CACHE = 'seul2027-offline-v1';
// Sfondo della mappa per l'offline (riquadri OpenFreeMap), scaricato con il suo pulsante
const MAP_CACHE = 'seul2027-maptiles-v1';
const MAP_HOST = 'tiles.openfreemap.org';
const KEEP = [SHELL_CACHE, ASSET_CACHE, EXT_CACHE, OFFLINE_CACHE, MAP_CACHE];
const MAX_ASSETS = 120;

const SHELL_FILES = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/badge-96.png', './icons/apple-touch-icon.png'];
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

async function offlineMatch(request) {
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    return await cache.match(request);
  } catch {
    return undefined;
  }
}

// Riquadri, caratteri e icone della mappa: dalla cache se scaricati, altrimenti dalla rete (senza salvarli: lo fa solo il pulsante)
async function mapAsset(request) {
  try {
    const cache = await caches.open(MAP_CACHE);
    const hit = await cache.match(request.url, { ignoreVary: true });
    if (hit) return hit;
  } catch {
    /* cache non disponibile */
  }
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}

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
    // Le pagine con ?tab=... non sono in cache: l'app è una sola pagina, basta quella iniziale
    return (
      (await cache.match('./')) ||
      (await cache.match(request)) ||
      (await offlineMatch(self.registration.scope)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(request)) || (await offlineMatch(request));
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(cacheName, MAX_ASSETS);
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(request)) || (await offlineMatch(request));
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

// Notifiche push (Firebase Cloud Messaging): messaggi "solo dati" con title, body, url, tag e critical.
// Su iPhone ogni push deve mostrare un avviso, quindi lo mostriamo sempre.
// "critical" = emergenza (es. qualcuno ha perso il gruppo): resta sullo schermo finché non la tocchi e vibra.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  const d = Object.assign({}, payload.data || {}, payload.notification || {});
  const critical = d.critical === '1' || d.critical === true;
  const options = {
    body: d.body || '',
    icon: './icons/icon-192.png',
    // icona monocromatica della barra di stato (Android): senza, il telefono mostra un quadrato bianco
    badge: './icons/badge-96.png',
    tag: d.tag || 'seul2027',
    renotify: true,
    requireInteraction: critical,
    vibrate: critical ? [300, 120, 300, 120, 300] : [120],
    timestamp: Date.now(),
    // la pagina da aprire toccando l'avviso (es. ?p=group)
    data: { url: d.url || './' }
  };
  event.waitUntil(self.registration.showNotification(d.title || 'Seul 2027', options));
});

// Toccando l'avviso: se l'app è già aperta la si porta davanti e le si dice quale pagina mostrare
// (senza ricaricarla); se è chiusa, si apre direttamente sulla pagina giusta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          try {
            client.postMessage({ type: 'open-page', url: target });
          } catch {
            /* la pagina potrebbe essere in chiusura */
          }
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

// Condivisione dal telefono: "Condividi → Seul 2027" dall'app Fotocamera o dalla Galleria. Funziona anche se Android ha
// chiuso l'app mentre scattavi, perché la foto arriva al service worker, che la salva e riapre l'app sulla galleria.
const KV_DB = 'seul2027-local';
const KV_STORE = 'kv';
function kvPut(key, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(KV_DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(KV_STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(KV_STORE, 'readwrite');
      tx.objectStore(KV_STORE).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

// Ripiego se request.formData() fallisce: legge il corpo grezzo e ne estrae il primo file
function findBytes(buf, pat, from) {
  outer: for (let i = from; i <= buf.length - pat.length; i++) {
    for (let j = 0; j < pat.length; j++) if (buf[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}
async function firstFileFromRaw(request) {
  const type = request.headers.get('content-type') || '';
  const m = /boundary=("?)([^";]+)\1/i.exec(type);
  if (!m) throw new Error('no-boundary');
  const buf = new Uint8Array(await request.arrayBuffer());
  const enc = new TextEncoder();
  const delim = enc.encode('--' + m[2]);
  const headSep = enc.encode('\r\n\r\n');
  const partEnd = enc.encode('\r\n--' + m[2]);
  let pos = 0;
  while ((pos = findBytes(buf, delim, pos)) !== -1) {
    const headEnd = findBytes(buf, headSep, pos);
    if (headEnd === -1) break;
    const head = new TextDecoder().decode(buf.subarray(pos, headEnd));
    const start = headEnd + 4;
    const end = findBytes(buf, partEnd, start);
    if (/filename="/i.test(head) && end > start) {
      const ct = /content-type:\s*([^\r\n]+)/i.exec(head);
      return new Blob([buf.slice(start, end)], { type: ct ? ct[1].trim() : 'image/jpeg' });
    }
    pos = start;
  }
  return null;
}

async function handleShare(request) {
  const home = self.registration.scope;
  const go = (qs) => Response.redirect(new URL(`./?${qs}`, home).href, 303);
  const fail = (stage, e, extra) =>
    go(`p=gallery&shared=err&why=${encodeURIComponent(`${stage}: ${String((e && e.message) || e)}${extra || ''}`.slice(0, 120))}`);
  const size = request.headers.get('content-length');
  const sizeInfo = size ? ` · ${Math.round(Number(size) / 1024)} KB` : '';
  const copy = request.clone();
  let photos = [];
  let form = null;
  // Cosa è arrivato davvero (per capire se il telefono ha consegnato il file)
  const seen = [];
  try {
    form = await request.formData();
    for (const [k, v] of form.entries()) {
      seen.push(typeof v === 'string' ? `${k}=testo` : `${k}=${v.type || '?'} ${Math.round(v.size / 1024)}KB`);
      if (v && typeof v !== 'string' && v.size > 0) photos.push(v);
    }
  } catch (e1) {
    // formData non è riuscito: si prova a leggere il corpo grezzo
    try {
      const blob = await firstFileFromRaw(copy);
      if (blob) photos = [blob];
    } catch (e2) {
      return fail('lettura', e1, ` / grezzo: ${String((e2 && e2.message) || e2)}${sizeInfo}`);
    }
  }
  try {
    if (photos.length) {
      try {
        await kvPut('shared-photo', photos[0]);
      } catch (e) {
        // Ripiego: se IndexedDB non risponde si salva nella cache (la legge la pagina)
        const cache = await caches.open('seul2027-share');
        await cache.put('shared-photo', new Response(photos[0], { headers: { 'Content-Type': photos[0].type || 'image/jpeg' } }));
      }
      return go('p=gallery&shared=1');
    }
    // Solo testo o link: come prima, diventa un nuovo luogo
    const q = new URLSearchParams();
    if (form) {
      for (const k of ['title', 'text', 'url']) {
        const v = form.get(k);
        if (typeof v === 'string' && v) q.set(k, v);
      }
    }
    // Nessun file e nessun testo: lo si segnala alla pagina invece di tornare in silenzio a "Oggi"
    return q.toString() ? go(q.toString()) : go(`p=gallery&shared=empty&why=${encodeURIComponent(`${form ? 'modulo' : 'grezzo'}: ${seen.join(', ') || 'nessun campo'}${sizeInfo}`.slice(0, 160))}`);
  } catch (e) {
    return fail('salvataggio', e, sizeInfo);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/share-target')) {
    event.respondWith(handleShare(request));
    return;
  }
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.json')) return;
    // I video usano richieste a intervalli (206): li gestisce direttamente il browser
    if (/\.(mp4|webm)$/i.test(url.pathname)) return;
    if (HASHED_ASSET.test(url.pathname)) event.respondWith(cacheFirst(request, ASSET_CACHE));
    else event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, event));
    return;
  }
  if (url.hostname === MAP_HOST) {
    event.respondWith(mapAsset(request));
    return;
  }
  if (EXTERNAL_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, EXT_CACHE, event));
  }
  // Tutto il resto (Firebase, Google, mappe, meteo…) passa direttamente alla rete
});
