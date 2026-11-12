import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { RemoteMapSearchResponse } from '../shared/mapSearch';

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
  if (!response.ok) throw new Error(`Map search failed (${response.status})`);
  return await response.json() as RemoteMapSearchResponse;
}
