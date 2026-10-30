/**
 * Costo di un percorso in metro, ultima partenza utile e taxi di riserva.
 *
 * Tariffe verificate (adulti, carta T-money):
 * - Metro: 1.550 ₩ fino a 10 km, +100 ₩ ogni 5 km fino a 50 km (Kyunghyang Shinmun, 1 marzo 2026:
 *   https://www.khan.co.kr/en/article/202603011352087), +100 ₩ ogni 8 km oltre i 50 km (regola storica del sistema integrato).
 * - AREX All-Stop: Seoul Station → Incheon T1 4.750 ₩, T2 5.350 ₩; Hongik Univ. → T1 4.650 ₩, T2 5.250 ₩
 *   (The Seoul Guide, aggiornato 26 ottobre 2026: https://www.theseoulguide.com/airport-railroad-arex-all-stop-train/).
 * - Taxi normale: 4.800 ₩ fino a 1,6 km, +100 ₩ ogni 131 m; notte +20% (22-23 e 2-4), +40% (23-2)
 *   (Creatrip, aggiornato maggio 2026: https://creatrip.com/en/news/2487).
 * Gli orari dell'ultimo treno sono quelli per linea di seoulMetroOfficialData: indicativi, non per stazione.
 */
import { OFFICIAL_METRO_LINE_DATA } from '../data/seoulMetroOfficialData';
import { AREX_LINE_ID, haversineMeters, type MetroRouteResult } from '../data/metroRouter';

export const FARE_SOURCES = [
  { label: 'Tariffa metro (Kyunghyang, mar 2026)', url: 'https://www.khan.co.kr/en/article/202603011352087' },
  { label: 'AREX (The Seoul Guide, ott 2026)', url: 'https://www.theseoulguide.com/airport-railroad-arex-all-stop-train/' },
  { label: 'Taxi (Creatrip, mag 2026)', url: 'https://creatrip.com/en/news/2487' }
];

const BASE_FARE = 1550;
const AIRPORT_T1 = '인천공항1터미널';
const AIRPORT_T2 = '인천공항2터미널';
/** Tariffe AREX All-Stop verso/da l'aeroporto, per stazione */
const AREX_AIRPORT_FARES: Record<string, { t1: number; t2: number }> = {
  서울: { t1: 4750, t2: 5350 },
  홍대입구: { t1: 4650, t2: 5250 }
};
/** Linee con un supplemento proprio che qui non calcoliamo */
const SURCHARGE_LINES = new Set(['SB', 'GA', 'UJ', 'EV']);

/** Lunghezza dei tratti in treno, in km (lungo i binari disegnati) */
export function railKm(route: MetroRouteResult): number {
  let m = 0;
  for (const seg of route.segments) {
    for (let i = 1; i < seg.pathGeometry.length; i++) m += haversineMeters(seg.pathGeometry[i - 1], seg.pathGeometry[i]);
  }
  return m / 1000;
}

/** Tariffa a distanza del sistema integrato di Seul */
export function distanceFare(km: number): number {
  if (km <= 10) return BASE_FARE;
  const upTo50 = Math.min(km, 50) - 10;
  let fare = BASE_FARE + Math.ceil(upTo50 / 5) * 100;
  if (km > 50) fare += Math.ceil((km - 50) / 8) * 100;
  return fare;
}

export interface RouteFare {
  /** A testa, in won */
  perPerson: number;
  /** true se la cifra è un valore pubblicato e non una stima */
  exact: boolean;
  km: number;
  notes: string[];
  /** Tutte le linee del percorso valgono con la Climate Card */
  climateCardOk: boolean;
}

export function routeFare(route: MetroRouteResult): RouteFare | null {
  if (!route.reachable || route.segments.length === 0) return null;
  const km = railKm(route);
  const notes: string[] = [];
  let perPerson = distanceFare(km);
  let exact = false;

  const arexAirport = route.segments.find(
    (s) => s.line.id === AREX_LINE_ID && [s.fromStationKey, s.toStationKey].some((k) => k === AIRPORT_T1 || k === AIRPORT_T2)
  );
  if (arexAirport) {
    const city = arexAirport.fromStationKey === AIRPORT_T1 || arexAirport.fromStationKey === AIRPORT_T2 ? arexAirport.toStationKey : arexAirport.fromStationKey;
    const terminal = [arexAirport.fromStationKey, arexAirport.toStationKey].includes(AIRPORT_T2) ? 't2' : 't1';
    const known = AREX_AIRPORT_FARES[city]?.[terminal];
    if (known) {
      perPerson = Math.max(known, perPerson);
      exact = route.segments.length === 1;
      if (!exact) notes.push('Tariffa AREX per l’aeroporto più il resto del percorso: stima.');
    } else {
      perPerson = Math.max(perPerson, terminal === 't2' ? 5250 : 4650);
      notes.push('Tratta AREX per l’aeroporto: stima tra 4.650 e 5.350 ₩.');
    }
    notes.push('Il treno Express (diretto da Seoul Station) costa 11.000 ₩.');
  }

  const surcharge = route.segments.find((s) => SURCHARGE_LINES.has(s.line.id));
  if (surcharge) notes.push(`La linea ${surcharge.line.it ?? surcharge.line.id} ha un supplemento proprio, non incluso.`);

  const climateCardOk = route.segments.every((s) => OFFICIAL_METRO_LINE_DATA[s.line.id]?.climateCardEligible === 'full');
  return { perPerson, exact, km, notes, climateCardOk };
}

