/**
 * Orologio del viaggio: capisce a che punto del programma siamo, anche con fusi diversi
 * (Italia, Cina, Corea), e trasforma gli orari scritti a parole ("Mattina", "Sera") in istanti.
 */
import { ITINERARY_DAYS, type ItineraryDay, type ScheduleItem } from '../data/tripData';

type Zone = 'IT' | 'KR' | 'CN';
const OFFSET_H: Record<Zone, number> = { IT: 1, KR: 9, CN: 8 };
const ZONE_LABEL: Record<Zone, string> = { IT: 'ora italiana', KR: 'ora coreana', CN: 'ora cinese' };

/** Il 1 marzo 2027 è il giorno 0 del programma. */
const DAY0_UTC = Date.UTC(2027, 2, 1);

export interface TimedItem {
  item: ScheduleItem;
  /** Istante di inizio (ms UTC) */
  ts: number;
  zone: Zone;
  /** "10:10", o vuoto se l'orario è solo approssimativo (Mattina, Sera) */
  clock: string;
  approximate: boolean;
}

export interface TimedDay {
  day: ItineraryDay;
  items: TimedItem[];
  startTs: number;
  endTs: number;
}

const SLOT_HOURS: Record<string, [number, number]> = {
  'mattina presto': [6, 0],
  mattina: [9, 0],
  pomeriggio: [14, 0],
  sera: [19, 0]
};

export function timeDay(day: ItineraryDay): TimedDay {
  const items: TimedItem[] = [];
  let passedKr = false;
  let prev = -Infinity;
  const baseDay = DAY0_UTC + day.id * 86_400_000;

  (day.schedule ?? []).forEach((item) => {
    // Giorno 1: gli orari senza etichetta prima di "11:40 (Seul)" sono cinesi.
    // Giorno 18: gli orari senza etichetta (dopo l'arrivo) sono cinesi.
    if (/\(seul\)/i.test(item.time)) passedKr = true;
    let zone: Zone;
    if (/\(seul\)/i.test(item.time)) zone = 'KR';
    else if (/\(pechino\)/i.test(item.time)) zone = 'CN';
    else if (day.id === 0 || day.id === 19) zone = 'IT';
    else if (day.id === 1) zone = passedKr ? 'KR' : 'CN';
    else if (day.id === 18) zone = 'CN';
    else zone = 'KR';

    const m = item.time.match(/(\d{1,2}):(\d{2})/);
    const slot = SLOT_HOURS[item.time.trim().toLowerCase()];
    let h: number;
    let min: number;
    let approximate = false;
    if (m) {
      h = Number(m[1]);
      min = Number(m[2]);
    } else if (slot) {
      [h, min] = slot;
      approximate = true;
    } else {
      h = NaN;
      min = 0;
      approximate = true;
    }
    const nextDay = /\(20 mar\)/i.test(item.time) ? 86_400_000 : 0;
    let ts: number;
    if (Number.isNaN(h)) {
      ts = prev === -Infinity ? baseDay + (8 - OFFSET_H[zone]) * 3_600_000 : prev + 60_000;
    } else {
      ts = baseDay + nextDay + (h - OFFSET_H[zone]) * 3_600_000 + min * 60_000;
    }
    if (ts < prev) ts = prev + 60_000;
    prev = ts;
    items.push({ item, ts, zone, clock: m ? `${String(Number(m[1])).padStart(2, '0')}:${m[2]}` : '', approximate });
  });

  const startTs = items.length ? items[0].ts : baseDay;
  const endTs = items.length ? items[items.length - 1].ts + 3 * 3_600_000 : baseDay + 86_400_000;
  return { day, items, startTs, endTs };
}

export const TIMED_DAYS: TimedDay[] = ITINERARY_DAYS.map(timeDay);

export type TripPhase = 'before' | 'during' | 'after';

export interface TripNow {
  phase: TripPhase;
  dayIndex: number;
  /** Indice dell'attività in corso (-1 = la giornata non è ancora iniziata) */
  currentIndex: number;
  nextIndex: number;
}

export function locateNow(nowMs: number): TripNow {
  const first = TIMED_DAYS[0];
  const last = TIMED_DAYS[TIMED_DAYS.length - 1];
  if (nowMs < first.startTs - 4 * 3_600_000) return { phase: 'before', dayIndex: 0, currentIndex: -1, nextIndex: 0 };
  if (nowMs > last.endTs) return { phase: 'after', dayIndex: TIMED_DAYS.length - 1, currentIndex: last.items.length - 1, nextIndex: -1 };
  let dayIndex = 0;
  TIMED_DAYS.forEach((d, i) => {
    if (d.startTs - 4 * 3_600_000 <= nowMs) dayIndex = i;
  });
  const items = TIMED_DAYS[dayIndex].items;
  let currentIndex = -1;
  items.forEach((it, i) => {
    if (it.ts <= nowMs) currentIndex = i;
  });
  const nextIndex = currentIndex + 1 < items.length ? currentIndex + 1 : -1;
  return { phase: 'during', dayIndex, currentIndex, nextIndex };
}

export const zoneLabel = (z: Zone) => ZONE_LABEL[z];

/** Ora e data in un fuso, es. "ven 5 mar, 14:30" */
export function formatInZone(ms: number, zone: Zone | 'Asia/Seoul', opts: Intl.DateTimeFormatOptions = {}): string {
  const tz = zone === 'IT' ? 'Europe/Rome' : zone === 'CN' ? 'Asia/Shanghai' : 'Asia/Seoul';
  return new Intl.DateTimeFormat('it-IT', { timeZone: tz, ...opts }).format(new Date(ms));
}

/** Istante a partire da data (id del giorno) e ora locale di un fuso, per l'anteprima. */
export function msFromDayAndClock(dayId: number, hhmm: string, zone: Zone): number {
  const [h, m] = hhmm.split(':').map(Number);
  return DAY0_UTC + dayId * 86_400_000 + (h - OFFSET_H[zone]) * 3_600_000 + m * 60_000;
}

export const zoneOfDay = (dayId: number): Zone => (dayId === 0 || dayId === 19 ? 'IT' : 'KR');

export function formatCountdown(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} g ${h % 24} h`;
}
