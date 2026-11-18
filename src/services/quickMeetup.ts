import { MAP_LOCATIONS, type MapLocation } from '../data/tripData';
import { loadSeoulMetro } from '../data/seoulMetro';
import { computeMetroRoute } from '../data/metroRouter';
import { seoulClock } from '../shared/groupLive';

/** Come arrivarci dalla casa del gruppo, in una frase: linee metro e minuti. */
export async function metroSummary(fromId: string, to: MapLocation): Promise<string> {
  const from = MAP_LOCATIONS.find((l) => l.id === fromId);
  if (!from) return '';
  try {
    const network = await loadSeoulMetro();
    const route = computeMetroRoute(network, from, to);
    if (!route.reachable || route.segments.length === 0) return 'Percorso: cercalo in mappa dall’app.';
    const legs = route.segments.map((s) => `${s.line.it} da ${s.fromStation.en} a ${s.toStation.en}`);
    const minutes = route.segments.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const walk = route.nearestOriginStation?.walkMinutes ?? 0;
    const walkText = walk > 0 ? `, più ${walk} min a piedi fino alla stazione` : '';
    return `Metro: ${legs.join(', poi ')} (circa ${minutes} min${walkText}).`;
  } catch {
    return 'Percorso: cercalo in mappa dall’app.';
  }
}

/** Il messaggio da mandare al gruppo: dove, a che ora, come arrivarci e la mappa. */
export function meetupText(place: MapLocation, at: number, route: string): string {
  const lines = [`Ritrovo: ${place.italianName}`, `Alle ${seoulClock(at)} (ora di Seul)`];
  if (place.koreanName) lines.push(`Nome in coreano: ${place.koreanName}`);
  if (place.koreanAddress) lines.push(`Indirizzo in coreano: ${place.koreanAddress}`);
  if (route) lines.push(route);
  lines.push(`Mappa: https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`);
  return lines.join('\n');
}
