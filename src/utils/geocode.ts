/**
 * Ricerca di un indirizzo con OpenStreetMap (Nominatim): serve internet, nessuna chiave.
 * Si usa solo a richiesta (pulsante "Cerca"), per rispettare il limite di una ricerca al secondo.
 * Attenzione: in Corea molti indirizzi "a lotto" (es. 160-1 Donggyo-dong) non sono in OpenStreetMap e il
 * servizio ripiega sulla zona: per questo ogni risultato dice se è preciso, e la posizione si controlla sulla mappa.
 */
export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
  /** true se è un edificio, un locale o un civico; false se è solo una via o un quartiere */
  precise: boolean;
  precision?: 'place' | 'address' | 'street' | 'area' | 'unknown';
  houseNumber?: string;
}

interface Raw {
  display_name?: string;
  lat?: string;
  lon?: string;
  category?: string;
  addresstype?: string;
  type?: string;
  address?: { house_number?: string };
}

const precisionOf = (d: Raw): NonNullable<GeocodeHit['precision']> => {
  if (d.address?.house_number || ['house', 'building'].includes(String(d.addresstype ?? '')) || d.type === 'house' || d.type === 'building') return 'address';
  if (['shop', 'amenity', 'tourism', 'leisure', 'office', 'craft', 'historic', 'railway', 'public_transport', 'place_of_worship', 'restaurant', 'cafe', 'hotel'].includes(String(d.category ?? ''))) return 'place';
  if (d.addresstype === 'road' || d.type === 'road') return 'street';
  return 'area';
};

const isPrecise = (d: Raw): boolean => ['place', 'address'].includes(precisionOf(d));

const SEOUL_BOX = '126.4,37.8,127.6,37.2';

async function search(q: string, bounded: boolean, signal?: AbortSignal, koreaAddress = false): Promise<GeocodeHit[]> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '5', 'accept-language': koreaAddress ? 'en,ko,it' : 'it', addressdetails: koreaAddress ? '1' : '0', viewbox: SEOUL_BOX, q });
  if (koreaAddress) params.set('countrycodes', 'kr');
  if (bounded) params.set('bounded', '1');
  await waitForNominatimSlot(signal);
  let res: Response;
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal, headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Non riesco a cercare l’indirizzo: manca la connessione. Puoi usare il GPS, incollare il link di Google Maps o scegliere un luogo vicino.');
  }
  if (!res.ok) throw new Error('Il servizio di ricerca indirizzi non risponde adesso. Riprova tra poco.');
  const data = (await res.json()) as Raw[];
  return data
    .map((d) => ({
      label: String(d.display_name ?? ''),
      lat: Number(d.lat),
      lng: Number(d.lon),
      precise: isPrecise(d),
      precision: precisionOf(d),
      houseNumber: d.address?.house_number
    }))
    .filter((d) => d.label && Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

let nextNominatimRequestAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

async function waitForNominatimSlot(signal?: AbortSignal) {
  let release!: () => void;
  const previous = nominatimQueue;
  nominatimQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    if (signal?.aborted) throw new DOMException('Ricerca annullata', 'AbortError');
    const waitMs = Math.max(0, nextNominatimRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => signal?.removeEventListener('abort', abort);
        const timer = window.setTimeout(() => {
          cleanup();
          resolve();
        }, waitMs);
        const abort = () => {
          window.clearTimeout(timer);
          cleanup();
          reject(new DOMException('Ricerca annullata', 'AbortError'));
        };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      });
    }
    if (signal?.aborted) throw new DOMException('Ricerca annullata', 'AbortError');
    nextNominatimRequestAt = Date.now() + 1_100;
  } finally {
    release();
  }
}

/** Ricerca mappa: aggiunge contesto coreano agli indirizzi stradali romanizzati e limita gli omonimi alla Corea. */
export async function geocodeMapAddress(query: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const q = query.normalize('NFKC').replace(/[‐‑‒–—]/g, '-').replace(/[\s,]+/g, ' ').trim();
  if (q.length < 3) return [];
  // "-ro", "-gil" e anche "-daero" (Sejong-daero), "-daegil"
  const roadAddress = /^\d+(?:-\d+)?\s+.+-[a-z]*(?:ro|gil)\b/i.test(q);
  const hasRegion = /\b(seoul|busan|incheon|daegu|daejeon|gwangju|ulsan|jeju|korea|korean)\b/i.test(q);
  const first = await search(q, false, signal, roadAddress);
  const needsContext = roadAddress && !hasRegion && !first.some((hit) => hit.precision === 'address');
  if (!needsContext) return validateRequestedHouseNumber(first, q);

  // Public Nominatim is called only on explicit submit, with at least 1.1s between requests.
  const romanized = q.replace(/([a-z])dong-(gil|ro)\b/gi, '$1-dong-$2');
  const contextual = await search(`${romanized}, Seoul, South Korea`, false, signal, true);
  const merged: GeocodeHit[] = [];
  for (const hit of [...first, ...contextual]) {
    if (merged.some((item) => Math.abs(item.lat - hit.lat) < 0.0003 && Math.abs(item.lng - hit.lng) < 0.0003)) continue;
    merged.push(hit);
  }
  return validateRequestedHouseNumber(merged.sort((a, b) => Number(b.precise) - Number(a.precise)).slice(0, 6), q);
}

function validateRequestedHouseNumber(hits: GeocodeHit[], query: string): GeocodeHit[] {
  const requested = query.match(/(?:^|\s)(\d+(?:-\d+)?)(?=\s|$)/)?.[1];
  if (!requested) return hits;
  const normalize = (value: string) => value.replace(/\s+/g, '').replace(/\.0$/, '').toLowerCase();
  return hits.map((hit) => {
    if (!hit.houseNumber || normalize(hit.houseNumber) === normalize(requested)) return hit;
    return { ...hit, precise: false, precision: 'street' };
  });
}

/**
 * Cerca per indirizzo e, se si conosce il nome del locale, anche per nome (di solito più preciso a Seul).
 * I risultati precisi vengono prima; quelli a meno di 30 metri uno dall'altro contano come uno solo.
 */
export async function geocodeAddress(query: string, name = '', signal?: AbortSignal): Promise<GeocodeHit[]> {
  const q = query.trim();
  const n = name.trim();
  if (q.length < 3 && n.length < 3) return [];
  const byAddress = q.length >= 3 ? await search(q, false, signal) : [];
  let byName: GeocodeHit[] = [];
  if (n.length >= 3) {
    byName = await search(n, true, signal).catch(() => []);
  }
  const out: GeocodeHit[] = [];
  for (const h of [...byName, ...byAddress]) {
    if (out.some((o) => Math.abs(o.lat - h.lat) < 0.0003 && Math.abs(o.lng - h.lng) < 0.0003)) continue;
    out.push(h);
  }
  return out.sort((a, b) => Number(b.precise) - Number(a.precise)).slice(0, 6);
}
