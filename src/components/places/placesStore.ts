import { useEffect, useState } from 'react';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import type { PlaceInput, PlaceVote, SharedPlace } from '../../shared/places';
import { addPlace, deletePlace, editPlace, friendlyPlacesError, setVisited, votePlace, watchPlaces } from '../../services/placesService';

/** Un solo ascolto di Firestore per tutta l'app (schermata Luoghi e livello sulla mappa). */
export interface PlacesState {
  places: SharedPlace[];
  ready: boolean;
  error: string | null;
  /** Luogo da mostrare sulla mappa appena si apre */
  focusId: string | null;
}

let state: PlacesState = { places: [], ready: false, error: null, focusId: null };
const listeners = new Set<(s: PlacesState) => void>();
let started = false;

function set(patch: Partial<PlacesState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function usePlaces(): PlacesState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (!started) {
      started = true;
      try {
        watchPlaces(
          (places) => set({ places, ready: true, error: null }),
          (error) => set({ error, ready: true })
        );
      } catch (err) {
        set({ error: friendlyPlacesError(err), ready: true });
      }
    }
    setS(state);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export const focusPlace = (id: string | null) => set({ focusId: id });

async function run(fn: () => Promise<void>) {
  try {
    await fn();
    if (state.error) set({ error: null });
  } catch (err) {
    set({ error: friendlyPlacesError(err) });
    throw err;
  }
}

export const savePlace = (uid: string, slot: TravelerSlotId, input: PlaceInput) => run(() => addPlace(uid, slot, input));
export const updatePlace = (id: string, input: PlaceInput) => run(() => editPlace(id, input));
export const vote = (id: string, slot: TravelerSlotId, v: PlaceVote | null) => run(() => votePlace(id, slot, v)).catch(() => undefined);
export const markVisited = (id: string, v: boolean) => run(() => setVisited(id, v)).catch(() => undefined);
export const removePlace = (id: string) => run(() => deletePlace(id)).catch(() => undefined);
