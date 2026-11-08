import React, { useEffect, useMemo, useState } from 'react';
import { FLIGHTS_SCHEDULE } from '../data/tripData';
import { TRACKED_FLIGHTS, type FlightStatsDoc } from '../shared/flightStats';
import { flightStatsService, type FlightStatsMap } from '../services/flightStatsService';
import {
  RELIABILITY_LABEL,
  formatDelay,
  formatPercent,
  missConnection,
  shiftTime,
  summarize,
  type LegSummary,
  type Reliability,
} from '../utils/flightStats';

// Tempo minimo per cambiare aereo a Pechino T3 tra due voli internazionali: ipotesi prudente, non un dato dell'aeroporto
const MIN_CONNECTION_MIN = 75;

const RANK: Record<Reliability, number> = { 'few-data': 0, stable: 1, variable: 2, unstable: 3 };

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const clock = (hhmm: string, delta: number) => {
  const { time, dayShift } = shiftTime(hhmm, delta);
  return dayShift === 0 ? time : `${time} (${dayShift > 0 ? '+' : ''}${dayShift})`;
};

interface Props {
  /** true = telefono (stili .ms-rel), false = desktop */
  phone: boolean;
}

export const FlightReliability: React.FC<Props> = ({ phone }) => {
  const [stats, setStats] = useState<FlightStatsMap | null>(null);
  useEffect(() => flightStatsService.watch(setStats, (err) => console.warn('Puntualità dei voli non leggibile:', err)), []);

  const rows = useMemo(() => {
    if (!stats) return [];
    return TRACKED_FLIGHTS.map((t) => {
      const leg = FLIGHTS_SCHEDULE.find((l) => l.id === t.legId);
      const doc: FlightStatsDoc | undefined = stats[t.flight];
      if (!leg || !doc) return null;
      const dep = doc.dep ? summarize(doc.dep) : null;
      const arr = doc.arr ? summarize(doc.arr) : null;
      if (!dep && !arr) return null;
      const level = [dep, arr].filter((x): x is LegSummary => !!x).reduce<Reliability>(
        (worst, s) => (RANK[s.level] > RANK[worst] ? s.level : worst),
        'few-data'
      );
      return { t, leg, doc, dep, arr, level };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [stats]);

  if (stats === null) return null;

  const wrap = phone ? 'ms-rel' : 'mt-10 border-t border-slate-800/80 pt-10 space-y-6';
  const title = phone ? <h2 className="ms-dir ms-cy" style={{ marginTop: 22 }}>Puntualità dei voli</h2> : <h2 className="text-xl font-semibold text-white">Puntualità dei voli</h2>;

  if (rows.length === 0) {
    return (
      <section className={wrap} data-testid="flight-reliability">
        {title}
        <p className={phone ? 'ms-meta' : 'text-sm text-slate-400'}>Le statistiche si aggiornano ogni giorno: ancora nessun dato disponibile.</p>
      </section>
    );
  }

  // Il volo con più variabilità tra tutti quelli del viaggio
  let widest: { flight: string; sigma: number; where: string } | null = null;
  for (const r of rows) {
    for (const [where, s] of [['partenza', r.dep], ['arrivo', r.arr]] as const) {
      if (s && s.level !== 'few-data' && (!widest || s.sigma > widest.sigma)) widest = { flight: r.leg.flightNumber.replace(/ \(.*\)$/, ''), sigma: s.sigma, where };
    }
  }

  const sample = rows[0].doc.dep?.n ?? rows[0].doc.arr?.n ?? 0;

  return (
    <section className={wrap} data-testid="flight-reliability">
      {title}
      <p className={phone ? 'ms-meta' : 'text-sm text-slate-400'}>
        Come hanno viaggiato questi voli negli ultimi 90 giorni circa (circa {sample} voli per tratta). Sono medie del passato, non una previsione.
      </p>
      {widest && rows.length > 1 && (
        <p className={phone ? 'ms-rel-note' : 'text-sm text-slate-300'}>
          <strong>Il più incerto è {widest.flight}</strong>: in {widest.where} i ritardi variano di circa ±{Math.round(widest.sigma)} minuti da un giorno all'altro.
        </p>
      )}

      <ul className={phone ? 'ms-rel-list' : 'space-y-8'}>
        {rows.map(({ t, leg, doc, dep, arr, level }) => {
          const next = FLIGHTS_SCHEDULE.find((l) => l.id === 'fl_outbound_2');
          let miss: ReturnType<typeof missConnection> | null = null;
          let layover = 0;
          if (t.legId === 'fl_outbound_1' && doc.arr && next) {
            layover = toMinutes(next.departureTime) - toMinutes(leg.arrivalTime);
            if (layover > 0) miss = missConnection(doc.arr, layover, MIN_CONNECTION_MIN);
          }
          return (
            <li key={t.flight} className={phone ? 'ms-rel-item' : 'space-y-2'}>
              <div className={phone ? 'ms-rel-head' : 'flex items-baseline justify-between'}>
                <span className={phone ? 'ms-rel-name' : 'text-base font-semibold text-white'}>
                  {leg.flightNumber.replace(/ \(.*\)$/, '')} · {leg.departureAirportCode} → {leg.arrivalAirportCode}
                </span>
                <span className={phone ? `ms-rel-badge ms-rel-${level}` : `text-sm font-semibold ${level === 'unstable' ? 'text-rose-300' : level === 'variable' ? 'text-amber-300' : level === 'stable' ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {RELIABILITY_LABEL[level]}
                </span>
              </div>

              {dep && (
                <p className={phone ? 'ms-rel-line' : 'text-sm text-slate-300'}>
                  <strong>Partenza</strong> {leg.departureTime}: di solito {clock(leg.departureTime, dep.median)}, tra le {clock(leg.departureTime, dep.p10)} e le {clock(leg.departureTime, dep.p90)}.{' '}
                  <span className={phone ? 'ms-mute' : 'text-slate-400'}>{formatDelay(dep.median)}, ±{Math.round(dep.sigma)} min.</span>
                </p>
              )}
              {arr && (
                <p className={phone ? 'ms-rel-line' : 'text-sm text-slate-300'}>
                  <strong>Arrivo</strong> {leg.arrivalTime}: di solito {clock(leg.arrivalTime, arr.median)}, tra le {clock(leg.arrivalTime, arr.p10)} e le {clock(leg.arrivalTime, arr.p90)}.{' '}
                  <span className={phone ? 'ms-mute' : 'text-slate-400'}>{formatDelay(arr.median)}, ±{Math.round(arr.sigma)} min.</span>
                </p>
              )}
              {dep && dep.level !== 'few-data' && (
                <p className={phone ? 'ms-meta' : 'text-xs text-slate-400'}>
                  In partenza entro 15 min dall'orario {Math.round(dep.onTime * 100)}% dei voli, oltre un'ora di ritardo {Math.round(dep.over60 * 100)}%.
                  {dep.level === 'unstable' && ' Ritardi molto variabili: tieni un margine in più.'}
                </p>
              )}
              {(dep?.level === 'few-data' || arr?.level === 'few-data') && (
                <p className={phone ? 'ms-meta' : 'text-xs text-slate-400'}>Voli registrati ancora pochi: le stime sono poco affidabili.</p>
              )}
              {miss && (
                <p className={phone ? 'ms-rel-note' : 'text-sm text-slate-300'}>
                  <strong>Coincidenza a Pechino</strong>: scalo di {Math.floor(layover / 60)} h {layover % 60} min, ne servono almeno {MIN_CONNECTION_MIN} per cambiare aereo. Probabilità di arrivare troppo tardi: {formatPercent(miss)}.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className={phone ? 'ms-meta' : 'text-xs text-slate-500'}>Dati AeroDataBox, aggiornati ogni giorno. "Di solito" è la mediana; la fascia va dal 10° al 90° percentile.</p>
    </section>
  );
};
