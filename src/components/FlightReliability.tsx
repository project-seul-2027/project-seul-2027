import React, { useMemo, useState } from 'react';
import { FLIGHTS_SCHEDULE } from '../data/tripData';
import { TRACKED_FLIGHTS, type FlightStatsDoc, type LegDelayStats } from '../shared/flightStats';
import { useFlightStats } from '../services/useFlightStats';
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

const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)} min`;

interface Props {
  /** true = telefono (stili .ms-rel), false = desktop */
  phone: boolean;
}

/** Dettagli di un tratto: orari medi, ritardo medio, deviazione standard e fasce */
const LegDetails: React.FC<{ label: string; scheduled: string; s: LegSummary; raw: LegDelayStats; phone: boolean }> = ({ label, scheduled, s, raw, phone }) => {
  const rows: [string, string][] = [
    ['Orario programmato', scheduled],
    ['Orario tipico (mediana)', clock(scheduled, s.median)],
    ['Orario medio', clock(scheduled, s.mean)],
    ['Ritardo tipico (mediana)', signed(s.median)],
    ['Ritardo medio', signed(s.mean)],
    ['Deviazione standard', `±${Math.round(s.sigma)} min`],
    ['Fascia 10°–90°', `${clock(scheduled, s.p10)} – ${clock(scheduled, s.p90)}`],
    ['Fascia 5°–95°', `${clock(scheduled, raw.percentiles[0])} – ${clock(scheduled, raw.percentiles[18])}`],
    ['Entro 15 min dall\'orario', `${Math.round(s.onTime * 100)}% dei voli`],
    ['Oltre un\'ora di ritardo', `${Math.round(s.over60 * 100)}% dei voli`],
    ['Voli considerati', String(s.n)],
  ];
  return (
    <div className={phone ? 'ms-rel-detail' : 'text-sm'}>
      <p className={phone ? 'ms-rel-detail-title' : 'font-semibold text-white mb-2'}>{label}</p>
      <dl className={phone ? 'ms-rel-dl' : 'grid grid-cols-2 gap-x-6 gap-y-1 text-slate-300'}>
        {rows.map(([k, v]) => (
          <div key={k} className={phone ? 'ms-rel-dl-row' : 'flex justify-between gap-3'}>
            <dt className={phone ? 'ms-mute' : 'text-slate-400'}>{k}</dt>
            <dd className={phone ? 'ms-rel-dd' : 'text-white tabular-nums'}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * Pulsante "Puntualità e orari medi" sotto un volo: apre gli orari medi, il ritardo medio, la deviazione standard e le fasce.
 * Se le statistiche non ci sono ancora lo dice, invece di restare muto.
 */
export const LegStatsToggle: React.FC<{ legId: string; phone: boolean }> = ({ legId, phone }) => {
  const stats = useFlightStats();
  const [open, setOpen] = useState(false);
  const t = TRACKED_FLIGHTS.find((x) => x.legId === legId);
  const leg = FLIGHTS_SCHEDULE.find((l) => l.id === legId);
  if (!t || !leg) return null;
  const doc = stats?.[t.flight];
  const dep = doc?.dep ? summarize(doc.dep) : null;
  const arr = doc?.arr ? summarize(doc.arr) : null;
  const panelId = `leg-stats-${legId}`;
  return (
    <div className={phone ? 'ms-leg-stats' : 'mt-3'}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={phone ? 'ms-leg-stats-btn' : 'text-sm text-cyan-300 hover:text-cyan-200 min-h-[32px]'}
        data-testid={`leg-stats-${legId}`}
      >
        Puntualità e orari medi {open ? '▴' : '▾'}
      </button>
      {open && (
        <div id={panelId} className={phone ? 'ms-rel-panel' : 'mt-3 grid grid-cols-2 gap-6 rounded-lg bg-slate-900/60 p-4'}>
          {dep && doc?.dep && <LegDetails label="Partenza" scheduled={leg.departureTime} s={dep} raw={doc.dep} phone={phone} />}
          {arr && doc?.arr && <LegDetails label="Arrivo" scheduled={leg.arrivalTime} s={arr} raw={doc.arr} phone={phone} />}
          {!dep && !arr && (
            <p className={phone ? 'ms-meta' : 'text-sm text-slate-400 col-span-2'}>
              {stats === null
                ? 'Carico le statistiche…'
                : 'Statistiche non ancora disponibili: si aggiornano ogni giorno e compaiono dopo il primo aggiornamento.'}
            </p>
          )}
          {!!doc?.cancelled && (
            <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>
              Cancellati {doc.cancelled} voli su {doc.total} nell'ultimo mese.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const FlightReliability: React.FC<Props> = ({ phone }) => {
  const stats = useFlightStats();
  const [openId, setOpenId] = useState<string | null>(null);

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
  const allRecent = rows.every((r) => [r.doc.dep, r.doc.arr].every((s) => !s || s.source === 'recent'));
  const updated = new Date(Math.max(...rows.map((r) => r.doc.fetchedAt))).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  return (
    <section className={wrap} data-testid="flight-reliability">
      {title}
      <p className={phone ? 'ms-meta' : 'text-sm text-slate-400'}>
        {allRecent
          ? `Come hanno viaggiato questi voli nell'ultimo mese (circa ${sample} voli per tratta), aggiornato al ${updated}.`
          : `Come hanno viaggiato questi voli negli ultimi mesi (circa ${sample} voli per tratta), aggiornato al ${updated}.`}{' '}
        Sono medie del passato, non una previsione.
      </p>
      {widest && rows.length > 1 && (
        <p className={phone ? 'ms-rel-note' : 'text-sm text-slate-300'}>
          <strong>Il più incerto è {widest.flight}</strong>: in {widest.where} i ritardi variano di circa ±{Math.round(widest.sigma)} minuti da un giorno all'altro.
        </p>
      )}

      <ul className={phone ? 'ms-rel-list' : 'space-y-4'}>
        {rows.map(({ t, leg, doc, dep, arr, level }) => {
          const next = FLIGHTS_SCHEDULE.find((l) => l.id === 'fl_outbound_2');
          let miss: ReturnType<typeof missConnection> | null = null;
          let layover = 0;
          if (t.legId === 'fl_outbound_1' && doc.arr && next) {
            layover = toMinutes(next.departureTime) - toMinutes(leg.arrivalTime);
            if (layover > 0) miss = missConnection(doc.arr, layover, MIN_CONNECTION_MIN);
          }
          const open = openId === t.flight;
          const panelId = `rel-${t.flight}`;
          return (
            <li key={t.flight} className={phone ? 'ms-rel-item' : 'border-t border-slate-800/80 pt-4'}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : t.flight)}
                aria-expanded={open}
                aria-controls={panelId}
                className={`${phone ? 'ms-rel-head ms-rel-btn' : 'flex w-full items-baseline justify-between text-left'}`}
                data-testid={`rel-toggle-${t.flight}`}
              >
                <span className={phone ? 'ms-rel-name' : 'text-base font-semibold text-white'}>
                  {leg.flightNumber.replace(/ \(.*\)$/, '')} · {leg.departureAirportCode} → {leg.arrivalAirportCode}
                </span>
                <span className={phone ? `ms-rel-badge ms-rel-${level}` : `text-sm font-semibold ${level === 'unstable' ? 'text-rose-300' : level === 'variable' ? 'text-amber-300' : level === 'stable' ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {RELIABILITY_LABEL[level]} {open ? '▴' : '▾'}
                </span>
              </button>

              {dep && (
                <p className={phone ? 'ms-rel-line' : 'text-sm text-slate-300 mt-2'}>
                  <strong>Partenza</strong> {leg.departureTime}: di solito {clock(leg.departureTime, dep.median)}, tra le {clock(leg.departureTime, dep.p10)} e le {clock(leg.departureTime, dep.p90)}.{' '}
                  <span className={phone ? 'ms-mute' : 'text-slate-400'}>{formatDelay(dep.median)}, ±{Math.round(dep.sigma)} min.</span>
                </p>
              )}
              {arr && (
                <p className={phone ? 'ms-rel-line' : 'text-sm text-slate-300 mt-1'}>
                  <strong>Arrivo</strong> {leg.arrivalTime}: di solito {clock(leg.arrivalTime, arr.median)}, tra le {clock(leg.arrivalTime, arr.p10)} e le {clock(leg.arrivalTime, arr.p90)}.{' '}
                  <span className={phone ? 'ms-mute' : 'text-slate-400'}>{formatDelay(arr.median)}, ±{Math.round(arr.sigma)} min.</span>
                </p>
              )}
              {miss && (
                <p className={phone ? 'ms-rel-note' : 'text-sm text-slate-300 mt-2'}>
                  <strong>Coincidenza a Pechino</strong>: scalo di {Math.floor(layover / 60)} h {layover % 60} min, ne servono almeno {MIN_CONNECTION_MIN} per cambiare aereo. Probabilità di arrivare troppo tardi: {formatPercent(miss)}.
                </p>
              )}

              {open && (
                <div id={panelId} className={phone ? 'ms-rel-panel' : 'mt-3 grid grid-cols-2 gap-6'}>
                  {dep && <LegDetails label="Partenza" scheduled={leg.departureTime} s={dep} raw={doc.dep!} phone={phone} />}
                  {arr && <LegDetails label="Arrivo" scheduled={leg.arrivalTime} s={arr} raw={doc.arr!} phone={phone} />}
                  {!!doc.cancelled && (
                    <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>
                      Cancellati {doc.cancelled} voli su {doc.total} nell'ultimo mese.
                    </p>
                  )}
                  {(dep?.level === 'few-data' || arr?.level === 'few-data') && (
                    <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>Voli registrati ancora pochi: le stime sono poco affidabili.</p>
                  )}
                  {dep?.level === 'unstable' && (
                    <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>Ritardi molto variabili: tieni un margine in più.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className={phone ? 'ms-meta' : 'text-xs text-slate-500'}>Dati AeroDataBox, aggiornati ogni giorno. "Di solito" è la mediana; la fascia va dal 10° al 90° percentile.</p>
    </section>
  );
};
