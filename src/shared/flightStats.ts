// Statistiche di puntualità dei voli del viaggio: tipi e conversione dalla risposta di AeroDataBox
// (GET /flights/{numero}/delays). Usato sia dallo script che le scarica sia dall'app che le mostra.

/** Voli da seguire: numero, e aeroporti (ICAO) di partenza e arrivo come li usa AeroDataBox */
export const TRACKED_FLIGHTS = [
  { flight: 'CA950', legId: 'fl_outbound_1', depIcao: 'LIMC', arrIcao: 'ZBAA' },
  { flight: 'CA123', legId: 'fl_outbound_2', depIcao: 'ZBAA', arrIcao: 'RKSI' },
  { flight: 'CA124', legId: 'fl_inbound_1', depIcao: 'RKSI', arrIcao: 'ZBAA' },
  { flight: 'CA949', legId: 'fl_inbound_2', depIcao: 'ZBAA', arrIcao: 'LIMC' },
] as const;

export const PERCENTILE_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95] as const;

/** Ritardo di un aeroporto (partenza o arrivo) negli ultimi ~90 giorni, in minuti (negativo = in anticipo) */
export interface LegDelayStats {
  airportIcao: string;
  /** Ora programmata (UTC) del gruppo di voli considerato */
  scheduledHourUtc: number;
  /** Voli considerati */
  n: number;
  /** Ritardi ai percentili 5, 10 … 95 (19 valori, in minuti) */
  percentiles: number[];
  /** Quota di voli entro 15 minuti dall'orario (0-1) */
  onTime: number;
  /** Quota di voli con più di un'ora di ritardo (0-1) */
  over60: number;
  /** recent = ultimi voli realmente operati; aggregate = statistica di 90 giorni calcolata dall'API (ripiego) */
  source?: 'recent' | 'aggregate';
}

/** Un volo realmente operato (o cancellato), con il ritardo in minuti rispetto all'orario programmato */
export interface FlightOp {
  /** Partenza programmata, ms UTC (identifica il volo di quel giorno) */
  t: number;
  dep: number | null;
  arr: number | null;
  st: 'ok' | 'cancelled';
}

export interface FlightStatsDoc {
  flight: string;
  /** Millisecondi dell'ultimo aggiornamento */
  fetchedAt: number;
  fromUtc?: string;
  toUtc?: string;
  dep?: LegDelayStats;
  arr?: LegDelayStats;
  /** Voli recenti accumulati giorno dopo giorno (da cui si calcolano le statistiche) */
  ops?: FlightOp[];
  /** Voli cancellati su totale nel campione recente */
  cancelled?: number;
  total?: number;
}

/** Giorni di storia usati per le statistiche recenti, e limite di voli conservati */
export const RECENT_DAYS = 30;
export const KEEP_DAYS = 45;
/** Sotto questo numero di voli per lato si ripiega sulla statistica di 90 giorni dell'API */
export const MIN_RECENT_SAMPLES = 8;

