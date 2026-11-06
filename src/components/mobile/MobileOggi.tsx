import React, { useEffect, useState } from 'react';
import HeroVideo from '../HeroVideo';
import { TIMED_DAYS } from '../../utils/tripClock';
import { launchState, splitDuration } from '../../utils/launchClock';
import './mobile.css';

/**
 * Schermata "Oggi" del telefono, come nel mockup:
 *  - prima e durante i voli: video della città con gradiente, conto alla rovescia grande, poi "Poi" e "Che ore sono"
 *  - in viaggio: prossima tappa con orario grande, "Dopo" e link di testo
 * Non calcola nulla del programma: riceve i dati già pronti da TodayView.
 */

type Zone = 'IT' | 'KR' | 'CN';

export interface OggiItem {
  clock: string;
  label: string;
  zone: Zone;
  /** "35 minuti": tempo che manca all'inizio */
  inText?: string;
}

interface Props {
  now: number;
  /** Anteprima attiva: si mostra sempre la versione "in viaggio" */
  simulated: boolean;
  after: boolean;
  dateLine: string;
  dayTitle: string;
  dayN: number;
  dayTotal: number;
  seoulTime: string;
  current: OggiItem | null;
  next: OggiItem | null;
  following: OggiItem[];
  done: boolean;
  free: boolean;
  metro: { level: 'none' | 'warn' | 'closed' | string; title: string; text: string };
  stop: { id: string; name: string } | null;
  homeId: string;
  heroEnabled: boolean;
  onToggleHero: () => void;
  onRoute: (id: string) => void;
  onGoTo: (tab: 'itinerary' | 'places' | 'map' | 'show' | 'wallet') => void;
  onTryTrip: () => void;
  onPreview: () => void;
  simBanner?: React.ReactNode;
  previewPanel?: React.ReactNode;
}

const ZONE_CITY: Record<Zone, string> = { IT: 'Milano', CN: 'Pechino', KR: 'Seul' };
const ZONE_CLASS: Record<Zone, string> = { IT: 'it', CN: 'cn', KR: 'kr' };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clockIn = (ts: number, tz: string) =>
  new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(ts));

const briefOf = (item: { summary?: string; activity: string }) =>
  item.summary ?? (item.activity.split(/(?<=[.!?])\s/)[0] ?? item.activity).slice(0, 90);

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/** Durata grande: l'unità più grande domina, le altre sono più piccole ("114 giorni", poi "15 h") */
function BigDuration({ ms }: { ms: number }) {
  const { days, hh, mm, ss } = splitDuration(ms);
  const totalH = Math.floor(ms / 3_600_000);
  const totalM = Math.floor(ms / 60_000);
  if (days > 0) {
    return <><span className="lead">{days}</span><span className="u">{days === 1 ? 'giorno' : 'giorni'}</span><span className="rest">{Number(hh)} h {mm} min {ss} s</span></>;
  }
  if (totalH > 0) {
    return <><span className="lead">{totalH}</span><span className="u">ore</span><span className="rest">{mm} min {ss} s</span></>;
  }
  return <><span className="lead">{totalM}</span><span className="u">min</span><span className="rest">{ss} s</span></>;
}

/** Testata con video dal primo pixel e sfumatura verso il blu della pagina; il contenuto sta in basso */
const Hero: React.FC<{ enabled: boolean; testId?: string; state?: string; banner?: React.ReactNode; children: React.ReactNode }> = ({ enabled, testId = 'today-hero', state, banner, children }) => (
  <section className="relative isolate overflow-hidden" style={{ minHeight: 'calc(410px + env(safe-area-inset-top))' }} data-testid={testId} data-state={state}>
    <HeroVideo enabled={enabled} overlay={false} className="-z-20" />
    <div
      aria-hidden
      className="absolute inset-0 -z-10"
      style={{ background: 'linear-gradient(to bottom, rgba(10,17,25,0.72) 0%, rgba(10,17,25,0.38) 16%, rgba(10,17,25,0.14) 32%, rgba(10,17,25,0.34) 52%, rgba(10,17,25,0.7) 72%, rgba(10,17,25,0.94) 90%, #0a1119 100%)' }}
    />
    <div className="relative flex flex-col justify-end" style={{ minHeight: 'calc(410px + env(safe-area-inset-top))', padding: '84px 20px 22px' }}>{banner && <div style={{ paddingBottom: 10 }}>{banner}</div>}{children}</div>
  </section>
);

