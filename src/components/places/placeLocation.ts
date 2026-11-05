import type { MapLocation } from '../../data/tripData';
import { categoryOf, type SharedPlace } from '../../shared/places';

/** Prefisso degli id dei luoghi aggiunti: li distingue dalle tappe del programma. */
export const PLACE_ID_PREFIX = 'place:';

/** Un luogo condiviso visto come punto della mappa, così può essere partenza o destinazione di un percorso. */
export function placeToLocation(p: SharedPlace): MapLocation {
  const c = categoryOf(p.category);
  return {
    id: `${PLACE_ID_PREFIX}${p.id}`,
    name: p.name,
    italianName: p.name,
    district: p.address || c.label,
    city: 'Seul',
    category: 'luogo',
    lat: p.lat,
    lng: p.lng,
    dayNumbers: [],
    description: [p.address, p.note].filter(Boolean).join(' · ') || `${c.emoji} ${c.label} aggiunto dal gruppo`
  };
}
