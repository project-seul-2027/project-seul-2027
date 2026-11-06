import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, ExternalLink, MapPin, Search } from 'lucide-react';
import { ITINERARY_DAYS, MAP_LOCATIONS, type ItineraryDay } from '../../data/tripData';

const MONO = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.08em', color: '#94A3B8', textTransform: 'uppercase' } as const;
const DISP = { fontFamily: "'Outfit', sans-serif", fontWeight: 800, letterSpacing: '-.03em' } as const;
const RULE = '1px solid #1E2B40';

interface Props {
  onViewOnMap: (locationId: string, dayNumber?: number) => void;
  focusDay?: { id: number; nonce: number } | null;
  onFocusHandled?: () => void;
}

const PHASES = [
  { id: 'all', label: 'Tutti i giorni' },
  { id: 'Partenza', label: 'Partenza' },
  { id: 'Prima settimana', label: 'Settimana 1' },
  { id: 'Seconda settimana', label: 'Settimana 2' },
  { id: 'Ultima parte', label: 'Ultima parte' },
];

const dayColor = (d: ItineraryDay) => (d.isSpecialEvent ? '#F87171' : d.id === 18 ? '#FBBF24' : '#60A5FA');
const dayNumber = (d: ItineraryDay) => d.dateStr.split(' ')[0].padStart(2, '0');

/** Etichette speciali di alcuni giorni (stesse dell'elenco per telefono). */
function badgesOf(d: ItineraryDay): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  if (d.isSpecialEvent) out.push({ text: 'VALORANT MASTERS (3 MAR) · ARENA TBD', color: '#F87171' });
  if (d.id === 8) out.push({ text: 'Serata di saluti (Pietro riparte il 10)', color: '#A78BFA' });
  if (d.id === 9) out.push({ text: 'Rientro di Pietro a Milano (volo 11:10)', color: '#FBBF24' });
  if (d.id === 13) out.push({ text: 'White Day coreano', color: '#F472B6' });
  if (d.id === 17) out.push({ text: 'Arrival card e Tiananmen online', color: '#00C5E8' });
  if (d.id === 18) out.push({ text: 'Scalo Pechino 240h (19 mar)', color: '#FBBF24' });
  return out;
}

