import { useEffect, useState } from 'react';
import type { RoutePreference } from './metroRouter';

/** Preferenza di percorso scelta nel pannello metro (condivisa tra mappa e pannelli). */
let current: RoutePreference = 'fast';
const listeners = new Set<(p: RoutePreference) => void>();

export function setRoutePreference(p: RoutePreference) {
  current = p;
  listeners.forEach((l) => l(p));
}

export function useRoutePreference(): RoutePreference {
  const [p, setP] = useState(current);
  useEffect(() => {
    listeners.add(setP);
    setP(current);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
