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
}

export interface FlightStatsDoc {
  flight: string;
  /** Millisecondi dell'ultimo aggiornamento */
  fetchedAt: number;
  fromUtc?: string;
  toUtc?: string;
  dep?: LegDelayStats;
  arr?: LegDelayStats;
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
  };
}

/** Tra più voci dello stesso aeroporto sceglie quella con più voli considerati */
export function pickEntry(entries: RawEntry[] | undefined, icao: string): RawEntry | undefined {
  return (entries ?? [])
    .filter((e) => e.airportIcao === icao)
    .sort((a, b) => (b.numConsideredFlights ?? 0) - (a.numConsideredFlights ?? 0))[0];
}