/** Zone orarie in una riga: Milano, Pechino, Seul */
const WorldTimes: React.FC<{ now: number }> = ({ now }) => (
  <section className="ms-sec" style={{ marginTop: 10, paddingBottom: 0 }} aria-label="Che ore sono" data-testid="today-clocks">
    <h3 className="ms-h2" style={{ marginBottom: 12 }}>Che ore sono</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <div style={{ paddingBottom: 16 }}>
        <p className="ms-key">{clockIn(now, 'Europe/Rome')}</p>
        <p className="ms-sm ms-vi" style={{ marginTop: 6, fontWeight: 600 }}>Milano</p>
      </div>
      <div style={{ borderLeft: '1px solid var(--ms-line)', paddingLeft: 16, paddingBottom: 16 }}>
        <p className="ms-key">{clockIn(now, 'Asia/Shanghai')}</p>
        <p className="ms-sm ms-am" style={{ marginTop: 6, fontWeight: 600 }}>Pechino</p>
      </div>
      <div style={{ borderLeft: '1px solid var(--ms-line)', paddingLeft: 16, paddingBottom: 16 }}>
        <p className="ms-key">{clockIn(now, 'Asia/Seoul')}</p>
        <p className="ms-sm ms-cy" style={{ marginTop: 6, fontWeight: 600 }}>Seul</p>
      </div>
    </div>
  </section>
);

