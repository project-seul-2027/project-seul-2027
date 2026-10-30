/**
 * Sfondo della mappa per l'offline, da OpenFreeMap (dati OpenStreetMap, riquadri vettoriali).
 * Le condizioni d'uso di OpenFreeMap consentono alle app di far scaricare un'area per l'offline entro questi limiti,
 * che qui sono rispettati: al massimo 3.000 riquadri e 50 MB per download, al massimo 4 richieste in parallelo.
 * I riquadri di Google, usati con la rete, non si possono salvare: per questo serve questo secondo sfondo.
 *
 * Il service worker (public/sw.js) risponde dalla cache `MAP_CACHE` alle richieste a tiles.openfreemap.org.
 */
import { MAP_LOCATIONS } from '../data/tripData';

/** Evento della finestra: lo sfondo offline è stato scaricato o rimosso */
export const MAP_PACK_EVENT = 'seul2027:mappack';
export const MAP_CACHE = 'seul2027-maptiles-v1';
const META_KEY = 'seul2027:offline:map';
const OFM = 'https://tiles.openfreemap.org';
const STYLE_URL = { dark: `${OFM}/styles/dark`, light: `${OFM}/styles/positron` } as const;
export type MapThemeKey = keyof typeof STYLE_URL;

// Limiti di OpenFreeMap per i download offline, con un po' di margine
const MAX_TILES = 2900;
const MAX_BYTES = 46_000_000;
const PARALLEL = 4;
const GLYPH_RANGES = ['0-255', '256-511', '8192-8447'];

export interface MapPackMeta {
  savedAt: string;
  bytes: number;
  tiles: number;
  maxZoom: number;
  /** Il limite di spazio ha fermato il download prima di coprire tutta l'area */
  partial: boolean;
}

const styleKey = (t: MapThemeKey) => new URL(`offline-map/style-${t}.json`, document.baseURI).href;
const key = (url: string) => new Request(url).url;

export const isMapPackSupported = () => typeof caches !== 'undefined';

export function readMapMeta(): MapPackMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as MapPackMeta) : null;
  } catch {
    return null;
  }
}

function writeMapMeta(meta: MapPackMeta | null) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    /* archiviazione bloccata */
  }
}

export async function getMapPackState(): Promise<{ supported: boolean; installed: boolean; meta: MapPackMeta | null }> {
  if (!isMapPackSupported()) return { supported: false, installed: false, meta: null };
  const has = await caches.has(MAP_CACHE);
  const meta = has ? readMapMeta() : null;
  return { supported: true, installed: has && !!meta, meta };
}

/** Stile pronto per MapLibre, letto dalla cache (null se lo sfondo offline non è stato scaricato). */
export async function loadOfflineStyle(theme: MapThemeKey): Promise<Record<string, unknown> | null> {
  try {
    const cache = await caches.open(MAP_CACHE);
    const res = await cache.match(styleKey(theme));
    return res ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ---------- Elenco dei riquadri da scaricare ---------- */

const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export interface TileId {
  z: number;
  x: number;
  y: number;
}

/**
 * Riquadri attorno alle tappe in Corea (alloggi, luoghi, gite). Dall'alto verso il basso: zoom bassi per tutta la zona,
 * poi sempre più dettaglio vicino ai luoghi del viaggio. Dentro ogni zoom, prima i riquadri più vicini a una tappa.
 */
export function planTiles(maxZoom: number): TileId[] {
  const anchors = MAP_LOCATIONS.filter((l) => l.city === 'Seul' || l.city === 'Dintorni / Gite');
  const lats = anchors.map((a) => a.lat);
  const lngs = anchors.map((a) => a.lng);
  const box = { s: Math.min(...lats), n: Math.max(...lats), w: Math.min(...lngs), e: Math.max(...lngs) };
  const out: TileId[] = [];
  const seen = new Set<string>();
  const add = (z: number, x: number, y: number, dist: number, bucket: [number, TileId, number][]) => {
    const max = 2 ** z;
    if (x < 0 || y < 0 || x >= max || y >= max) return;
    const k = `${z}/${x}/${y}`;
    if (seen.has(k)) return;
    seen.add(k);
    bucket.push([z, { z, x, y }, dist]);
  };

  const all: [number, TileId, number][] = [];
  for (let z = 0; z <= Math.min(maxZoom, 14); z++) {
    const bucket: [number, TileId, number][] = [];
    if (z <= 10) {
      // Tutta la zona delle tappe, con un riquadro di margine
      for (let x = tileX(box.w, z) - 1; x <= tileX(box.e, z) + 1; x++) {
        for (let y = tileY(box.n, z) - 1; y <= tileY(box.s, z) + 1; y++) add(z, x, y, 0, bucket);
      }
    } else {
      for (const a of anchors) {
        const cx = tileX(a.lng, z);
        const cy = tileY(a.lat, z);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) add(z, cx + dx, cy + dy, Math.abs(dx) + Math.abs(dy), bucket);
        }
      }
    }
    bucket.sort((a, b) => a[2] - b[2]);
    all.push(...bucket);
  }
  all.forEach(([, t]) => out.push(t));
  return out;
}

/* ---------- Download ---------- */

export interface MapDownloadProgress {
  done: number;
  total: number;
  bytes: number;
  stage: 'stile' | 'riquadri';
}

export class MapDownloadCancelled extends Error {
  constructor() {
    super('Download annullato');
  }
}

