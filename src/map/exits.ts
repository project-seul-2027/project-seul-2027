import type { LatLng } from '../data/seoulMetro';
import type { MetroRouteResult } from '../data/metroRouter';
import { distanceMeters } from './geo';

export type ExitPoint = [number, number, string];

export interface ExitAdvice {
  /** Numero dell'uscita, "3" */
  ref: string;
  /** Metri dall'uscita alla meta, in linea d'aria */
  toDestination: number;
}

/** L'uscita della stazione d'arrivo più vicina alla meta, solo se avvicina davvero rispetto al centro della stazione. */
export function bestExit(exits: ExitPoint[], station: LatLng, destination: LatLng): ExitAdvice | null {
  const fromStation = distanceMeters(station, destination);
  let best: ExitAdvice | null = null;
  for (const [lat, lng, ref] of exits) {
    // le uscite di una stazione stanno entro poche centinaia di metri dalla banchina
    if (Math.abs(lat - station[0]) > 0.004 || Math.abs(lng - station[1]) > 0.005) continue;
    if (distanceMeters(station, [lat, lng]) > 350) continue;
    const toDestination = distanceMeters([lat, lng], destination);
    if (!best || toDestination < best.toDestination) best = { ref, toDestination };
  }
  // se non guadagna almeno 40 m non vale la pena dirlo
  return best && best.toDestination < fromStation - 40 ? best : null;
}

/** Uscita consigliata per scendere alla fine di un percorso metro. */
export function exitForRoute(exits: ExitPoint[], route: MetroRouteResult | null | undefined): ExitAdvice | null {
  if (!route?.reachable || !route.segments.length) return null;
  const last = route.segments[route.segments.length - 1];
  const station = last.toStation.at[last.line.id] ?? Object.values(last.toStation.at)[0];
  if (!station) return null;
  return bestExit(exits, station, [route.destination.lat, route.destination.lng]);
}
