import React, { useEffect, useMemo, useState } from 'react';
import { ITINERARY_DAYS, MAP_LOCATIONS, type ItineraryDay } from '../data/tripData';
import { TIMED_DAYS, locateNow } from '../utils/tripClock';
import { Search, ChevronLeft } from 'lucide-react';
import './mobile/mobile.css';

interface ItineraryViewProps {
  onViewOnMap: (locationId: string, dayNumber?: number) => void;
  /** Giorno da aprire e raggiungere con lo scroll (il nonce permette di richiedere lo stesso giorno più volte) */
  focusDay?: { id: number; nonce: number } | null;
  onFocusHandled?: () => void;
}

/**
 * Itinerario del telefono, come nel mockup: elenco piatto con numeri grandi e, toccando un giorno,
 * la pagina del giorno con orari e città. Il colore indica la fase: viola = partenza e prima settimana,
 * rosa = seconda settimana, ambra = ultima parte.
 */
const PHASES: { id: string; label: string; color: string }[] = [
  { id: 'all', label: 'Tutti', color: 'var(--ms-accent)' },
  { id: 'Partenza', label: 'Partenza', color: 'var(--ms-violet)' },
  { id: 'Prima settimana', label: 'Prima settimana', color: 'var(--ms-violet)' },
  { id: 'Seconda settimana', label: 'Seconda', color: 'var(--ms-pink)' },
  { id: 'Ultima parte', label: 'Ultima parte', color: 'var(--ms-amber)' }
];
const PHASE_COLOR: Record<string, string> = Object.fromEntries(PHASES.map((p) => [p.id, p.color]));
const ZONE_CITY = { IT: 'Milano', CN: 'Pechino', KR: 'Seul' } as const;
const ZONE_CLASS = { IT: 'it', CN: 'cn', KR: 'kr' } as const;

const pad2 = (n: string | number) => String(n).padStart(2, '0');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const firstSentence = (text: string) => {
  const m = text.match(/^(.+?[.!?])(\s+|$)/);
  return m ? { lead: m[1], rest: text.slice(m[0].length) } : { lead: text, rest: '' };
};