interface StyleLayer {
  id: string;
  source?: string;
  layout?: { 'text-font'?: string[]; 'text-field'?: unknown };
}
interface StyleJson {
  glyphs?: string;
  sprite?: string;
  sources: Record<string, { type: string; url?: string; tiles?: string[]; [k: string]: unknown }>;
  layers: StyleLayer[];
  [k: string]: unknown;
}

/** I nomi coreani richiederebbero centinaia di file di caratteri: offline si mostrano solo i nomi in lettere latine. */
function latinOnlyLabels(layers: StyleLayer[]) {
  for (const l of layers) {
    const tf = l.layout?.['text-field'];
    if (tf && JSON.stringify(tf).includes('name:nonlatin')) {
      l.layout!['text-field'] = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']];
    }
  }
}

export async function downloadMapPack(onProgress: (p: MapDownloadProgress) => void, signal?: AbortSignal): Promise<MapPackMeta> {
  if (!isMapPackSupported()) throw new Error('Questo browser non permette l’uso offline.');
  await caches.delete(MAP_CACHE);
  const cache = await caches.open(MAP_CACHE);
  let bytes = 0;
  const abortIf = () => {
    if (signal?.aborted) throw new MapDownloadCancelled();
  };

  try {
    onProgress({ done: 0, total: 1, bytes, stage: 'stile' });
    const files: string[] = [];
    let template = '';
    let maxZoom = 14;
    let minZoom = 0;
    let attribution = '';

    for (const theme of Object.keys(STYLE_URL) as MapThemeKey[]) {
      const res = await fetch(STYLE_URL[theme], { cache: 'reload', signal });
      if (!res.ok) throw new Error('Stile della mappa non disponibile');
      const text = (await res.text()).replace(/__TILEJSON_DOMAIN__/g, 'tiles.openfreemap.org');
      const style = JSON.parse(text) as StyleJson;

      // Sorgente vettoriale: risolvo il TileJSON una volta sola e scrivo l'indirizzo dei riquadri direttamente nello stile
      const vecId = Object.keys(style.sources).find((id) => style.sources[id].type === 'vector')!;
      const vec = style.sources[vecId];
      if (!template) {
        const tj = await (await fetch(vec.url!, { cache: 'reload', signal })).json();
        template = (tj.tiles?.[0] as string) ?? '';
        if (!template) throw new Error('Elenco dei riquadri non disponibile');
        maxZoom = Math.min(Number(tj.maxzoom ?? 14), 14);
        minZoom = Number(tj.minzoom ?? 0);
        attribution = (tj.attribution as string) ?? '';
      }
      style.sources[vecId] = { type: 'vector', tiles: [template], minzoom: minZoom, maxzoom: maxZoom, attribution };
      // Il rilievo ombreggiato (immagini raster) non serve a scala di città
      const rasterIds = new Set(Object.keys(style.sources).filter((id) => style.sources[id].type === 'raster'));
      rasterIds.forEach((id) => delete style.sources[id]);
      style.layers = style.layers.filter((l) => !(l.source && rasterIds.has(l.source)));
      latinOnlyLabels(style.layers);

      await cache.put(styleKey(theme), new Response(JSON.stringify(style), { headers: { 'content-type': 'application/json' } }));

      // Caratteri e icone usati dallo stile
      const stacks = new Set<string>();
      style.layers.forEach((l) => {
        const tf = l.layout?.['text-font'];
        if (Array.isArray(tf)) stacks.add(tf.join(','));
      });
      if (style.glyphs) {
        stacks.forEach((s) => GLYPH_RANGES.forEach((r) => files.push(style.glyphs!.replace('{fontstack}', s).replace('{range}', r))));
      }
      if (style.sprite) ['.json', '.png', '@2x.json', '@2x.png'].forEach((ext) => files.push(style.sprite + ext));
    }

    const tiles = planTiles(maxZoom).slice(0, MAX_TILES - files.length);
    const urls = [...new Set(files)].map((u) => ({ url: u, tile: false }))
      .concat(tiles.map((t) => ({ url: template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y)), tile: true })));

    let done = 0;
    let stored = 0;
    let partial = false;
    const queue = [...urls];
    onProgress({ done, total: urls.length, bytes, stage: 'riquadri' });

    const worker = async () => {
      for (;;) {
        if (signal?.aborted || partial) return;
        const item = queue.shift();
        if (!item) return;
        try {
          const res = await fetch(item.url, { signal });
          if (res.ok) {
            const buf = await res.arrayBuffer();
            if (item.tile && bytes + buf.byteLength > MAX_BYTES) {
              partial = true;
              return;
            }
            bytes += buf.byteLength;
            await cache.put(key(item.url), new Response(buf, { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' } }));
            stored += 1;
          } else if (!(item.tile && res.status === 404)) {
            // Un riquadro senza dati (mare, montagna vuota) risponde 404: va bene. Un file di stile mancante no.
            if (!item.tile) throw new Error(`File non scaricato (${res.status})`);
          }
        } catch (err) {
          if (signal?.aborted) return;
          if (!item.tile) throw err;
        }
        done += 1;
        onProgress({ done, total: urls.length, bytes, stage: 'riquadri' });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    abortIf();

    const meta: MapPackMeta = { savedAt: new Date().toISOString(), bytes, tiles: stored, maxZoom, partial };
    writeMapMeta(meta);
    return meta;
  } catch (err) {
    await caches.delete(MAP_CACHE);
    writeMapMeta(null);
    throw err;
  }
}

export async function removeMapPack(): Promise<void> {
  await caches.delete(MAP_CACHE);
  writeMapMeta(null);
}
