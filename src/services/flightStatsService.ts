import { collection, onSnapshot } from 'firebase/firestore';
import { firebase } from '../firebase/client';
import type { FlightStatsDoc } from '../shared/flightStats';

/** Statistiche di puntualità dei voli. Chiave = numero di volo senza spazi (es. CA950). */
export type FlightStatsMap = Record<string, FlightStatsDoc>;

export const flightStatsService = {
  watch(callback: (stats: FlightStatsMap) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(
      collection(firebase().db, 'flightStats'),
      (snap) => {
        const out: FlightStatsMap = {};
        snap.docs.forEach((d) => {
          out[d.id] = d.data() as FlightStatsDoc;
        });
        callback(out);
      },
      (err) => onError?.(err)
    );
  },
};
