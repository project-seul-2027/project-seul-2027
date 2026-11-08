import { PERCENTILE_LEVELS, type LegDelayStats } from '../shared/flightStats';

// Dai percentili del ritardo (5%, 10% … 95%) ricava ciò che serve al viaggiatore:
// ritardo tipico, quanto varia da un giorno all'altro, e quanto è probabile superare una soglia.

export type Reliability = 'few-data' | 'stable' | 'variable' | 'unstable';

export interface LegSummary {
  n: number;
  /** Ritardo del volo "tipico" (mediana), in minuti; negativo = in anticipo */
  median: number;
  /** Media dei percentili: stima del ritardo medio senza i casi estremi (5% per lato) */
  mean: number;
  p10: number;
  p90: number;
  p95: number;
  /** Deviazione standard stimata da percentili robusti: come variano i ritardi, minuti */
  sigma: number;
  onTime: number;
  over60: number;
  level: Reliability;
}

/** Sotto questo numero di voli le stime sono troppo fragili per giudicare */
export const MIN_FLIGHTS = 15;

const P = (s: LegDelayStats, level: number) => s.percentiles[PERCENTILE_LEVELS.indexOf(level as never)];

export function summarize(s: LegDelayStats): LegSummary {
  const p10 = P(s, 10);
  const p90 = P(s, 90);
  const p95 = P(s, 95);
  // Per una distribuzione normale (p90-p10)/2,563 e (p75-p25)/1,349 valgono la deviazione standard;
  // la media dei due regge meglio ai ritardi con coda lunga di quanto farebbe la deviazione classica
  const sigma = ((p90 - p10) / 2.563 + (P(s, 75) - P(s, 25)) / 1.349) / 2;
  const mean = s.percentiles.reduce((a, b) => a + b, 0) / s.percentiles.length;
  let level: Reliability;
  if (s.n < MIN_FLIGHTS) level = 'few-data';
  else if (sigma >= 30 || p95 >= 120) level = 'unstable';
  else if (sigma >= 12) level = 'variable';
  else level = 'stable';
  return {
    n: s.n,
    median: P(s, 50),
    mean: Math.round(mean * 10) / 10,
    p10,
    p90,
    p95,
    sigma: Math.round(sigma * 10) / 10,
    onTime: s.onTime,
    over60: s.over60,
    level,
  };
}

export interface Exceedance {
  /** Probabilità (0-1) di superare la soglia */
  value: number;
  /** "lt5" = meno del 5%, "gt95" = più del 95% (fuori dai percentili noti) */
  bound?: 'lt5' | 'gt95';
}

/** Probabilità che il ritardo superi `minutes`, interpolando tra i percentili */
export function probOver(s: LegDelayStats, minutes: number): Exceedance {
  const ps = s.percentiles;
  if (minutes >= ps[ps.length - 1]) return { value: 0.05, bound: 'lt5' };
  if (minutes < ps[0]) return { value: 0.95, bound: 'gt95' };
  for (let i = 0; i < ps.length - 1; i++) {
    if (minutes >= ps[i] && minutes <= ps[i + 1]) {
      const span = ps[i + 1] - ps[i];
      const t = span === 0 ? 0 : (minutes - ps[i]) / span;
      const cdf = (PERCENTILE_LEVELS[i] + t * (PERCENTILE_LEVELS[i + 1] - PERCENTILE_LEVELS[i])) / 100;
      return { value: 1 - cdf };
    }
  }
  return { value: 0.5 };
}

/**
 * Rischio di perdere una coincidenza: l'arrivo del primo volo supera il tempo di scalo meno il minimo
 * necessario per cambiare aereo. Non conta che anche il secondo volo possa partire in ritardo (a favore di sicurezza).
 */
export function missConnection(arrival: LegDelayStats, layoverMinutes: number, minConnectionMinutes: number): Exceedance {
  return probOver(arrival, layoverMinutes - minConnectionMinutes);
}

/** "12:30" + 27 minuti → "12:57" (con +1/-1 se cambia giorno) */
export function shiftTime(hhmm: string, minutes: number): { time: string; dayShift: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return { time: hhmm, dayShift: 0 };
  const total = Number(m[1]) * 60 + Number(m[2]) + Math.round(minutes);
  const dayShift = Math.floor(total / 1440);
  const inDay = ((total % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { time: `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`, dayShift };
}

export function formatDelay(minutes: number): string {
  const r = Math.round(minutes);
  if (r === 0) return 'in orario';
  const abs = Math.abs(r);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const text = h > 0 ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  return r > 0 ? `${text} di ritardo` : `${text} in anticipo`;
}

export const formatPercent = (e: Exceedance): string => {
  if (e.bound === 'lt5') return 'meno del 5%';
  if (e.bound === 'gt95') return 'oltre il 95%';
  return `${Math.round(e.value * 100)}%`;
};

export const RELIABILITY_LABEL: Record<Reliability, string> = {
  'few-data': 'Pochi dati',
  stable: 'Stabile',
  variable: 'Variabile',
  unstable: 'Instabile',
};