const DayPage: React.FC<{ day: ItineraryDay; total: number; onBack: () => void; onViewOnMap: ItineraryViewProps['onViewOnMap'] }> = ({ day, total, onBack, onViewOnMap }) => {
  const timed = TIMED_DAYS.find((t) => t.day.id === day.id);
  const dateLine = `${cap(day.dayOfWeek)} ${day.dateStr.replace(' 2027', '').toLowerCase()} · giorno ${day.id + 1} di ${total}`;
  const base = day.subtitle.trim().replace(/[.\s]+$/, '');
  const cost = day.costsEstimate ? day.costsEstimate.trim().replace(/[.\s]+$/, '') : '';
  const subtitle = `${base}.${cost ? ` Costo del giorno: ${cost.charAt(0).toLowerCase()}${cost.slice(1)}.` : ''}`;
  const locs = day.locationIds.map((id) => MAP_LOCATIONS.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <div data-testid="itinerary-day-page">
      <div className="flex items-center justify-between" style={{ margin: '-8px -8px 4px -12px' }}>
        <button type="button" className="ms-ib" onClick={onBack} aria-label="Torna all'itinerario" data-testid="itinerary-back">
          <ChevronLeft />
        </button>
        <p className="ms-mute ms-sm" style={{ paddingRight: 12 }}>{dateLine}</p>
      </div>

      <h1 className="ms-fr" style={{ fontSize: 34, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.02em' }}>{day.title}</h1>
      <p className="ms-mute" style={{ margin: '10px 0 20px' }}>{subtitle}</p>

      {day.isSpecialEvent && (
        <div style={{ margin: '0 0 18px', paddingLeft: 12, borderLeft: '2px solid #f87171' }}>
          <p style={{ fontWeight: 600 }}>Sede e orari: non ancora pubblicati (in attesa di annuncio ufficiale Riot Games)</p>
          <p className="ms-mute ms-sm" style={{ marginTop: 2 }}>
            Sede, orari della finale e biglietti del Valorant Masters Seoul non sono ancora stati annunciati. La posizione sulla mappa è indicativa: il giorno resta riservato e il piano va aggiornato appena escono le informazioni.
          </p>
        </div>
      )}

      {day.schedule && day.schedule.length > 0 ? (
        <section className="ms-sec" style={{ paddingBottom: 0 }}>
          {day.schedule.map((item, i) => {
            const t = timed?.items[i];
            const { lead, rest } = firstSentence(item.activity);
            return (
              <div className={`ms-row${item.isHighlight ? ' next' : ''}`} key={i}>
                <span className="t">
                  {t?.clock || item.time}
                  {t && <span className={`z ${ZONE_CLASS[t.zone]}`}>{ZONE_CITY[t.zone]}</span>}
                </span>
                <p>
                  <strong style={{ fontWeight: 600 }}>{lead}</strong>
                  {rest ? ` ${rest}` : ''}
                  {item.notes && <span className="ms-mute" style={{ display: 'block', marginTop: 2, fontSize: 14 }}>{item.notes}</span>}
                </p>
              </div>
            );
          })}
        </section>
      ) : (
        <p style={{ lineHeight: 1.55 }}>{day.description}</p>
      )}

      {day.schedule && day.schedule.length > 0 && day.description && (
        <p className="ms-mute" style={{ marginTop: 16, lineHeight: 1.55 }}>{day.description}</p>
      )}

      {day.bulletPoints.length > 0 && (
        <section className="ms-sec" style={{ marginTop: 18, paddingBottom: 0 }}>
          <h3 className="ms-h2" style={{ marginBottom: 6 }}>Punti chiave</h3>
          {day.bulletPoints.map((b, i) => (
            <div className="ms-row" key={i} style={{ gridTemplateColumns: '1fr' }}><p>{b}</p></div>
          ))}
        </section>
      )}

      {day.tips && day.tips.length > 0 && (
        <section style={{ marginTop: 18, paddingLeft: 12, borderLeft: '2px solid var(--ms-amber)' }}>
          <h3 className="ms-am" style={{ fontWeight: 600 }}>Consigli pratici e note importanti</h3>
          <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
            {day.tips.map((tip, i) => <li key={i} className="ms-sm" style={{ padding: '3px 0', color: '#fde68a' }}>{tip}</li>)}
          </ul>
        </section>
      )}

      {locs.length > 0 && (
        <section className="ms-sec" style={{ marginTop: 18, paddingBottom: 0 }}>
          <h3 className="ms-h2" style={{ marginBottom: 2 }}>Tappe del giorno</h3>
          <div className="ms-acts" style={{ flexWrap: 'wrap', columnGap: 20 }}>
            {locs.map((l) => (
              <button key={l.id} type="button" className="ms-link" onClick={() => onViewOnMap(l.id, day.id)}>{l.name}</button>
            ))}
          </div>
        </section>
      )}

      <div style={{ paddingTop: 18 }}>
        <button type="button" className="ms-btn" onClick={() => onViewOnMap(day.locationIds[0] || 'hongdae_base', day.id)} data-testid="itinerary-day-map">
          Vedi sulla mappa
        </button>
      </div>
    </div>
  );
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({ onViewOnMap, focusDay, onFocusHandled }) => {
  const [activePhase, setActivePhase] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openDayId, setOpenDayId] = useState<number | null>(null);

  // Arrivo da un altro tab (es. galleria): apre la pagina del giorno richiesto
  useEffect(() => {
    if (!focusDay) return;
    setActivePhase('all');
    setSearchQuery('');
    setOpenDayId(focusDay.id);
    window.scrollTo({ top: 0, behavior: 'auto' });
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay?.nonce]);

  const todayId = useMemo(() => {
    const w = locateNow(Date.now());
    return w.phase === 'during' ? TIMED_DAYS[w.dayIndex]?.day.id ?? null : null;
  }, []);
  const total = TIMED_DAYS.length;

  const filteredDays = ITINERARY_DAYS.filter((day) => {
    if (activePhase !== 'all' && day.phase !== activePhase) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matches =
        day.title.toLowerCase().includes(q) ||
        day.subtitle.toLowerCase().includes(q) ||
        day.description.toLowerCase().includes(q) ||
        day.bulletPoints.some((b) => b.toLowerCase().includes(q)) ||
        day.tags.some((t) => t.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });

  const openDay = openDayId !== null ? ITINERARY_DAYS.find((d) => d.id === openDayId) : undefined;
  if (openDay) {
    return (
      <DayPage
        day={openDay}
        total={total}
        onBack={() => { setOpenDayId(null); window.scrollTo({ top: 0, behavior: 'auto' }); }}
        onViewOnMap={onViewOnMap}
      />
    );
  }

  return (
    <div>
      {/* Periodo: schede di testo, sottolineatura nel colore della fase */}
      <div className="ms-seg" role="tablist" aria-label="Periodo" style={{ margin: '-20px -20px 0', padding: '0 20px' }}>
        {PHASES.map((ph) => {
          const on = activePhase === ph.id;
          return (
            <button
              key={ph.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActivePhase(ph.id)}
              style={on ? { boxShadow: `inset 0 -2px 0 ${ph.color}` } : undefined}
            >
              {ph.label}
            </button>
          );
        })}
      </div>

      <label className="ms-find" style={{ marginTop: 12 }}>
        <Search aria-hidden />
        <input
          type="text"
          placeholder="Cerca attività, pocha, DMZ"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Cerca nell'itinerario"
        />
      </label>

      <div style={{ marginTop: 8 }}>
        {filteredDays.map((day) => {
          const tone = PHASE_COLOR[day.phase] ?? 'var(--ms-accent)';
          const isToday = todayId === day.id;
          return (
            <button
              key={day.id}
              type="button"
              id={`itinerary-day-${day.id}`}
              className={`ms-day${isToday ? ' today' : ''}`}
              onClick={() => { setOpenDayId(day.id); window.scrollTo({ top: 0, behavior: 'auto' }); }}
            >
              <div>
                <span className="n">{pad2(day.dateStr.split(' ')[0])}</span>
                <span className="w" style={{ color: tone }}>{day.dayOfWeek.slice(0, 3).toLowerCase()}</span>
              </div>
              <div>
                <h3>{day.title}</h3>
                <p>{day.subtitle}</p>
                {isToday && <span className="now">Oggi</span>}
              </div>
            </button>
          );
        })}

        {filteredDays.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p className="ms-mute">Nessuna giornata corrisponde alla ricerca "{searchQuery}".</p>
            <button type="button" className="ms-link" onClick={() => { setSearchQuery(''); setActivePhase('all'); }}>
              Reimposta filtri
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
