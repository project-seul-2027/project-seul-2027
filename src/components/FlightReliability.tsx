import React, { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { FLIGHTS_SCHEDULE } from '../data/tripData';
import { TRACKED_FLIGHTS, type FlightStatsDoc, type LegDelayStats } from '../shared/flightStats';
import { useFlightStats } from '../services/useFlightStats';
import {
  RELIABILITY_LABEL,
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

type Tone = 'ok' | 'warn' | 'bad' | 'none';
const TONE: Record<Reliability, Tone> = { 'few-data': 'none', stable: 'ok', variable: 'warn', unstable: 'bad' };
const ICON: Record<Tone, typeof Info> = { ok: CheckCircle2, warn: AlertTriangle, bad: AlertOctagon, none: Info };
const DESK_TONE: Record<Tone, { text: string; chip: string; band: string; dot: string }> = {
  ok: { text: 'text-emerald-300', chip: 'bg-emerald-400/10 text-emerald-300', band: 'bg-emerald-400/30', dot: 'bg-emerald-300' },
  warn: { text: 'text-amber-300', chip: 'bg-amber-400/10 text-amber-300', band: 'bg-amber-400/30', dot: 'bg-amber-300' },
  bad: { text: 'text-rose-300', chip: 'bg-rose-400/10 text-rose-300', band: 'bg-rose-400/30', dot: 'bg-rose-300' },
  none: { text: 'text-slate-300', chip: 'bg-slate-700/40 text-slate-300', band: 'bg-slate-500/30', dot: 'bg-slate-300' },
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const clock = (hhmm: string, delta: number) => {
  const { time, dayShift } = shiftTime(hhmm, delta);
  return dayShift === 0 ? time : `${time} (${dayShift > 0 ? '+' : ''}${dayShift})`;
};

const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)} min`;
const shortName = (flightNumber: string) => flightNumber.replace(/ \(.*\)$/, '');

interface Props {
  /** true = telefono (stili .ms-rel), false = desktop */
  phone: boolean;
}

/** Stato in una parola, con icona: il colore non è mai l'unico segnale */
const StatusChip: React.FC<{ level: Reliability; phone: boolean }> = ({ level, phone }) => {
  const tone = TONE[level];
  const Icon = ICON[tone];
  return (
    <span className={phone ? `ms-rel-chip ms-rel-${tone}` : `inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${DESK_TONE[tone].chip}`}>
      <Icon size={14} aria-hidden="true" />
      {RELIABILITY_LABEL[level]}
    </span>
  );
};

/** Dove cade il ritardo: il segno è l'orario programmato, la fascia contiene 9 voli su 10, il pallino è il valore tipico */
const DelayBar: React.FC<{ s: LegSummary; tone: Tone; phone: boolean }> = ({ s, tone, phone }) => {
  const lo = -30;
  const hi = Math.max(90, Math.ceil((s.p90 + 15) / 30) * 30);
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  const left = pos(s.p10);
  const width = `calc(${pos(s.p90)} - ${left})`;
  const d = DESK_TONE[tone];
  return (
    <div
      className={phone ? 'ms-rel-scale' : 'mt-5'}
      role="img"
      aria-label={`Ritardo tipico ${signed(s.median)}; 9 voli su 10 tra ${signed(s.p10)} e ${signed(s.p90)}`}
    >
      <div className={phone ? 'ms-rel-track' : 'relative h-2 rounded-full bg-slate-800'}>
        <span className={phone ? `ms-rel-band ms-rel-${tone}` : `absolute top-0 h-2 rounded-full ${d.band}`} style={{ left, width }} />
        <span className={phone ? 'ms-rel-zero' : 'absolute -top-1 h-4 w-0.5 bg-slate-200'} style={{ left: pos(0) }} />
        <span className={phone ? `ms-rel-dot ms-rel-${tone}` : `absolute -top-0.5 h-3 w-3 -ml-1.5 rounded-full border-2 border-slate-900 ${d.dot}`} style={{ left: pos(s.median) }} />
      </div>
      <div className={phone ? 'ms-rel-axis' : 'relative mt-1 h-4 text-xs text-slate-500'}>
        <span className={phone ? undefined : 'absolute top-0'} style={{ left: 0 }}>{lo}</span>
        <span className={phone ? undefined : 'absolute top-0'} style={{ left: pos(0), transform: 'translateX(-50%)' }}>orario</span>
        <span className={phone ? undefined : 'absolute top-0'} style={{ right: 0 }}>+{hi}</span>
      </div>
    </div>
  );
};

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
    ["Entro 15 min dall'orario", `${Math.round(s.onTime * 100)}% dei voli`],
    ["Oltre un'ora di ritardo", `${Math.round(s.over60 * 100)}% dei voli`],
    ['Voli considerati', String(s.n)],
  ];
  return (
    <div className={phone ? 'ms-rel-detail' : 'text-sm'}>
      <p className={phone ? 'ms-rel-detail-title' : 'font-semibold text-white mb-2'}>{label}</p>
      <dl className={phone ? 'ms-rel-dl' : 'grid gap-y-1 text-slate-300'}>
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

const worstLevel = (a: LegSummary | null, b: LegSummary | null): Reliability =>
  [a, b].filter((x): x is LegSummary => !!x).reduce<Reliability>((w, s) => (RANK[s.level] > RANK[w] ? s.level : w), 'few-data');

const Notes: React.FC<{ doc: FlightStatsDoc; dep: LegSummary | null; arr: LegSummary | null; phone: boolean }> = ({ doc, dep, arr, phone }) => (
  <>
    {!!doc.cancelled && (
      <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>Cancellati {doc.cancelled} voli su {doc.total} nell'ultimo mese.</p>
    )}
    {(dep?.level === 'few-data' || arr?.level === 'few-data') && (
      <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>Voli registrati ancora pochi: le stime sono poco affidabili.</p>
    )}
    {(dep?.level === 'unstable' || arr?.level === 'unstable') && (
      <p className={phone ? 'ms-meta' : 'text-xs text-slate-400 col-span-2'}>Ritardi molto variabili: tieni un margine in più.</p>
    )}
  </>
);

/** Corpo espandibile: partenza e arrivo con tutti i numeri */
const DetailPanel: React.FC<{
  id: string;
  leg: { departureTime: string; arrivalTime: string };
  doc: FlightStatsDoc;
  dep: LegSummary | null;
  arr: LegSummary | null;
  phone: boolean;
}> = ({ id, leg, doc, dep, arr, phone }) => (
  <div id={id} className={phone ? 'ms-rel-panel' : 'mt-3 grid grid-cols-2 gap-6 rounded-lg bg-slate-900/60 p-4'}>
    {dep && doc.dep && <LegDetails label="Partenza" scheduled={leg.departureTime} s={dep} raw={doc.dep} phone={phone} />}
    {arr && doc.arr && <LegDetails label="Arrivo" scheduled={leg.arrivalTime} s={arr} raw={doc.arr} phone={phone} />}
    <Notes doc={doc} dep={dep} arr={arr} phone={phone} />
  </div>
);

/**
 * Riga sotto un volo: stato e ritardo tipico a colpo d'occhio; al tocco si aprono la barra del ritardo e tutti i numeri.
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
  const main = arr ?? dep;
  const level = worstLevel(dep, arr);
  const tone = TONE[level];
  const panelId = `leg-stats-${legId}`;
  return (
    <div className={phone ? 'ms-leg-stats' : 'mt-3'}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={phone ? 'ms-leg-stats-btn' : 'flex w-full items-center gap-3 text-left text-sm text-slate-300 hover:text-white min-h-[36px]'}
        data-testid={`leg-stats-${legId}`}
      >
        {main ? <StatusChip level={level} phone={phone} /> : null}
        <span className={phone ? 'ms-leg-stats-text' : 'flex-1'}>
          {main ? (
            <>
              Ritardo tipico <strong className={phone ? 'ms-rel-strong' : DESK_TONE[tone].text}>{signed(main.median)}</strong>
            </>
          ) : (
            'Puntualità del volo'
          )}
        </span>
        <ChevronDown size={18} aria-hidden="true" className={`${phone ? 'ms-rel-chev' : 'text-slate-400 transition-transform'} ${open ? 'ms-rel-open rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={panelId}>
          {arr && <DelayBar s={arr} tone={tone} phone={phone} />}
          {doc && (dep || arr) ? (
            <DetailPanel id={`${panelId}-d`} leg={leg} doc={doc} dep={dep} arr={arr} phone={phone} />
          ) : (
            <p className={phone ? 'ms-meta' : 'mt-3 text-sm text-slate-400'}>
              {stats === null ? 'Carico le statistiche…' : 'Statistiche non ancora disponibili: si aggiornano ogni giorno e compaiono dopo il primo aggiornamento.'}
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
      return { t, leg, doc, dep, arr, level: worstLevel(dep, arr) };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [stats]);

  if (stats === null) return null;

  const wrap = phone ? 'ms-rel' : 'mt-10 border-t border-slate-800/80 pt-10 space-y-6';
  const title = phone ? (
    <h2 className="ms-dir ms-cy" style={{ marginTop: 22 }}>Puntualità dei voli</h2>
  ) : (
    <h2 className="text-xl font-semibold text-white">Puntualità dei voli</h2>
  );

  if (rows.length === 0) {
    return (
      <section className={wrap} data-testid="flight-reliability">
        {title}
        <p className={phone ? 'ms-meta' : 'text-sm text-slate-400'}>Le statistiche si aggiornano ogni giorno: ancora nessun dato disponibile.</p>
      </section>
    );
  }

  // Coincidenza a Pechino: il primo volo in arrivo, il secondo in partenza
  const first = rows.find((r) => r.t.legId === 'fl_outbound_1');
  const next = FLIGHTS_SCHEDULE.find((l) => l.id === 'fl_outbound_2');
  let connection: { miss: ReturnType<typeof missConnection>; layover: number; tone: Tone } | null = null;
  if (first?.doc.arr && next) {
    const layover = toMinutes(next.departureTime) - toMinutes(first.leg.arrivalTime);
    if (layover > 0) {
      const miss = missConnection(first.doc.arr, layover, MIN_CONNECTION_MIN);
      const tone: Tone = miss.bound === 'lt5' || miss.value < 0.1 ? 'ok' : miss.bound === 'gt95' || miss.value >= 0.3 ? 'bad' : 'warn';
      connection = { miss, layover, tone };
    }
  }

  // Il volo con più variabilità tra tutti quelli del viaggio
  let widest: { flight: string; sigma: number } | null = null;
  for (const r of rows) {
    for (const s of [r.dep, r.arr]) {
      if (s && s.level !== 'few-data' && (!widest || s.sigma > widest.sigma)) widest = { flight: shortName(r.leg.flightNumber), sigma: s.sigma };
    }
  }

  const sample = rows[0].doc.dep?.n ?? rows[0].doc.arr?.n ?? 0;
  const allRecent = rows.every((r) => [r.doc.dep, r.doc.arr].every((s) => !s || s.source === 'recent'));
  const updated = new Date(Math.max(...rows.map((r) => r.doc.fetchedAt))).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const AlertIcon = connection ? ICON[connection.tone] : Info;

  return (
    <section className={wrap} data-testid="flight-reliability">
      {title}

      {connection && first && next && (
        <div
          className={phone ? `ms-rel-alert ms-rel-${connection.tone}` : `flex gap-3 rounded-xl p-4 ${DESK_TONE[connection.tone].chip}`}
          data-testid="rel-connection"
        >
          <AlertIcon size={20} aria-hidden="true" className={phone ? 'ms-rel-alert-icon' : 'mt-0.5 shrink-0'} />
          <div>
            <p className={phone ? 'ms-rel-alert-title' : 'font-semibold text-white'}>
              Coincidenza a Pechino: rischio {formatPercent(connection.miss)}
            </p>
            <p className={phone ? 'ms-rel-alert-text' : 'text-sm text-slate-300 mt-1'}>
              Scalo di {Math.floor(connection.layover / 60)} h {connection.layover % 60} min, ne servono almeno {MIN_CONNECTION_MIN}. Se {shortName(first.leg.flightNumber)} tarda troppo, perdi {shortName(next.flightNumber)}.
            </p>
          </div>
        </div>
      )}
      {widest && rows.length > 1 && widest.sigma >= 12 && (
        <p className={phone ? 'ms-meta' : 'text-sm text-slate-400'}>
          Il più incerto è <strong className={phone ? 'ms-rel-strong' : 'text-white'}>{widest.flight}</strong>: ritardi che variano di circa ±{Math.round(widest.sigma)} min da un giorno all'altro.
        </p>
      )}

      <ul className={phone ? 'ms-rel-list' : 'grid grid-cols-2 gap-4'}>
        {rows.map(({ t, leg, doc, dep, arr, level }) => {
          const tone = TONE[level];
          const main = (arr ?? dep) as LegSummary;
          const sched = arr ? leg.arrivalTime : leg.departureTime;
          const when = arr ? 'arrivo' : 'partenza';
          const open = openId === t.flight;
          const panelId = `rel-${t.flight}`;
          return (
            <li key={t.flight} className={phone ? 'ms-rel-item' : 'rounded-xl bg-slate-900/60 p-5'}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : t.flight)}
                aria-expanded={open}
                aria-controls={panelId}
                className={phone ? 'ms-rel-btn' : 'block w-full text-left'}
                data-testid={`rel-toggle-${t.flight}`}
              >
                <span className={phone ? 'ms-rel-head' : 'flex items-start justify-between gap-3'}>
                  <span>
                    <span className={phone ? 'ms-rel-name' : 'block text-lg font-semibold text-white'}>{shortName(leg.flightNumber)}</span>
                    <span className={phone ? 'ms-rel-route' : 'block text-sm text-slate-400'}>{leg.departureAirportCode} → {leg.arrivalAirportCode}</span>
                  </span>
                  <StatusChip level={level} phone={phone} />
                </span>
                <span className={phone ? 'ms-rel-main' : 'mt-4 flex items-end justify-between gap-3'}>
                  <span>
                    <span className={phone ? `ms-rel-big ms-rel-${tone}` : 'block text-3xl font-semibold tabular-nums text-white'}>
                      {Math.round(main.median) === 0 ? 'In orario' : signed(main.median)}
                    </span>
                    <span className={phone ? 'ms-rel-cap' : 'block text-sm text-slate-400'}>
                      {main.median < 0 ? 'anticipo' : 'ritardo'} tipico {when === 'arrivo' ? "all'arrivo" : 'in partenza'}
                    </span>
                  </span>
                  <span className={phone ? 'ms-rel-time' : 'text-right'}>
                    <span className={phone ? 'ms-rel-time-big' : 'block text-xl font-semibold text-white tabular-nums'}>{clock(sched, main.median)}</span>
                    <span className={phone ? 'ms-rel-cap' : 'block text-sm text-slate-400'}>programmato {sched}</span>
                  </span>
                </span>
              </button>
              <DelayBar s={main} tone={tone} phone={phone} />
              <p className={phone ? 'ms-rel-range' : 'mt-3 text-sm text-slate-300'}>
                {level === 'few-data'
                  ? 'Voli registrati ancora pochi: stima poco affidabile.'
                  : `9 volte su 10 ${when === 'arrivo' ? 'arriva' : 'parte'} tra le ${clock(sched, main.p10)} e le ${clock(sched, main.p90)}.`}
              </p>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : t.flight)}
                aria-expanded={open}
                aria-controls={panelId}
                className={phone ? 'ms-rel-more' : 'mt-2 flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200'}
              >
                {open ? 'Meno dettagli' : 'Tutti i numeri'}
                <ChevronDown size={16} aria-hidden="true" className={`${phone ? 'ms-rel-chev' : 'transition-transform'} ${open ? 'ms-rel-open rotate-180' : ''}`} />
              </button>
              {open && <DetailPanel id={panelId} leg={leg} doc={doc} dep={dep} arr={arr} phone={phone} />}
            </li>
          );
        })}
      </ul>
      <p className={phone ? 'ms-meta' : 'text-xs text-slate-500'}>
        Come hanno viaggiato questi voli {allRecent ? "nell'ultimo mese" : 'negli ultimi mesi'} (circa {sample} voli per tratta), aggiornato al {updated}. Sono medie del passato, non una previsione. Dati AeroDataBox.
      </p>
    </section>
  );
};