export const MobileOggi: React.FC<Props> = (p) => {
  useTick(1000);
  // Il conto scorre ogni secondo: TodayView aggiorna "now" solo ogni 20 secondi
  const liveNow = p.simulated ? p.now : Date.now();
  const L = !p.simulated && !p.after ? launchState(liveNow) : null;

  /* ---------------- Prima della partenza e durante i voli: video con gradiente ---------------- */
  if (L && L.kind !== 'trip') {
    const isCount = L.kind === 'countdown';
    const ms = isCount ? Math.max(0, L.target - liveNow) : 0;
    const label = L.eyebrow.startsWith('Prossimo ritrovo')
      ? 'Al ritrovo a Malpensa T1 mancano'
      : L.eyebrow.startsWith('Verso Pechino')
        ? "All'atterraggio a Pechino mancano"
        : L.eyebrow.startsWith('Verso Seul')
          ? "All'arrivo a Incheon mancano"
          : L.eyebrow;
    const m = L.caption.match(/^(.*?),\s*(.*)$/);
    const title = isCount ? (m ? m[1] : L.caption) : 'Si parte!';
    const sub = isCount ? '' : L.caption;
    const after = isCount ? L.target : p.now;
    const flat = TIMED_DAYS.slice(0, 2).flatMap((d) => d.items);
    const poi = flat.filter((t) => t.ts > after).slice(0, 2);

    return (
      <div className="ms-hero-wrap -mx-5 -mt-5">
        <Hero enabled={p.heroEnabled} state="before" banner={p.simBanner}>
          <p style={{ color: '#dbe5ef', fontSize: 14, paddingBottom: 10 }} data-testid="today-daycount">{cap(p.dateLine)}</p>
          <p style={{ color: 'var(--ms-text)' }}>{label}</p>
          {isCount && (
            <p className="ms-cd" style={{ margin: '6px 0 10px' }} role="timer" aria-label={`${label} ${splitDuration(ms).days} giorni`}>
              <BigDuration ms={ms} />
            </p>
          )}
          <h2 className="ms-h2" data-testid="today-now" style={!isCount ? { fontSize: 40, lineHeight: 1.05, margin: '6px 0 0' } : undefined}>{title}</h2>
          {sub && <p style={{ color: '#c3cfdd', marginTop: 4 }}>{sub}</p>}
          {L.kind === 'countdown' && L.eyebrow.startsWith('Prossimo ritrovo') && (
            <div className="ms-acts" style={{ marginTop: 8 }}>
              <button type="button" className="ms-link" onClick={p.onTryTrip} data-testid="try-trip-mode">Prova il viaggio</button>
              <button type="button" className="ms-link" onClick={() => p.onGoTo('itinerary')}>Vedi il programma</button>
            </div>
          )}
        </Hero>

        <div style={{ padding: '0 20px' }}>
          {p.previewPanel && <div style={{ paddingTop: 12 }}>{p.previewPanel}</div>}
          {poi.length > 0 && (
            <section style={{ paddingTop: 6 }}>
              <h3 className="ms-h2" style={{ marginBottom: 8 }}>Poi</h3>
              {poi.map((t, i) => (
                <div className="ms-row" key={i}>
                  <span className="t">{t.clock || t.item.time}<span className={`z ${ZONE_CLASS[t.zone]}`}>{ZONE_CITY[t.zone]}</span></span>
                  <p>{briefOf(t.item)}</p>
                </div>
              ))}
            </section>
          )}
          <WorldTimes now={p.now} />
          <div className="ms-sec" style={{ paddingBottom: 0 }}>
            <button type="button" className="ms-link" onClick={p.onPreview} data-testid="preview-toggle">Anteprima del viaggio</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- In viaggio: prossima tappa ---------------- */
  const focus = p.current ?? p.next;
  const dayLine = `${cap(p.dateLine)} · giorno ${p.dayN} di ${p.dayTotal} · a Seul sono le ${p.seoulTime}`;
  const rows: OggiItem[] = p.current ? [p.next, ...p.following].filter((x): x is OggiItem => !!x) : p.following;
  const showHomeAsButton = p.metro.level !== 'none' || p.done;

  return (
    <div className="ms-hero-wrap -mx-5 -mt-5">
      <Hero enabled={p.heroEnabled} banner={p.simBanner} state={p.after ? 'after' : p.current ? 'now' : p.next ? 'next' : p.done ? 'done' : 'free'}>
      <p style={{ color: '#dbe5ef', fontSize: 14, paddingBottom: 10 }} data-testid="today-daycount">{dayLine}</p>
        {p.after ? (
          <>
            <h2 className="ms-h2" data-testid="today-now">Bentornati! Spero sia stato bellissimo.</h2>
            <p className="ms-mute" style={{ marginTop: 6 }}>La galleria e le spese restano qui per ripensarci con calma.</p>
          </>
        ) : focus ? (
          <>
            <p className="ms-mute">
              {p.current ? 'In corso' : 'Prossima tappa'}
              {p.current
                ? <span className="ms-cy" style={{ fontWeight: 600 }}> · {ZONE_CITY[p.current.zone]}</span>
                : <>, <span className="ms-cy" style={{ fontWeight: 600 }}>tra {focus.inText}</span></>}
            </p>
            {focus.clock && <p className="ms-big" style={{ margin: '6px 0 10px' }}>{focus.clock}</p>}
            <h2 className="ms-h2" data-testid="today-now" style={!focus.clock ? { marginTop: 8 } : undefined}>{focus.label}</h2>
          </>
        ) : p.done ? (
          <>
            <h2 className="ms-h2" data-testid="today-now">Le attività di oggi sono finite.</h2>
            <p className="ms-mute" style={{ marginTop: 6 }}>Se siete ancora fuori, controllate l'ultima metro e la strada per l'alloggio.</p>
          </>
        ) : (
          <>
            <h2 className="ms-h2" data-testid="today-now">{p.dayTitle}</h2>
            <p className="ms-mute" style={{ marginTop: 6 }}>Giornata libera: scegliete tra i luoghi salvati dal gruppo.</p>
          </>
        )}

        {p.metro.level !== 'none' && (
          <div
            role="status"
            data-testid="last-metro"
            style={{ marginTop: 16, paddingLeft: 12, borderLeft: `2px solid ${p.metro.level === 'closed' ? '#f87171' : 'var(--ms-amber)'}` }}
          >
            <p style={{ fontWeight: 600, color: p.metro.level === 'closed' ? '#fca5a5' : 'var(--ms-amber)' }}>{p.metro.title}</p>
            <p className="ms-mute ms-sm" style={{ marginTop: 2 }}>{p.metro.text}</p>
          </div>
        )}

        {!p.after && (
          <div className="ms-acts" style={{ marginTop: 6, flexWrap: 'wrap', columnGap: 24 }}>
            {p.stop && !p.done && (
              <button type="button" className="ms-link" onClick={() => p.onRoute(p.stop!.id)} data-testid="route-to-stop">
                {p.current || p.next ? 'Apri il percorso' : `Portami a ${p.stop.name}`}
              </button>
            )}
            {p.free && (
              <button type="button" className="ms-link" onClick={() => p.onGoTo('places')} data-testid="free-day-places">Apri i luoghi salvati</button>
            )}
            <button type="button" className="ms-link" onClick={() => p.onGoTo('itinerary')}>Tutto il giorno</button>
            {showHomeAsButton ? (
              <button type="button" className="ms-btn" style={{ marginTop: 4 }} onClick={() => p.onRoute(p.homeId)} data-testid="route-home">Torna all'alloggio</button>
            ) : (
              <button type="button" className="ms-link" onClick={() => p.onRoute(p.homeId)} data-testid="route-home">Torna all'alloggio</button>
            )}
          </div>
        )}
      </Hero>

      <div style={{ padding: '0 20px' }}>
      {p.previewPanel && <div style={{ paddingTop: 12 }}>{p.previewPanel}</div>}
      {rows.length > 0 && (
        <section style={{ paddingTop: 6 }}>
          <h3 className="ms-h2" style={{ marginBottom: 10 }}>Dopo</h3>
          {rows.map((r, i) => (
            <div className="ms-row" key={i}>
              <span className="t">{r.clock || '—'}{r.inText && <span className="z">tra {r.inText}</span>}</span>
              <p>{r.label}</p>
            </div>
          ))}
        </section>
      )}

      <WorldTimes now={p.now} />
      <div className="ms-sec" style={{ paddingBottom: 0 }}>
        <button type="button" className="ms-link" onClick={p.onPreview} data-testid="preview-toggle">Anteprima del viaggio</button>
      </div>
      </div>
    </div>
  );
};
