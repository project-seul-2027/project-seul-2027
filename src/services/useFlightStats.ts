import { useEffect, useState } from 'react';
import { flightStatsService, type FlightStatsMap } from './flightStatsService';

// Un solo ascolto di Firestore condiviso da tutte le schede dei voli (quattro tratti + il riepilogo)
let value: FlightStatsMap | null = null;
let unsubscribe: (() => void) | null = null;
const listeners = new Set<(v: FlightStatsMap | null) => void>();

function start() {
  if (unsubscribe) return;
  unsubscribe = flightStatsService.watch(
    (v) => {
      value = v;
      listeners.forEach((l) => l(v));
    },
    (err) => console.warn('Puntualità dei voli non leggibile:', err)
  );
}

/** Statistiche di puntualità dei voli, o null finché non sono arrivate (o se non sono leggibili) */
export function useFlightStats(): FlightStatsMap | null {
  const [stats, setStats] = useState<FlightStatsMap | null>(value);
  useEffect(() => {
    listeners.add(setStats);
    start();
    setStats(value);
    return () => {
      listeners.delete(setStats);
      if (listeners.size === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, []);
  return stats;
}
