import React, { useMemo, useState } from 'react';
import { CalendarDays, Hotel, MapPin, Phone, Plane, Users, Navigation } from 'lucide-react';
import { ACCOMMODATIONS, FLIGHTS_SCHEDULE, ITINERARY_DAYS, MAP_LOCATIONS } from '../data/tripData';
import { EMERGENCY_NUMBERS } from '../data/koreanHelp';
import { DEFAULT_HOME_ID, loadHomeId, stopsOfDay, tripDayAt } from '../map/tripToday';
import { SOS_SNAPSHOT_KEY } from './SosView';
import { loadGroupContacts } from '../services/tripCardSnapshot';
import { QuickMeetupSheet } from './QuickMeetupSheet';

const HEADING: React.CSSProperties = { fontFamily: 'Outfit, system-ui, sans-serif' };

/** "tel:" con solo cifre e +, per il telefono */
const telHref = (n: string) => `tel:${n.replace(/[^+\d]/g, '')}`;

const Card: React.FC<{ title: string; icon: React.ReactNode; testId: string; children: React.ReactNode }> = ({ title, icon, testId, children }) => (
  <section data-testid={testId} className="rounded-xl bg-[rgba(96,150,214,0.13)] px-4 py-4">
    <h2 className="flex items-center gap-2 text-base font-semibold text-white" style={HEADING}>
      <span className="text-[#52d9e6]" aria-hidden="true">{icon}</span>
      {title}
    </h2>
    <div className="mt-3 space-y-3">{children}</div>
  </section>
);

/** Riga "etichetta: valore" con testo leggibile su sfondo scuro */
const Line: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="text-sm leading-relaxed text-slate-200">
    {label && <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>}
    {children}
  </div>
);

const KoreanText: React.FC<{ text: string }> = ({ text }) => (
  <span lang="ko" className="block break-keep text-[15px] text-white">{text}</span>
);

const readSosContact = (): { contactName: string; contactPhone: string; insurance: string } => {
  try {
    const raw = JSON.parse(localStorage.getItem(SOS_SNAPSHOT_KEY) || 'null') as Record<string, unknown> | null;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return { contactName: str(raw?.contactName), contactPhone: str(raw?.contactPhone), insurance: str(raw?.insurance) };
  } catch {
    return { contactName: '', contactPhone: '', insurance: '' };
  }
};

/**
 * Scheda viaggio: itinerario del giorno, indirizzi in coreano, voli, alloggio e contatti.
 * Legge solo dati già sul telefono (programma nell'app, contatti salvati l'ultima volta con rete),
 * quindi si apre anche senza connessione. Da qui si può anche creare un "Ritrovo al volo".
 */
