import { ITINERARY_DAYS, MAP_LOCATIONS, type ItineraryDay, type MapLocation } from '../data/tripData';

const MONTHS: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11
};

/** "2 marzo 2027" → "2027-03-02" */
function isoOfDateStr(dateStr: string): string | null {
  const m = dateStr.match(/(\d{1,2})\s+([a-zà]+)\s+(\d{4})/i);
  const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
  if (!m || month === undefined) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Data di oggi a Seul, "2027-03-02" */
export function seoulDateIso(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
}

/** Il giorno del programma che corrisponde a oggi (ora di Seul), se il viaggio è in corso. */
export function tripDayAt(now = Date.now()): ItineraryDay | null {
  const iso = seoulDateIso(now);
  return ITINERARY_DAYS.find((d) => isoOfDateStr(d.dateStr) === iso) ?? null;
}

const inKorea = (l: MapLocation) => l.city === 'Seul' || l.city === 'Dintorni / Gite';

/** Le tappe del giorno in Corea, nell'ordine del programma, senza gli alloggi (sono "casa"). */
export function stopsOfDay(day: ItineraryDay | null | undefined): MapLocation[] {
  if (!day) return [];
  return day.locationIds
    .map((id) => MAP_LOCATIONS.find((l) => l.id === id))
    .filter((l): l is MapLocation => !!l && inKorea(l) && l.category !== 'alloggio');
}

/** "Casa" finché il gruppo non sceglie un altro alloggio dalla scheda. */
export const DEFAULT_HOME_ID = 'acc_d';
export const defaultHomeId = (): string => DEFAULT_HOME_ID;

/* ── Stato sul telefono: casa scelta e tappe già fatte ── */
const HOME_KEY = 'seul.mapHome.v1';
const DONE_KEY = 'seul.mapDone.v1';

export function loadHomeId(): string | null {
  try {
    return localStorage.getItem(HOME_KEY);
  } catch {
    return null;
  }
}
export function saveHomeId(id: string): void {
  try {
    localStorage.setItem(HOME_KEY, id);
  } catch {
    /* modalità privata: la scelta vale solo per questa sessione */
  }
}

export function loadDone(dayId: number): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}') as Record<string, unknown>;
    const list = all[String(dayId)];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function saveDone(dayId: number, ids: string[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}') as Record<string, unknown>;
    all[String(dayId)] = ids;
    localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch {
    /* come sopra */
  }
}

/** Distanza entro cui una tappa si considera raggiunta. */
export const ARRIVED_METERS = 150;
