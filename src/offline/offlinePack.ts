/**
 * Pacchetto offline: salva sul telefono tutti i file dell'app (programma, PDF, mappa senza sfondo, percorsi in metro)
 * in una cache dedicata che il service worker (public/sw.js) legge quando manca la rete.
 * Si scarica e si rimuove con un pulsante: nulla parte da solo.
 *
 * Lo sfondo stradale della mappa NON è incluso: sono riquadri di Google e le condizioni d'uso non permettono di scaricarli in blocco.
 */
import { BUILD_ID } from '../pwa';
import { TRIP_META } from '../data/tripData';

export const OFFLINE_CACHE = 'seul2027-offline-v1';
const META_KEY = 'seul2027:offline:meta';

interface Manifest {
  build: string;
  files: { url: string; bytes: number }[];
}

export interface PackMeta {
  build: string;
  savedAt: string;
  bytes: number;
  files: number;
}

export interface PackState {
  supported: boolean;
  installed: boolean;
  meta: PackMeta | null;
  /** Il pacchetto salvato viene da una versione dell'app diversa da quella aperta */
  outdated: boolean;
}

export const isOfflineSupported = () => typeof caches !== 'undefined' && 'serviceWorker' in navigator;

const root = () => new URL('./', document.baseURI).href;

function readMeta(): PackMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as PackMeta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: PackMeta | null) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    /* archiviazione bloccata: lo stato si ricava comunque dalla cache */
  }
}

export async function getPackState(): Promise<PackState> {
  if (!isOfflineSupported()) return { supported: false, installed: false, meta: null, outdated: false };
  const has = await caches.has(OFFLINE_CACHE);
  const meta = has ? readMeta() : null;
  // Cache presente ma senza annotazione (es. dati del sito cancellati a metà): la tratto come da riscaricare
  const installed = has && !!meta;
  return { supported: true, installed, meta, outdated: installed && meta!.build !== BUILD_ID };
}

async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(new URL('offline-manifest.json', document.baseURI).href, { cache: 'no-store' });
  if (!res.ok) throw new Error('Elenco dei file non disponibile');
  return (await res.json()) as Manifest;
}

/** Dimensione stimata del pacchetto (byte), per mostrarla prima di scaricare. */
export async function estimatePackBytes(): Promise<number> {
  try {
    const m = await fetchManifest();
    return m.files.reduce((s, f) => s + f.bytes, 0) + 60_000;
  } catch {
    return 0;
  }
}

/** Fogli di stile esterni (font, Leaflet) e i file dei font che citano. */
async function externalUrls(): Promise<string[]> {
  const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map((l) => l.href)
    .filter((h) => /^https:\/\//.test(h) && !h.startsWith(location.origin));
  const urls = new Set(sheets);
  for (const href of sheets) {
    if (!/fonts\.googleapis\.com/.test(href)) continue;
    try {
      const css = await (await fetch(href)).text();
      for (const m of css.matchAll(/url\((https:\/\/[^)]+)\)/g)) urls.add(m[1]);
    } catch {
      /* i font restano facoltativi */
    }
  }
  return [...urls];
}

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

export class DownloadCancelled extends Error {
  constructor() {
    super('Download annullato');
  }
}

/** Scarica tutto. Se fallisce o si annulla, il pacchetto parziale viene cancellato. */
export async function downloadPack(onProgress: (p: DownloadProgress) => void, signal?: AbortSignal): Promise<PackMeta> {
  if (!isOfflineSupported()) throw new Error('Questo browser non permette l’uso offline.');
  const manifest = await fetchManifest();

  type Item = { url: string; bytes: number; external?: boolean };
  const base = document.baseURI;
  const items: Item[] = manifest.files.map((f) => ({ url: new URL(f.url, base).href, bytes: f.bytes }));
  items.unshift({ url: root(), bytes: 4_000 });
  items.push({ url: new URL(TRIP_META.pdfPath, base).href, bytes: 45_000 });
  (await externalUrls()).forEach((u) => items.push({ url: u, bytes: 15_000, external: true }));

  const totalBytes = items.reduce((s, i) => s + i.bytes, 0);
  let done = 0;
  let bytes = 0;
  let savedBytes = 0;
  const report = () => onProgress({ done, total: items.length, bytes, totalBytes });

  // Riparto sempre da zero: un pacchetto di una versione precedente non deve restare mescolato col nuovo
  await caches.delete(OFFLINE_CACHE);
  const cache = await caches.open(OFFLINE_CACHE);
  report();

  const queue = [...items];
  const failed: string[] = [];
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const item = queue.shift();
      if (!item) return;
      try {
        const res = await fetch(item.url, { cache: 'reload', signal });
        if (!res.ok) throw new Error(String(res.status));
        savedBytes += Number(res.headers.get('content-length')) || item.bytes;
        await cache.put(item.url, res);
      } catch (err) {
        if (signal?.aborted) return;
        // Un file esterno mancante (font) non blocca il pacchetto; uno dell'app sì
        if (!item.external) failed.push(item.url);
      }
      done += 1;
      bytes += item.bytes;
      report();
    }
  };

  try {
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (signal?.aborted) throw new DownloadCancelled();
    if (failed.length > 0) throw new Error(`Non sono riuscito a scaricare ${failed.length} file. Controlla la connessione e riprova.`);
  } catch (err) {
    await caches.delete(OFFLINE_CACHE);
    writeMeta(null);
    throw err;
  }

  const meta: PackMeta = { build: BUILD_ID, savedAt: new Date().toISOString(), bytes: savedBytes, files: items.length };
  writeMeta(meta);
  // Chiede al telefono di non cancellare i dati del sito quando serve spazio (iPhone lo fa dopo giorni senza aprirlo)
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* non essenziale */
  }
  return meta;
}

export async function removePack(): Promise<void> {
  await caches.delete(OFFLINE_CACHE);
  writeMeta(null);
}

export function formatMb(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
}
