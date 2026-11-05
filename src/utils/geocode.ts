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
}

interface Raw {
  display_name?: string;
  lat?: string;
  lon?: string;
  category?: string;
  addresstype?: string;
  type?: string;
}

const PRECISE_TYPES = new Set(['house', 'building', 'shop', 'amenity', 'tourism', 'leisure', 'office', 'craft', 'historic', 'railway', 'public_transport', 'place_of_worship', 'restaurant', 'cafe', 'hotel']);

const isPrecise = (d: Raw): boolean =>
  PRECISE_TYPES.has(String(d.addresstype ?? '')) || PRECISE_TYPES.has(String(d.type ?? '')) || ['shop', 'amenity', 'tourism', 'leisure', 'office', 'building', 'railway'].includes(String(d.category ?? ''));

const SEOUL_BOX = '126.4,37.8,127.6,37.2';

async function search(q: string, bounded: boolean, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '5', 'accept-language': 'it', addressdetails: '0', viewbox: SEOUL_BOX, q });
  if (bounded) params.set('bounded', '1');
  let res: Response;
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal, headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Non riesco a cercare l’indirizzo: manca la connessione. Puoi usare il GPS, incollare il link di Google Maps o scegliere un luogo vicino.');
  }
  if (!res.ok) throw new Error('Il servizio di ricerca indirizzi non risponde adesso. Riprova tra poco.');
  const data = (await res.json()) as Raw[];
  return data
    .map((d) => ({ label: String(d.display_name ?? ''), lat: Number(d.lat), lng: Number(d.lon), precise: isPrecise(d) }))
    .filter((d) => d.label && Number.isFinite(d.lat) && Number.isFinite(d.lng));
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
    await new Promise((r) => setTimeout(r, 1100));
    byName = await search(n, true, signal).catch(() => []);
  }
  const out: GeocodeHit[] = [];
  for (const h of [...byName, ...byAddress]) {
    if (out.some((o) => Math.abs(o.lat - h.lat) < 0.0003 && Math.abs(o.lng - h.lng) < 0.0003)) continue;
    out.push(h);
  }
  return out.sort((a, b) => Number(b.precise) - Number(a.precise)).slice(0, 6);
}