/** Itinerario desktop: elenco dei giorni a sinistra, giornata scelta a destra. Stessi dati e stesse azioni della vista telefono. */
export function DesktopItinerary({ onViewOnMap, focusDay, onFocusHandled }: Props) {
  const [phase, setPhase] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number>(1);

  useEffect(() => {
    if (!focusDay) return;
    setPhase('all');
    setQuery('');
    setSelectedId(focusDay.id);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay?.nonce]);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITINERARY_DAYS.filter((d) => {
      if (phase !== 'all' && d.phase !== phase) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.bulletPoints.some((b) => b.toLowerCase().includes(q)) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [phase, query]);

  const day = days.find((d) => d.id === selectedId) ?? days[0] ?? null;
  const color = day ? dayColor(day) : '#60A5FA';

  return (
    <div data-testid="desktop-itinerary">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Filtra per periodo" className="flex flex-wrap gap-2">
          {PHASES.map((p) => {
            const on = phase === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPhase(p.id)}
                style={{ height: 32, padding: '0 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: `1px solid ${on ? '#F7F9FC' : '#1E2B40'}`, background: on ? '#F7F9FC' : 'transparent', color: on ? '#080D18' : '#CBD5E1', cursor: 'pointer' }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <label className="relative w-72">
          <Search className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input
            type="text"
            placeholder="Cerca attività, pocha, DMZ, orari…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-[14px] rounded-xl bg-transparent border border-[#1E2B40] text-app-text placeholder:text-app-muted focus:outline-none focus:border-app-accent"
          />
        </label>
      </div>

      {days.length === 0 ? (
        <div className="mt-10" style={{ borderTop: RULE, paddingTop: 24 }}>
          <p className="text-[15px] text-app-muted">Nessuna giornata corrisponde alla ricerca “{query}”.</p>
          <button type="button" onClick={() => { setQuery(''); setPhase('all'); }} className="mt-3 text-[14px] font-semibold text-app-accent hover:underline">Reimposta filtri</button>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-12" style={{ gridTemplateColumns: '340px minmax(0,1fr)' }}>
          {/* Elenco giorni */}
          <ol className="min-w-0" style={{ borderBottom: RULE }} aria-label="Giorni del viaggio">
            {days.map((d) => {
              const on = day?.id === d.id;
              return (
                <li key={d.id} id={`itinerary-day-${d.id}`} style={{ borderTop: RULE }}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    aria-current={on ? 'true' : undefined}
                    className="w-full text-left grid items-center gap-4 hover:bg-[#0B1322] transition-colors"
                    style={{ gridTemplateColumns: '48px minmax(0,1fr)', padding: '14px 12px', background: on ? '#101A2D' : undefined, boxShadow: on ? 'inset 2px 0 0 #00C5E8' : undefined }}
                  >
                    <span style={{ ...DISP, fontSize: 28, lineHeight: 1, color: dayColor(d), fontVariantNumeric: 'tabular-nums' }}>{dayNumber(d)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-app-text">{d.title}</span>
                      <span className="block truncate text-[13px] text-app-muted">{d.dayOfWeek} {d.dateStr.replace(' 2027', '')} · {d.phase}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Giornata */}
          {day && (
            <article key={day.id} className="min-w-0 animate-in fade-in duration-200" aria-live="polite">
              <div className="flex items-baseline gap-5">
                <span style={{ ...DISP, fontSize: 84, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>{dayNumber(day)}</span>
                <div className="min-w-0">
                  <h2 style={{ ...DISP, fontSize: 30, lineHeight: 1.1, margin: 0 }}>{day.title}</h2>
                  <p style={{ ...MONO, margin: '6px 0 0' }}>{day.dayOfWeek} {day.dateStr.replace(' 2027', '')} · {day.phase}</p>
                </div>
              </div>
              <p className="mt-2 text-[16px] text-[#CBD5E1]">{day.subtitle}</p>

              {(badgesOf(day).length > 0 || day.costsEstimate) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {badgesOf(day).map((b) => (
                    <span key={b.text} style={{ height: 28, padding: '0 12px', borderRadius: 99, border: `1px solid ${b.color}55`, color: b.color, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{b.text}</span>
                  ))}
                  {day.costsEstimate && (
                    <span style={{ height: 28, padding: '0 12px', borderRadius: 99, border: '1px solid #34D39955', color: '#34D399', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{day.costsEstimate}</span>
                  )}
                </div>
              )}

              {day.isSpecialEvent && (
                <div className="mt-5 flex items-start gap-3" style={{ borderTop: '1px solid rgba(248,113,113,.4)', borderBottom: '1px solid rgba(248,113,113,.4)', padding: '14px 0' }}>
                  <AlertCircle className="w-5 h-5 text-fam-sos shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[15px] font-bold">Sede e orari: non ancora pubblicati (in attesa di annuncio ufficiale Riot Games)</p>
                    <p className="mt-1 text-[14px] text-[#CBD5E1] leading-relaxed">Sede, orari della finale e biglietti del Valorant Masters Seoul non sono ancora stati annunciati. La posizione sulla mappa è indicativa: il giorno resta riservato e il piano va aggiornato appena escono le informazioni.</p>
                  </div>
                </div>
              )}

              <p className="mt-5 text-[16px] leading-relaxed text-[#CBD5E1] max-w-3xl">{day.description}</p>

              {day.schedule && day.schedule.length > 0 && (
                <section style={{ marginTop: 40, borderTop: RULE, paddingTop: 24 }}>
                  <p style={{ ...MONO, margin: 0, color }}>Tabella di marcia oraria</p>
                  <div className="mt-4" style={{ borderBottom: RULE }}>
                    {day.schedule.map((item, i) => (
                      <div key={i} className="grid items-baseline gap-5" style={{ gridTemplateColumns: '130px minmax(0,1fr)', borderTop: RULE, padding: '14px 0' }}>
                        <span style={{ ...DISP, fontSize: 17, color: item.isHighlight ? '#00C5E8' : '#60A5FA', fontVariantNumeric: 'tabular-nums' }}>{item.time}</span>
                        <div className="min-w-0">
                          <p className={`text-[15px] leading-snug ${item.isHighlight ? 'font-bold' : 'font-medium text-slate-200'}`}>{item.activity}</p>
                          {item.notes && <p className="mt-1 text-[13px] text-app-muted">{item.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {day.bulletPoints.length > 0 && (
                <section className="mt-8">
                  <p style={{ ...MONO, margin: 0 }}>Punti chiave e attività</p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-10" style={{ borderBottom: RULE }}>
                    {day.bulletPoints.map((p, i) => (
                      <li key={i} className="text-[14px] text-[#CBD5E1] leading-snug" style={{ borderTop: RULE, padding: '12px 0' }}>{p}</li>
                    ))}
                  </ul>
                </section>
              )}

              {day.tips && day.tips.length > 0 && (
                <section className="mt-8" style={{ borderTop: '1px solid rgba(251,191,36,.4)', paddingTop: 16 }}>
                  <p style={{ ...MONO, margin: 0, color: '#FBBF24' }}>Consigli pratici e note importanti</p>
                  <ul className="mt-3 space-y-2">
                    {day.tips.map((t, i) => <li key={i} className="text-[14px] text-amber-100/90 leading-snug">{t}</li>)}
                  </ul>
                </section>
              )}

              <section className="mt-8 flex flex-wrap items-center justify-between gap-4" style={{ borderTop: RULE, paddingTop: 20 }}>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span style={{ ...MONO, display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin className="w-3.5 h-3.5" aria-hidden /> Tappe del giorno</span>
                  {day.locationIds.map((id) => {
                    const loc = MAP_LOCATIONS.find((l) => l.id === id);
                    if (!loc) return null;
                    return (
                      <button key={id} type="button" onClick={() => onViewOnMap(id, day.id)} className="min-h-[36px] px-3 rounded-xl border border-[#1E2B40] hover:border-[#60718C] text-[13px] font-semibold text-app-text inline-flex items-center gap-1.5 transition-colors">
                        {loc.name}<ExternalLink className="w-3 h-3 text-app-accent" aria-hidden />
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => onViewOnMap(day.locationIds[0] || 'hongdae_base', day.id)} className="min-h-[40px] px-4 rounded-xl bg-app-accent text-app-on-accent text-[14px] font-bold inline-flex items-center gap-2">
                  Vedi giorno sulla mappa <ArrowRight className="w-4 h-4" aria-hidden />
                </button>
              </section>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