/* ---------- Ultima partenza utile ---------- */

const toMin = (h: string, m: string) => Number(h) * 60 + Number(m);

/** Primo orario dell'ultimo treno di una linea (minuti dalla mezzanotte, dopo le 24 se serve) */
function earliestLastTrain(lineId: string, weekend: boolean): number | null {
  const info = OFFICIAL_METRO_LINE_DATA[lineId];
  if (!info) return null;
  const txt = weekend ? info.lastTrainWeekend : info.lastTrainWeekday;
  const all = [...txt.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => {
    const v = toMin(m[1], m[2]);
    return v < 4 * 60 ? v + 24 * 60 : v;
  });
  return all.length ? Math.min(...all) : null;
}

/** Festivi coreani nel periodo del viaggio: orari da fine settimana */
const HOLIDAYS = new Set(['2027-03-01']);

export interface RouteDeadline {
  /** Minuti dalla mezzanotte (anche oltre 24:00) entro cui partire */
  departBy: number;
  /** "23:35" */
  label: string;
  /** Linea che impone l'orario */
  lineName: string;
  weekend: boolean;
  /** Minuti che restano da adesso (negativo = passato) */
  minutesLeft: number;
}

const fmtClock = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/**
 * Stima prudente: per ogni tratto, l'orario più presto dell'ultimo treno della sua linea meno il tempo
 * che serve per arrivarci (a piedi + tratti precedenti + 4 minuti per ogni cambio).
 */
export function routeDeadline(route: MetroRouteResult, nowMs: number): RouteDeadline | null {
  if (!route.reachable || route.segments.length === 0) return null;
  const kst = new Date(nowMs + 9 * 3_600_000);
  let nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  // Dopo mezzanotte conta ancora la "serata" del giorno prima
  const service = new Date(nowMs + 9 * 3_600_000 - (nowMin < 4 * 60 ? 86_400_000 : 0));
  if (nowMin < 4 * 60) nowMin += 1440;
  const day = service.getUTCDay();
  const weekend = day === 0 || day === 6 || HOLIDAYS.has(service.toISOString().slice(0, 10));

  let offset = route.walkStart?.walkMinutes ?? 0;
  let best: { at: number; line: string } | null = null;
  route.segments.forEach((seg, i) => {
    if (i > 0) offset += 4;
    const last = earliestLastTrain(seg.line.id, weekend);
    if (last != null) {
      const at = last - offset;
      if (!best || at < best.at) best = { at, line: seg.line.it ?? seg.line.id };
    }
    offset += seg.estimatedMinutes;
  });
  if (!best) return null;
  const b = best as { at: number; line: string };
  return { departBy: b.at, label: fmtClock(b.at), lineName: b.line, weekend, minutesLeft: b.at - nowMin };
}

/* ---------- Taxi ---------- */

export interface TaxiEstimate {
  low: number;
  high: number;
  /** Maggiorazione notturna applicata (0, 20 o 40) */
  nightPct: number;
  roadKm: number;
}

function nightPct(minOfDay: number): number {
  const m = ((minOfDay % 1440) + 1440) % 1440;
  if (m >= 23 * 60 || m < 2 * 60) return 40;
  if (m >= 22 * 60 || m < 4 * 60) return 20;
  return 0;
}

/** Stima del taxi tra partenza e arrivo, all'ora indicata (minuti dalla mezzanotte, ora di Seul) */
export function taxiEstimate(route: MetroRouteResult, atMinOfDay: number): TaxiEstimate {
  const straight = haversineMeters([route.origin.lat, route.origin.lng], [route.destination.lat, route.destination.lng]);
  const roadKm = (straight * 1.35) / 1000;
  const meters = roadKm * 1000;
  const base = 4800 + Math.max(0, Math.ceil((meters - 1600) / 131)) * 100;
  const pct = nightPct(atMinOfDay);
  const fare = base * (1 + pct / 100);
  const round = (v: number) => Math.round(v / 500) * 500;
  return { low: round(fare * 0.9), high: round(fare * 1.25), nightPct: pct, roadKm };
}

export const formatKrw = (n: number) => `${Math.round(n).toLocaleString('it-IT')} ₩`;
