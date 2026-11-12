import type { LatLng } from '../data/seoulMetro';
import { distanceMeters, walkMinutes } from './geo';

/**
 * Percorso a piedi su strada con il server pubblico di OSRM (nessuna chiave, serve rete).
 * Senza rete o se il server non risponde si ripiega sulla linea diretta con una stima del tempo:
 * il risultato lo dice (`estimated`) e l'interfaccia lo scrive.
 */
export interface WalkStep {
  text: string;
  meters: number;
  at: LatLng;
}

export interface WalkRoute {
  coords: LatLng[];
  meters: number;
  minutes: number;
  steps: WalkStep[];
  /** true = linea diretta e tempo stimato, non un percorso su strada */
  estimated: boolean;
}

const OSRM = 'https://router.project-osrm.org/route/v1/foot';

interface OsrmStep {
  distance: number;
  name?: string;
  maneuver: { type: string; modifier?: string; location: [number, number] };
}

const DIR: Record<string, string> = {
  left: 'a sinistra',
  right: 'a destra',
  'slight left': 'leggermente a sinistra',
  'slight right': 'leggermente a destra',
  'sharp left': 'tutto a sinistra',
  'sharp right': 'tutto a destra',
  uturn: 'inversione'
};

/** Istruzione in italiano da tipo e modificatore di OSRM. */
function stepText(s: OsrmStep): string {
  const via = s.name ? ` su ${s.name}` : '';
  const dir = DIR[s.maneuver.modifier ?? ''] ?? 'dritto';
  switch (s.maneuver.type) {
    case 'depart':
      return `Parti${via}`;
    case 'arrive':
      return 'Sei arrivato';
    case 'turn':
    case 'end of road':
    case 'fork':
    case 'merge':
    case 'on ramp':
    case 'off ramp':
      return `Svolta ${dir}${via}`;
    case 'continue':
    case 'new name':
      return `Continua${via}`;
    case 'roundabout':
    case 'rotary':
      return `Alla rotonda, esci${via}`;
    default:
      return `Prosegui${via}`;
  }
}

function fallback(from: LatLng, to: LatLng): WalkRoute {
  const meters = distanceMeters(from, to);
  return { coords: [from, to], meters, minutes: walkMinutes(meters * 1.25), steps: [], estimated: true };
}

/** Decodifica la polilinea di OSRM (precisione 5). */
function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d;
      else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

export async function walkRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<WalkRoute> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallback(from, to);
  try {
    const url = `${OSRM}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&steps=true&geometries=polyline`;
    const res = await fetch(url, { signal });
    if (!res.ok) return fallback(from, to);
    const data = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: string; legs: { steps: OsrmStep[] }[] }[];
    };
    const r = data.routes?.[0];
    if (data.code !== 'Ok' || !r) return fallback(from, to);
    const steps = r.legs
      .flatMap((l) => l.steps)
      .map((s) => ({ text: stepText(s), meters: s.distance, at: [s.maneuver.location[1], s.maneuver.location[0]] as LatLng }));
    return { coords: decodePolyline(r.geometry), meters: r.distance, minutes: walkMinutes(r.distance), steps, estimated: false };
  } catch (e) {
    if (signal?.aborted) throw e;
    return fallback(from, to);
  }
}

/** Metri residui lungo il percorso da `here` e prossima svolta: punto del tracciato più vicino, poi il resto. */
export function progressAlong(route: WalkRoute, here: LatLng): { meters: number; nextStep: WalkStep | null; offRoute: boolean } {
  let best = 0;
  let bestD = Infinity;
  route.coords.forEach((c, i) => {
    const d = distanceMeters(here, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  let rest = bestD;
  for (let i = best; i < route.coords.length - 1; i++) rest += distanceMeters(route.coords[i], route.coords[i + 1]);
  // prossima svolta: la prima il cui punto sta più avanti lungo il tracciato
  let nextStep: WalkStep | null = null;
  for (const s of route.steps) {
    const idx = route.coords.findIndex((c) => distanceMeters(c, s.at) < 4);
    if (idx > best || (idx === best && distanceMeters(here, s.at) > 12)) {
      nextStep = s;
      break;
    }
  }
  return { meters: rest, nextStep, offRoute: bestD > 60 };
}
