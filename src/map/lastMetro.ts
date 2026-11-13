import { OFFICIAL_METRO_LINE_DATA } from '../data/seoulMetroOfficialData';
import type { MetroRouteResult } from '../data/metroRouter';

/** Minuti dall'inizio del giorno di servizio: dopo mezzanotte (00:45) contano come 24:45. */
const toServiceMinutes = (h: number, m: number): number => (h < 4 ? h + 24 : h) * 60 + m;

/** Il limite più prudente di un testo come "00:45 – 00:55" o "24:00 – 00:55 (urbana)": il primo orario utile. */
export function earliestClock(text: string): number | null {
  const times = [...text.matchAll(/(\d{1,2}):(\d{2})/g)].map((x) => toServiceMinutes(Number(x[1]), Number(x[2])));
  return times.length ? Math.min(...times) : null;
}

const clock = (serviceMin: number): string => {
  const t = serviceMin % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export interface SeoulNow {
  /** Minuti nel giorno di servizio (dopo mezzanotte si somma 24 h) */
  serviceMin: number;
  /** Sabato e domenica sera hanno l'ultima corsa dei festivi */
  weekend: boolean;
}

export function seoulNow(now = Date.now()): SeoulNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value])
  );
  const h = Number(parts.hour);
  const m = Number(parts.minute);
  // Dopo mezzanotte vale ancora il giorno precedente
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayIdx = (order.indexOf(String(parts.weekday)) + (h < 4 ? 6 : 0)) % 7;
  return { serviceMin: toServiceMinutes(h, m), weekend: dayIdx >= 5 };
}

export interface LastMetroInfo {
  /** "00:45" */
  limit: string;
  /** Minuti che restano al limite; negativo se già passato */
  minutesLeft: number;
  passed: boolean;
  /** Linea che fissa il limite */
  lineId: string;
}

/** Ultima corsa del percorso: vale la linea che finisce prima. Gli orari ufficiali sono per linea, non per stazione: è una stima prudente. */
export function lastMetroForRoute(route: MetroRouteResult | null | undefined, now = Date.now()): LastMetroInfo | null {
  if (!route?.reachable || !route.segments.length) return null;
  const { serviceMin, weekend } = seoulNow(now);
  let best: { limit: number; lineId: string } | null = null;
  for (const seg of route.segments) {
    const info = OFFICIAL_METRO_LINE_DATA[seg.line.id];
    if (!info) continue;
    const limit = earliestClock(weekend ? info.lastTrainWeekend : info.lastTrainWeekday);
    if (limit === null) continue;
    if (!best || limit < best.limit) best = { limit, lineId: seg.line.id };
  }
  if (!best) return null;
  const minutesLeft = best.limit - serviceMin;
  return { limit: clock(best.limit), minutesLeft, passed: minutesLeft < 0, lineId: best.lineId };
}