export const TripCardView: React.FC = () => {
  const today = tripDayAt();
  const [dayId, setDayId] = useState<number>(today?.id ?? ITINERARY_DAYS[0].id);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const day = ITINERARY_DAYS.find((d) => d.id === dayId) ?? ITINERARY_DAYS[0];
  const stops = useMemo(() => stopsOfDay(day), [day]);

  const homeId = loadHomeId() ?? DEFAULT_HOME_ID;
  const home = MAP_LOCATIONS.find((l) => l.id === homeId) ?? null;
  const homeAcc = ACCOMMODATIONS.find((a) => a.id === homeId) ?? null;
  const sos = useMemo(readSosContact, []);
  const group = useMemo(loadGroupContacts, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-10 lg:max-w-none lg:px-0" data-testid="trip-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="sr-only" style={HEADING}>Scheda viaggio</h1>
          <p className="mt-1 text-sm text-slate-400">Programma, indirizzi, voli e contatti: si aprono anche senza rete.</p>
        </div>
        <button type="button" onClick={() => setMeetupOpen(true)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a]">
          <Navigation className="h-4 w-4" aria-hidden="true" /> Ritrovo al volo
        </button>
      </header>

      <div role="radiogroup" aria-label="Giorno" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        {ITINERARY_DAYS.map((d) => {
          const selected = d.id === day.id;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDayId(d.id)}
              className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm ${selected ? 'bg-[#52d9e6] font-semibold text-[#04242a]' : 'bg-[rgba(96,150,214,0.13)] text-slate-200'}`}
            >
              {d.dayOfWeek.slice(0, 3)} {d.dateStr.replace(' 2027', '')}
            </button>
          );
        })}
      </div>

      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
      <Card title={day.title} icon={<CalendarDays className="h-4 w-4" />} testId="trip-card-program">
        {day.schedule && day.schedule.length > 0 ? (
          <ol className="space-y-2.5">
            {day.schedule.map((item, i) => (
              <li key={`${item.time}-${i}`} className="grid grid-cols-[3.5rem_1fr] gap-3 text-sm">
                <span className={`tabular-nums ${item.isHighlight ? 'font-semibold text-[#52d9e6]' : 'text-slate-400'}`}>{item.time}</span>
                <span className={item.isHighlight ? 'font-semibold text-white' : 'text-slate-200'}>
                  {item.activity}
                  {item.notes && <span className="block text-xs text-slate-400">{item.notes}</span>}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-200">
            {(day.bulletPoints ?? []).map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
      </Card>

      <Card title="Tappe e indirizzi" icon={<MapPin className="h-4 w-4" />} testId="trip-card-stops">
        {stops.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna tappa in Corea per questo giorno.</p>
        ) : (
          stops.map((s) => (
            <div key={s.id} className="border-t border-white/[0.08] pt-3 first:border-t-0 first:pt-0">
              <Line label={s.district}>
                <span className="font-semibold text-white">{s.italianName}</span>
              </Line>
              {s.koreanName && <div className="mt-1.5"><KoreanText text={s.koreanName} /></div>}
              {s.koreanAddress ? (
                <div className="mt-1"><KoreanText text={s.koreanAddress} /></div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Indirizzo in coreano non ancora salvato.</p>
              )}
            </div>
          ))
        )}
      </Card>

      <Card title="Alloggio" icon={<Hotel className="h-4 w-4" />} testId="trip-card-home">
        {home ? (
          <>
            <Line label="Casa del gruppo">
              <span className="font-semibold text-white">{home.italianName}</span>
            </Line>
            {home.koreanName && <KoreanText text={home.koreanName} />}
            {home.koreanAddress && <KoreanText text={home.koreanAddress} />}
            {homeAcc?.metroWalk && <Line label="Metro"><span>{homeAcc.metroWalk}</span></Line>}
            {homeAcc?.typeDescription && <Line label="Appartamento"><span>{homeAcc.typeDescription}</span></Line>}
          </>
        ) : (
          <p className="text-sm text-slate-400">Nessun alloggio scelto: lo imposti dalla mappa con il pulsante Casa.</p>
        )}
      </Card>

      <Card title="Voli" icon={<Plane className="h-4 w-4" />} testId="trip-card-flights">
        {FLIGHTS_SCHEDULE.map((leg) => (
          <div key={leg.id} className="border-t border-white/[0.08] pt-3 first:border-t-0 first:pt-0 text-sm text-slate-200">
            <p className="font-semibold text-white">{leg.airline} · {leg.flightNumber}</p>
            <p className="mt-1">
              {leg.departureDate} {leg.departureTime} · {leg.departureAirportCode} {leg.departureTerminal}
            </p>
            <p>
              {leg.arrivalDate} {leg.arrivalTime} · {leg.arrivalAirportCode} {leg.arrivalTerminal}
            </p>
            {leg.baggageInfo && <p className="mt-1 text-xs text-slate-400">{leg.baggageInfo}</p>}
          </div>
        ))}
      </Card>

      <Card title="Contatti" icon={<Phone className="h-4 w-4" />} testId="trip-card-contacts">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Numeri utili</p>
          {EMERGENCY_NUMBERS.map((n) => (
            <a key={n.number} href={telHref(n.number)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#0a1119] px-3 text-sm text-slate-100">
              <span>{n.label}</span>
              <span className="font-semibold tabular-nums text-[#52d9e6]">{n.number}</span>
            </a>
          ))}
        </div>

        {sos.contactName && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Il tuo contatto d’emergenza</p>
            <Line><span className="font-semibold text-white">{sos.contactName}</span></Line>
            {sos.contactPhone && (
              <a href={telHref(sos.contactPhone)} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#0a1119] px-3 text-sm text-slate-100">
                <Phone className="h-4 w-4 text-[#52d9e6]" aria-hidden="true" /> {sos.contactPhone}
              </a>
            )}
            {sos.insurance && <Line label="Assicurazione"><span>{sos.insurance}</span></Line>}
          </div>
        )}

        <div className="space-y-2 pt-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Gruppo</p>
          {group.length === 0 ? (
            <p className="text-xs text-slate-500">Apri una volta la scheda Gruppo con la rete: così i numeri restano disponibili anche offline.</p>
          ) : (
            group.map((m) => (
              <div key={m.id} className="rounded-xl bg-[#0a1119] px-3 py-2.5 text-sm">
                <p className="font-semibold text-white">{m.name}</p>
                {m.phone && (
                  <a href={telHref(m.phone)} className="mt-1 inline-flex min-h-11 items-center gap-2 text-slate-100">
                    <Phone className="h-4 w-4 text-[#52d9e6]" aria-hidden="true" /> {m.phone}
                  </a>
                )}
                {m.emergencyPhone && (
                  <p className="text-xs text-slate-400">Emergenza: {m.emergencyName || 'contatto'} · {m.emergencyPhone}</p>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      </div>

      {meetupOpen && <QuickMeetupSheet stops={stops} onClose={() => setMeetupOpen(false)} />}
    </div>
  );
};

export default TripCardView;
