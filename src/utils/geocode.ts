/**
 * Ricerca di un indirizzo con OpenStreetMap (Nominatim): serve internet, nessuna chiave.
 * Si usa solo a richiesta (pulsante "Cerca"), per rispettare il limite di una ricerca al secondo.
 * Il risultato è biasato su Seul, ma trova anche indirizzi in Italia e in Cina.
 */
export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
}

export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ format: 'jsonv2', limit: '5', 'accept-language': 'it', addressdetails: '0', viewbox: '126.4,37.8,127.6,37.2', q });
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Non riesco a cercare l’indirizzo: manca la connessione. Puoi usare il GPS o scegliere un luogo vicino.');
  }
  if (!res.ok) throw new Error('Il servizio di ricerca indirizzi non risponde adesso. Riprova tra poco.');
  const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
  return data
    .map((d) => ({ label: String(d.display_name ?? ''), lat: Number(d.lat), lng: Number(d.lon) }))
    .filter((d) => d.label && Number.isFinite(d.lat) && Number.isFinite(d.lng));
}