/** "2026-10-31 11:53Z" → millisecondi UTC, oppure null */
export function parseUtcMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})Z?$/.exec(value.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

interface ApiTime {
  scheduledTime?: { utc?: string };
  revisedTime?: { utc?: string };
  runwayTime?: { utc?: string };
}

interface ApiFlight {
  status?: string;
  departure?: ApiTime;
  arrival?: ApiTime;
}

const delayOf = (side: ApiTime | undefined): number | null => {
  const sched = parseUtcMs(side?.scheduledTime?.utc);
  const actual = parseUtcMs(side?.runwayTime?.utc ?? side?.revisedTime?.utc);
  if (sched === null || actual === null) return null;
  const minutes = Math.round((actual - sched) / 60000);
  // Valori assurdi (dati sbagliati) si scartano
  return Math.abs(minutes) > 24 * 60 ? null : minutes;
};

/** Un volo della risposta dello storico → volo operato; null se non è ancora concluso o non ha dati utili */
export function opFromApi(f: ApiFlight): FlightOp | null {
  const t = parseUtcMs(f.departure?.scheduledTime?.utc);
  if (t === null) return null;
  const status = (f.status ?? '').toLowerCase();
  if (status.startsWith('cancel')) return { t, dep: null, arr: null, st: 'cancelled' };
  if (status !== 'arrived') return null;
  const dep = delayOf(f.departure);
  const arr = delayOf(f.arrival);
  if (dep === null && arr === null) return null;
  return { t, dep, arr, st: 'ok' };
}

/** Unisce voli nuovi e già noti (stessa partenza programmata = stesso volo) e toglie i più vecchi */
export function mergeOps(prev: FlightOp[], fresh: FlightOp[], now: number): FlightOp[] {
  const byTime = new Map<number, FlightOp>();
  for (const o of [...prev, ...fresh]) byTime.set(o.t, o);
  const cutoff = now - KEEP_DAYS * 86400000;
  return [...byTime.values()].filter((o) => o.t >= cutoff).sort((a, b) => a.t - b.t);
}

/** Percentile con interpolazione lineare su una lista già ordinata */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Statistiche di un lato (partenza o arrivo) dai ritardi misurati; null se i voli sono troppo pochi */
export function statsFromSamples(
  airportIcao: string,
  scheduledHourUtc: number,
  samples: number[],
  minSamples = MIN_RECENT_SAMPLES
): LegDelayStats | null {
  if (samples.length < minSamples) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const share = (pred: (d: number) => boolean) => Math.round((sorted.filter(pred).length / sorted.length) * 1000) / 1000;
  return {
    airportIcao,
    scheduledHourUtc,
    n: sorted.length,
    percentiles: PERCENTILE_LEVELS.map((l) => Math.round(quantile(sorted, l / 100) * 10) / 10),
    onTime: share((d) => d <= 15),
    over60: share((d) => d >= 60),
    source: 'recent',
  };
}

/** Voli del campione recente: ultimi RECENT_DAYS giorni, già conclusi */
export function recentSample(ops: FlightOp[], now: number): { dep: number[]; arr: number[]; total: number; cancelled: number } {
  const cutoff = now - RECENT_DAYS * 86400000;
  const recent = ops.filter((o) => o.t >= cutoff);
  return {
    dep: recent.filter((o) => o.st === 'ok' && o.dep !== null).map((o) => o.dep as number),
    arr: recent.filter((o) => o.st === 'ok' && o.arr !== null).map((o) => o.arr as number),
    total: recent.length,
    cancelled: recent.filter((o) => o.st === 'cancelled').length,
  };
}

/** "00:27:00" → 27, "-00:21:00" → -21, "01:21:00" → 81 */
export function parseDelayMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(-?)(\d+):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(m[4]) / 60 : 0);
  return Math.round((m[1] ? -minutes : minutes) * 10) / 10;
}

interface RawBracket {
  delayedFrom?: string;
  delayedTo?: string;
  percentage?: number;
}

interface RawEntry {
  airportIcao?: string;
  scheduledHourUtc?: number;
  numConsideredFlights?: number;
  delayPercentiles?: { percentile: number; delay: string }[];
  numFlightsDelayedBrackets?: RawBracket[];
}

/** Trasforma una voce della risposta in statistiche compatte, oppure null se mancano i dati */
export function normalizeLegEntry(entry: RawEntry | undefined): LegDelayStats | null {
  if (!entry?.airportIcao || !Array.isArray(entry.delayPercentiles)) return null;
  const byLevel = new Map<number, number>();
  for (const p of entry.delayPercentiles) {
    const v = parseDelayMinutes(p.delay);
    if (v !== null) byLevel.set(p.percentile, v);
  }
  const percentiles = PERCENTILE_LEVELS.map((l) => byLevel.get(l));
  if (percentiles.some((v) => v === undefined)) return null;
  let onTime = 0;
  let over60 = 0;
  for (const b of entry.numFlightsDelayedBrackets ?? []) {
    const share = typeof b.percentage === 'number' ? b.percentage : 0;
    const to = b.delayedTo === undefined ? Infinity : (parseDelayMinutes(b.delayedTo) ?? Infinity);
    const from = b.delayedFrom === undefined ? -Infinity : (parseDelayMinutes(b.delayedFrom) ?? -Infinity);
    if (to <= 15) onTime += share;
    if (from >= 60) over60 += share;
  }
  return {
    airportIcao: entry.airportIcao,
    scheduledHourUtc: entry.scheduledHourUtc ?? 0,
    n: entry.numConsideredFlights ?? 0,
    percentiles: percentiles as number[],
    onTime: Math.round(onTime * 1000) / 1000,
    over60: Math.round(over60 * 1000) / 1000,
    source: 'aggregate',
  };
}

/** Tra più voci dello stesso aeroporto sceglie quella con più voli considerati */
export function pickEntry(entries: RawEntry[] | undefined, icao: string): RawEntry | undefined {
  return (entries ?? [])
    .filter((e) => e.airportIcao === icao)
    .sort((a, b) => (b.numConsideredFlights ?? 0) - (a.numConsideredFlights ?? 0))[0];
}
