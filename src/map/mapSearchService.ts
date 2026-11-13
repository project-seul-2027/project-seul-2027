import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { RemoteMapSearchResponse } from '../shared/mapSearch';

export type NearbyNeed = 'toilet' | 'pharmacy' | 'convenience' | 'atm' | 'cafe';

/** Bagni, farmacie, bancomat… entro 800 m da un punto. Il Worker risponde solo con la chiave Kakao configurata. */
export async function searchNearbyNeeds(need: NearbyNeed, lat: number, lng: number): Promise<RemoteMapSearchResponse> {
  if (!isFirebaseConfigured) throw new Error('Ricerca non disponibile senza accesso.');
  const user = firebase().auth.currentUser;
  const endpoint = import.meta.env.VITE_MAP_SEARCH_URL?.trim();
  if (!user || !endpoint) throw new Error('Ricerca non configurata.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ need, lat, lng }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Nearby search failed (${response.status})`);
  return (await response.json()) as RemoteMapSearchResponse;
}

/** Chiavi provider lato Worker; se il servizio non è configurato, la UI usa il fallback OSM. */
export async function searchKoreanMapPlaces(query: string): Promise<RemoteMapSearchResponse> {
  if (!isFirebaseConfigured) throw new Error('Ricerca coreana non disponibile senza accesso.');
  const { auth } = firebase();
  const user = auth.currentUser;
  const endpoint = import.meta.env.VITE_MAP_SEARCH_URL?.trim();
  if (!user || !endpoint) throw new Error('Ricerca precisa non configurata.');
  const token = await user.getIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    console.warn(`Ricerca Kakao: il Worker ha risposto ${response.status}`, detail?.error ?? '');
    throw new Error(`Map search failed (${response.status})`);
  }
  const data = (await response.json()) as RemoteMapSearchResponse;
  // Kakao non configurato o in errore: la UI ripiega su OpenStreetMap, qui resta traccia per il debug
  if (data.providerConfigured === false) console.warn('Ricerca Kakao: chiave non configurata nel Worker');
  if (data.providerErrors?.length) console.warn('Ricerca Kakao non riuscita:', data.providerErrors.join(', '));
  return data;
}
