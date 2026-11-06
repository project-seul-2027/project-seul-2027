import React, { useEffect, useMemo, useState } from 'react';
import {
  Navigation, MapPin, Languages, Home, Clock, CalendarPlus, Bell, Wallet, WalletCards, Plane, Eye, X, Check,
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, CloudFog,
  ChevronDown, ChevronRight, Droplets, Wind, FileText, AlertTriangle, TrainFront, Moon as MoonIcon, Bookmark, ShieldAlert
} from 'lucide-react';
import { ACCOMMODATIONS, ITINERARY_DAYS, MAP_LOCATIONS, type MapLocation } from '../data/tripData';
import { WalletShortcut } from './WalletShortcut';
import { GroupLiveCard } from './group/GroupLive';
import { WEATHER_LOCATIONS, fetchLiveWeather, type LiveWeatherData } from '../data/weatherData';
import { OfflineCard } from './OfflineCard';
import { fetchAirQuality, type AirQuality } from '../data/airQuality';
import { lastMetroStatus } from '../utils/lastMetro';
import { useAuth } from '../auth/AuthContext';
import { useMediaQuery } from '../pwa';
import { WorldClockBar } from './WorldClockBar';
import { DesktopOggiHero } from './desktop/DesktopOggiHero';
import { PhoneCountdown } from './mobile/PhoneCountdown';
import { MobileOggi } from './mobile/MobileOggi';
import {
  TIMED_DAYS, locateNow, formatCountdown, formatInZone, msFromDayAndClock, zoneLabel, zoneOfDay
} from '../utils/tripClock';
import {
  TRIP_REMINDERS, REMINDER_AUDIENCE_LABEL, buildIcs, reminderApplies, saveIcsFile
} from '../utils/tripReminders';

/** Riassunto breve di una tappa: il campo `summary`, o la prima frase del testo come ripiego. */
const briefOf = (item: { summary?: string; activity: string }) =>
  item.summary ?? (item.activity.split(/(?<=[.!?])\s/)[0] ?? item.activity).slice(0, 90);

/** Etichetta oraria di una tappa: l'orario se c'è, altrimenti la parte del giorno scritta nel PDF, altrimenti le prime parole del luogo. */
const timeLabel = (t: string): string => {
  const dalle = t.match(/^Dalle\s+(\d{1,2}[:.]\d{2})/i);
  if (dalle) return `Dalle ${dalle[1]}`;
  const clock = t.match(/\d{1,2}[:.]\d{2}(?:\s*-\s*\d{1,2}[:.]\d{2})?/);
  if (clock) return clock[0].replace(/\s+/g, ' ');
  const part = t.match(/^(Mattina presto|Mattina|Pomeriggio|Sera|Giorno|Prima|Poi|Online|Dopo il match|Pranzo)/i);
  if (part) return part[0];
  return t.split(' ').slice(0, 2).join(' ');
};


export type TodayTarget = 'wallet' | 'places' | 'sos' | 'map' | 'show' | 'weather' | 'expenses' | 'flights' | 'itinerary' | 'pdf';

interface TodayViewProps {
  /** Apre la mappa già in modalità percorso: dalla posizione GPS verso la destinazione */
  onRoute: (destinationId: string) => void;
  onGoTo: (tab: TodayTarget) => void;
  /** Animazione del video di sfondo (solo intestazione desktop) */
  heroEnabled: boolean;
  onToggleHero: () => void;
}

function WeatherIcon({ name, className }: { name: string; className?: string }) {
  const c = className ?? 'w-8 h-8';
  switch (name) {
    case 'Sun': return <Sun className={`${c} text-amber-400`} />;
    case 'Moon': return <Moon className={`${c} text-indigo-300`} />;
    case 'CloudSun': return <CloudSun className={`${c} text-amber-300`} />;
    case 'CloudMoon': return <CloudMoon className={`${c} text-sky-300`} />;
    case 'Cloud': return <Cloud className={`${c} text-slate-400`} />;
    case 'CloudDrizzle': return <CloudDrizzle className={`${c} text-cyan-300`} />;
    case 'CloudRain': return <CloudRain className={`${c} text-teal-400`} />;
    case 'CloudSnow': return <CloudSnow className={`${c} text-indigo-200`} />;
    case 'CloudLightning': return <CloudLightning className={`${c} text-purple-400`} />;
    case 'CloudFog': return <CloudFog className={`${c} text-slate-300`} />;
    default: return <CloudSun className={`${c} text-sky-300`} />;
  }
}

/** Istante "ora": reale, oppure simulato con ?sim=2027-03-05T15:00 (ora di Seul) */
function useNow(sim: number | null): number {
  const [real, setReal] = useState(() => Date.now());
  useEffect(() => {
    if (sim !== null) return;
    const id = window.setInterval(() => setReal(Date.now()), 20_000);
    return () => window.clearInterval(id);
  }, [sim]);
  return sim ?? real;
}

function simFromUrl(): number | null {
  try {
    const v = new URLSearchParams(window.location.search).get('sim');
    if (!v) return null;
    const t = Date.parse(`${v}:00+09:00`);
    return Number.isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

const isSeoulStop = (l: MapLocation) => l.city === 'Seul' || l.city === 'Dintorni / Gite';

export const TodayView: React.FC<TodayViewProps> = ({ onRoute, onGoTo, heroEnabled, onToggleHero }) => {
  const { user } = useAuth();
  const [sim, setSim] = useState<number | null>(simFromUrl);
  const now = useNow(sim);
  const where = useMemo(() => locateNow(now), [now]);
  const timedDay = TIMED_DAYS[where.dayIndex];
  const day = timedDay.day;
  const before = where.phase === 'before' && sim === null;
  const after = where.phase === 'after';

  // --- Meteo di Seul (se manca la rete, la scheda resta senza meteo) ---
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [air, setAir] = useState<AirQuality | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAirQuality(WEATHER_LOCATIONS[0].lat, WEATHER_LOCATIONS[0].lng)
      .then((a) => alive && setAir(a))
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    fetchLiveWeather(WEATHER_LOCATIONS[0])
      .then((w) => alive && setWeather(w))
      .catch(() => alive && setWeatherFailed(true));
    return () => { alive = false; };
  }, []);

  // --- Tappe del giorno ---
  const stops = useMemo(
    () => day.locationIds.map((id) => MAP_LOCATIONS.find((l) => l.id === id)).filter((l): l is MapLocation => !!l && isSeoulStop(l)),
    [day]
  );
  const [pickedStop, setPickedStop] = useState<string | null>(null);
  useEffect(() => setPickedStop(null), [day.id]);
  const stop = stops.find((s) => s.id === pickedStop) ?? stops[0] ?? null;

  const homeId = user?.accommodationPreference ?? 'acc_c';
  const home = ACCOMMODATIONS.find((a) => a.id === homeId) ?? ACCOMMODATIONS[2];

  // --- Attività ora e dopo ---
  const items = timedDay.items;
  const current = where.currentIndex >= 0 ? items[where.currentIndex] : null;
  const next = where.nextIndex >= 0 ? items[where.nextIndex] : null;
  const [showPast, setShowPast] = useState(false);

  // --- Promemoria per questo utente ---
  const myReminders = useMemo(
    () => TRIP_REMINDERS.filter((r) => reminderApplies(r, user?.travelerId)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    [user?.travelerId]
  );
  const upcoming = myReminders.filter((r) => Date.parse(r.at) >= now).slice(0, 4);
  const [icsState, setIcsState] = useState<'idle' | 'done'>('idle');
  const exportIcs = async () => {
    await saveIcsFile(buildIcs(myReminders));
    setIcsState('done');
    window.setTimeout(() => setIcsState('idle'), 4000);
  };

  // --- Anteprima del viaggio ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pvDay, setPvDay] = useState(3);
  const [pvTime, setPvTime] = useState('14:30');
  const applyPreview = () => {
    setSim(msFromDayAndClock(pvDay, pvTime, zoneOfDay(pvDay)));
    setPreviewOpen(false);
  };

  const seoulTime = formatInZone(now, 'Asia/Seoul', { hour: '2-digit', minute: '2-digit' });
  const seoulDate = formatInZone(now, 'Asia/Seoul', { weekday: 'long', day: 'numeric', month: 'long' });
  const romeTime = formatInZone(now, 'IT', { hour: '2-digit', minute: '2-digit' });
  // Telefono: data e ora del telefono (fuso dove vi trovate ora), non quelle fisse di Seul o Roma
  const phoneDate = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(now));
  const phoneTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(now));
  const phoneZone = new Intl.DateTimeFormat('it-IT', { timeZoneName: 'short' }).formatToParts(new Date(now)).find((x) => x.type === 'timeZoneName')?.value ?? '';
  const firstName = user?.firstName || user?.displayName || '';
  const daysToGo = Math.max(0, Math.ceil((TIMED_DAYS[0].startTs + 2 * 3_600_000 - now) / 86_400_000));

  const nextIn = next ? formatCountdown(next.ts - now) : '';
  // Solo durante il viaggio e nei giorni a Seul: l'ultima metro conta se sei fuori la sera
  const metro = useMemo(
    () => (where.phase === 'during' && day.id >= 1 && day.id <= 18 ? lastMetroStatus(now) : { level: 'none' as const, title: '', text: '' }),
    [where.phase, day.id, now]
  );

  /* ------------------------------------------------------------------ */

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [clocksOpen, setClocksOpen] = useState(false);
  const done = items.length > 0 && !current && !next;
  const free = items.length === 0;

  // Telefono: la scheda principale cambia titolo, contenuto e azione in base allo stato della giornata
  const phoneState: { label: string; tone: string; title: string; hint?: string; time?: string } = before
    ? { label: 'Mancano', tone: 'text-app-accent', title: '' }
    : after
      ? { label: 'Viaggio concluso', tone: 'text-app-muted', title: 'Bentornati! Spero sia stato bellissimo.' }
      : current
        ? { label: 'In corso', tone: 'text-app-accent', title: briefOf(current.item), time: `${current.clock || current.item.time} · ${zoneLabel(current.zone)}` }
        : next
          ? { label: 'Prossima', tone: 'text-fam-weather', title: briefOf(next.item), time: `alle ${next.clock || next.item.time} · tra ${nextIn}` }
          : done
            ? { label: 'Giornata conclusa', tone: 'text-app-muted', title: 'Le attività di oggi sono finite.', hint: 'Se siete ancora fuori, controllate l’ultima metro e la strada per l’alloggio.' }
            : { label: 'Nessuna attività programmata', tone: 'text-app-muted', title: day.title, hint: 'Giornata libera: scegliete tra i luoghi salvati dal gruppo.' };

  const phoneHero = (
    <section className="rounded-3xl border border-app-accent/30 bg-app-surface p-5 shadow-xl" data-testid="today-hero" data-state={before ? 'before' : after ? 'after' : current ? 'now' : next ? 'next' : done ? 'done' : 'free'}>
      <div className="flex items-center justify-between gap-3">
        <div className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${phoneState.tone}`}>
          {current && !before && !after && (
            <span className="relative flex h-2 w-2" aria-hidden><span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-app-accent opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-app-accent" /></span>
          )}
          {phoneState.label}
        </div>
        {phoneState.time && <span className="text-[11px] text-app-muted font-mono text-right">{phoneState.time}</span>}
      </div>
      {before ? (
        <>
          <PhoneCountdown />
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">Ritrovo a Malpensa T1 il 1 marzo entro le 10:00. Durante il viaggio qui trovi cosa fare adesso e la strada per la prossima tappa.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setSim(msFromDayAndClock(3, '14:30', 'KR'))} className="min-h-[48px] px-3 rounded-2xl bg-app-accent text-app-on-accent text-sm font-bold flex items-center justify-center gap-2" data-testid="try-trip-mode">
              <Eye className="w-4 h-4 shrink-0" /> Prova il viaggio
            </button>
            <button type="button" onClick={() => onGoTo('itinerary')} className="min-h-[48px] px-3 rounded-2xl bg-app-raised border border-app-control text-app-text text-sm font-semibold">
              Vedi il programma
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-2 text-xl font-bold text-app-text leading-snug" data-testid="today-now">{phoneState.title}</h2>
          {phoneState.hint && <p className="mt-1.5 text-sm text-app-muted leading-snug">{phoneState.hint}</p>}
          {current && next && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-app-bg/70 border border-app-line p-3.5">
              <div className="shrink-0 w-14 text-center">
                <div className="text-[10px] uppercase tracking-wider text-app-muted">Dopo</div>
                <div className="text-base font-bold font-mono text-fam-weather">{next.clock || next.item.time}</div>
                <div className="text-[10px] text-app-muted">tra {nextIn}</div>
              </div>
              <p className="text-sm text-slate-200 leading-snug min-w-0">{briefOf(next.item)}</p>
            </div>
          )}
          {metro.level !== 'none' && (
            <div className={`mt-4 rounded-2xl border p-3.5 flex gap-3 ${metro.level === 'closed' ? 'border-fam-sos/50 bg-fam-sos/10' : 'border-fam-weather/50 bg-fam-weather/10'}`} role="status" data-testid="last-metro">
              {metro.level === 'closed' ? <MoonIcon className="w-5 h-5 text-red-300 shrink-0 mt-0.5" /> : <TrainFront className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <div className={`text-sm font-bold ${metro.level === 'closed' ? 'text-red-200' : 'text-amber-200'}`}>{metro.title}</div>
                <p className="text-xs text-slate-300 leading-snug mt-0.5">{metro.text}</p>
              </div>
            </div>
          )}
          {!after && (
            <div className="mt-4 grid grid-cols-1 gap-2.5">
              {stop && !done && (
                <button type="button" onClick={() => onRoute(stop.id)} className="min-h-[52px] px-4 rounded-2xl bg-app-accent active:scale-[0.99] text-app-on-accent font-bold text-[15px] flex items-center justify-center gap-2" data-testid="route-to-stop">
                  <Navigation className="w-5 h-5 shrink-0" />
                  <span className="truncate">Portami a {stop.italianName}</span>
                </button>
              )}
              {free && (
                <button type="button" onClick={() => onGoTo('places')} className="min-h-[52px] px-4 rounded-2xl bg-app-accent text-app-on-accent font-bold text-[15px] flex items-center justify-center gap-2" data-testid="free-day-places">
                  <Bookmark className="w-5 h-5 shrink-0" /> Apri i luoghi salvati
                </button>
              )}
              <button
                type="button"
                onClick={() => onRoute(home.id)}
                className={`min-h-[48px] px-4 rounded-2xl text-sm flex items-center justify-center gap-2 ${
                  done || metro.level !== 'none' ? 'bg-app-accent text-app-on-accent font-bold' : 'bg-app-raised border border-app-control text-app-text font-semibold'
                }`}
                data-testid="route-home"
              >
                <Home className="w-5 h-5 shrink-0" />
                <span className="truncate">Torna all’alloggio</span>
              </button>
            </div>
          )}
          {after && <p className="mt-1 text-sm text-app-muted">La galleria e le spese restano qui per ripensarci con calma.</p>}
        </>
      )}
    </section>
  );

  const heroCard = (
    <section className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/50 p-5 sm:p-6 shadow-xl" data-testid="today-hero">
      {before ? (
        <>
          <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-300">Mancano</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl sm:text-6xl font-black font-display text-white tabular-nums">{daysToGo}</span>
            <span className="text-lg text-slate-300">giorni alla partenza</span>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Ritrovo a Malpensa T1 il 1 marzo entro le 10:00. Quando sarete a Seul, questa schermata si trasforma:
            vi dice cosa fare adesso, cosa viene dopo e vi porta alla prossima tappa con un tocco.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSim(msFromDayAndClock(3, '14:30', 'KR'))}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold flex items-center gap-2"
              data-testid="try-trip-mode"
            >
              <Eye className="w-4 h-4" /> Prova la modalità viaggio
            </button>
            <button
              type="button"
              onClick={() => onGoTo('itinerary')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold"
            >
              Vedi il programma
            </button>
          </div>
        </>
      ) : after ? (
        <>
          <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-300">Viaggio concluso</div>
          <p className="mt-2 text-lg font-bold text-white font-display">Bentornati! Spero sia stato bellissimo.</p>
          <p className="mt-1 text-sm text-slate-400">La galleria e le spese restano qui per ripensarci con calma.</p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" /></span>
              Adesso
            </div>
            {current && (
              <span className="text-[11px] text-slate-400 font-mono">{current.clock || 'in corso'} · {zoneLabel(current.zone)}</span>
            )}
          </div>
          <h2 className="mt-2 text-lg sm:text-xl font-bold text-white leading-snug" data-testid="today-now">
            {current ? briefOf(current.item) : `Inizia la giornata: ${day.title}`}
          </h2>
          {next && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-950/60 border border-slate-800 p-3.5">
              <div className="shrink-0 w-14 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Dopo</div>
                <div className="text-base font-bold font-mono text-amber-300">{next.clock || next.item.time}</div>
                <div className="text-[10px] text-slate-500">tra {nextIn}</div>
              </div>
              <p className="text-sm text-slate-200 leading-snug min-w-0">{briefOf(next.item)}</p>
            </div>
          )}
          {metro.level !== 'none' && (
            <div
              className={`mt-4 rounded-2xl border p-3.5 flex gap-3 ${metro.level === 'closed' ? 'border-rose-500/50 bg-rose-500/10' : 'border-amber-500/50 bg-amber-500/10'}`}
              role="status"
              data-testid="last-metro"
            >
              {metro.level === 'closed' ? <MoonIcon className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" /> : <TrainFront className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <div className={`text-sm font-bold ${metro.level === 'closed' ? 'text-rose-200' : 'text-amber-200'}`}>{metro.title}</div>
                <p className="text-xs text-slate-300 leading-snug mt-0.5">{metro.text}</p>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {stop && (
              <button
                type="button"
                onClick={() => onRoute(stop.id)}
                className="min-h-[52px] px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                data-testid="route-to-stop"
              >
                <Navigation className="w-5 h-5 shrink-0" />
                <span className="truncate">Portami a {stop.italianName}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onRoute(home.id)}
              className={`min-h-[52px] px-4 py-3 rounded-2xl border font-semibold text-sm flex items-center justify-center gap-2 ${
                metro.level === 'none' ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100' : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-slate-950 font-bold'
              }`}
              data-testid="route-home"
            >
              <Home className={`w-5 h-5 shrink-0 ${metro.level === 'none' ? 'text-blue-300' : 'text-slate-950'}`} />
              <span className="truncate">Torna all’alloggio</span>
            </button>
          </div>
        </>
      )}
    </section>
  );

  const showKoreanCard = (
    <button
      type="button"
      onClick={() => onGoTo('show')}
      className="w-full text-left rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-950/60 to-slate-900 p-4 sm:p-5 hover:border-rose-400/60 transition-colors flex items-center gap-4"
      data-testid="open-show-korean"
    >
      <div className="shrink-0 w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center">
        <Languages className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-white font-display">Mostra in coreano</div>
        <p className="text-xs text-slate-400 leading-snug">Destinazione per il tassista, dieta e allergie per il ristorante, frasi utili, emergenze.</p>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
    </button>
  );

  const stopsCard = stops.length > 0 && (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <h3 className="text-sm font-bold text-white font-display flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-400" /> Tappe di oggi</h3>
      <ul className="mt-3 space-y-2">
        {stops.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setPickedStop(s.id)}
              aria-pressed={stop?.id === s.id}
              className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors min-h-[48px] ${
                stop?.id === s.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-100 truncate">{s.italianName}</span>
                <span className="block text-[11px] text-slate-500 truncate">{s.district}</span>
              </span>
              {s.koreanName && /[가-힣]/.test(s.koreanName) && <span className="text-sm text-slate-300 shrink-0">{s.koreanName}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  const weatherCard = (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white font-display">Meteo a Seul</h3>
        <button type="button" onClick={() => onGoTo('weather')} className="text-[11px] text-cyan-300 hover:text-cyan-200 font-semibold">Dettagli</button>
      </div>
      {weather ? (
        <div className="mt-3 flex items-center gap-4">
          <WeatherIcon name={weather.current.condition.iconName} className="w-12 h-12" />
          <div className="min-w-0">
            <div className="text-3xl font-black font-display text-white tabular-nums">{Math.round(weather.current.temperatureC)}°</div>
            <div className="text-xs text-slate-300">{weather.current.condition.labelIt}</div>
          </div>
          <div className="ml-auto text-right text-[11px] text-slate-400 space-y-1">
            <div>{Math.round(weather.daily[0].tempMinC)}° / {Math.round(weather.daily[0].tempMaxC)}°</div>
            <div className="flex items-center justify-end gap-1"><Droplets className="w-3 h-3 text-sky-400" />{weather.daily[0].precipitationProbability}%</div>
            <div className="flex items-center justify-end gap-1"><Wind className="w-3 h-3 text-slate-400" />{Math.round(weather.current.windSpeedKmH)} km/h</div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{weatherFailed ? 'Meteo non disponibile senza connessione.' : 'Carico il meteo…'}</p>
      )}
      {air && (
        <div className="mt-3 flex items-center gap-2 text-xs border-t border-slate-800 pt-3" data-testid="air-quality">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${['bg-emerald-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-500', 'bg-purple-500'][air.level]}`} />
          <span className="text-slate-200 font-semibold">Aria: {air.labelIt}</span>
          <span className="ml-auto text-slate-500 tabular-nums">PM2,5 {air.pm25} · PM10 {air.pm10} µg/m³</span>
        </div>
      )}
      {air && air.adviceIt && (
        <p className="mt-2 text-xs text-orange-200 leading-snug flex gap-2" data-testid="air-advice"><AlertTriangle className="w-4 h-4 shrink-0 text-orange-300" />{air.adviceIt}</p>
      )}
      {weather && weather.daily[0].precipitationProbability >= 60 && (
        <p className="mt-2 text-xs text-sky-200 leading-snug flex gap-2" data-testid="rain-advice"><Droplets className="w-4 h-4 shrink-0 text-sky-300" />Pioggia probabile oggi ({weather.daily[0].precipitationProbability}%): porta l’ombrello e punta su musei, COEX e mercati coperti invece di Namsan o Bukhansan.</p>
      )}
      {weather && <p className="mt-3 text-xs text-slate-400 leading-snug border-t border-slate-800 pt-3">{weather.current.condition.activityTipIt}</p>}
    </section>
  );

  const remindersCard = (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="reminders-card">
      <h3 className="text-sm font-bold text-white font-display flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Promemoria</h3>
      <ul className="mt-3 space-y-2.5">
        {upcoming.map((r) => (
          <li key={r.id} className="flex gap-3">
            <div className="shrink-0 w-12 text-center rounded-xl bg-slate-950/70 border border-slate-800 py-1">
              <div className="text-base font-black font-display text-white leading-none">{new Date(r.at).toLocaleDateString('it-IT', { day: 'numeric', timeZone: r.at.endsWith('+01:00') ? 'Europe/Rome' : r.at.endsWith('+08:00') ? 'Asia/Shanghai' : 'Asia/Seoul' })}</div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{new Date(r.at).toLocaleDateString('it-IT', { month: 'short', timeZone: r.at.endsWith('+01:00') ? 'Europe/Rome' : r.at.endsWith('+08:00') ? 'Asia/Shanghai' : 'Asia/Seoul' })}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-100 leading-snug">{(() => { const t = r.title.replace(/^Seul: /, ''); return t.charAt(0).toUpperCase() + t.slice(1); })()}</div>
              <div className="text-[11px] text-slate-500">{r.at.slice(11, 16)} · {REMINDER_AUDIENCE_LABEL[r.audience]}</div>
            </div>
          </li>
        ))}
        {upcoming.length === 0 && <li className="text-xs text-slate-500">Nessun promemoria in programma.</li>}
      </ul>
      <button
        type="button"
        onClick={exportIcs}
        className="mt-4 w-full min-h-[48px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
        data-testid="export-ics"
      >
        {icsState === 'done' ? <><Check className="w-4 h-4" /> Pronto: aprilo per aggiungerli</> : <><CalendarPlus className="w-4 h-4" /> Aggiungi tutti al calendario</>}
      </button>
      <p className="mt-2 text-[11px] text-slate-500 leading-snug">
        {myReminders.length} promemoria con sveglia, validi anche senza connessione. Funziona con Calendario di iPhone e Google Calendar.
      </p>
    </section>
  );

  const timelineCard = items.length > 0 && (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{day.dayOfWeek} {day.dateStr.replace(' 2027', '')}</div>
          <h3 className="text-base font-bold text-white font-display leading-snug">{day.title}</h3>
        </div>
        <button type="button" onClick={() => onGoTo('itinerary')} className="shrink-0 text-[11px] text-cyan-300 hover:text-cyan-200 font-semibold mt-1">Giorno completo</button>
      </div>
      {where.currentIndex > 0 && !showPast && (
        <button type="button" onClick={() => setShowPast(true)} className="mt-3 text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
          <ChevronDown className="w-3.5 h-3.5" /> {where.currentIndex} già {where.currentIndex === 1 ? 'fatta' : 'fatte'}
        </button>
      )}
      <ol className="mt-3 relative">
        {items.map((it, i) => {
          const past = i < where.currentIndex;
          if (past && !showPast) return null;
          const isNow = i === where.currentIndex;
          const isNext = i === where.nextIndex;
          return (
            <li key={i} className="relative pl-6 pb-4 last:pb-0" data-testid={isNow ? 'timeline-now' : undefined}>
              <span aria-hidden className="absolute left-[5px] top-2 bottom-0 w-px bg-slate-800" />
              <span aria-hidden className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 ${
                isNow ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.18)]' : isNext ? 'border-amber-400 bg-slate-900' : past ? 'bg-slate-700 border-slate-700' : 'border-slate-600 bg-slate-900'
              }`} />
              <div className={`${past ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold ${isNow ? 'text-cyan-300' : isNext ? 'text-amber-300' : 'text-slate-400'}`}>{timeLabel(it.item.time)}</span>
                  {isNow && <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-950 bg-cyan-400 rounded px-1.5 py-0.5">ora</span>}
                  {isNext && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-950 bg-amber-400 rounded px-1.5 py-0.5">poi</span>}
                </div>
                <div className={`text-[13px] leading-snug ${isNow ? 'text-white font-semibold' : 'text-slate-300'}`}>{briefOf(it.item)}{it.item.summary && it.item.summary !== it.item.activity && (<details className="mt-1 text-[12px] text-slate-400"><summary className="cursor-pointer select-none text-cyan-300/90">Dettagli</summary><p className="mt-1 leading-relaxed">{it.item.activity}</p></details>)}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );

  const quickLinks = (
    <section className="grid grid-cols-3 gap-2" data-testid="today-quicklinks">
      {[
        { id: 'wallet' as const, label: 'Wallet', icon: WalletCards, tint: 'text-cyan-300' },
        { id: 'expenses' as const, label: 'Spese', icon: Wallet, tint: 'text-emerald-300' },
        { id: 'places' as const, label: 'Luoghi', icon: Bookmark, tint: 'text-violet-300' },
        { id: 'flights' as const, label: 'Voli', icon: Plane, tint: 'text-sky-300' },
        { id: 'pdf' as const, label: 'PDF', icon: FileText, tint: 'text-rose-300' },
        { id: 'sos' as const, label: 'SOS', icon: ShieldAlert, tint: 'text-rose-400' }
      ].map((q) => (
        <button
          key={q.id}
          type="button"
          onClick={() => onGoTo(q.id)}
          data-testid={`quick-${q.id}`}
          className="min-h-[72px] rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-slate-200"
        >
          <q.icon className={`w-5 h-5 ${q.tint}`} />
          {q.label}
        </button>
      ))}
    </section>
  );

  if (!isDesktop) {
    return (
      <div className="space-y-4 -mt-1" data-testid="today-view">

        <MobileOggi
          simBanner={sim !== null ? (
            <div className="flex items-center justify-between gap-3" data-testid="sim-banner">
              <span className="ms-sm" style={{ color: '#dbe5ef' }}>Anteprima del viaggio</span>
              <button type="button" onClick={() => setSim(null)} className="ms-link" style={{ padding: 0, minHeight: 44, flex: 'none' }}>Esci</button>
            </div>
          ) : null}
          previewPanel={previewOpen ? (
            <div className="grid grid-cols-[1fr_auto] items-end gap-3 ms-pv" data-testid="preview-panel">
              <label className="col-span-2 flex flex-col gap-1 text-[13px] text-app-muted">
                Giorno
                <select value={pvDay} onChange={(e) => setPvDay(Number(e.target.value))} className="px-3 py-2.5 text-sm text-app-text">
                  {ITINERARY_DAYS.map((d) => <option key={d.id} value={d.id}>{d.dateStr.split(' ')[0]} marzo · {d.title}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px] text-app-muted">
                Ora (del posto)
                <input type="time" value={pvTime} onChange={(e) => setPvTime(e.target.value)} className="px-3 py-2.5 text-sm text-app-text" />
              </label>
              <button type="button" onClick={applyPreview} className="ms-btn">Mostra</button>
            </div>
          ) : null}
          now={now}
          simulated={sim !== null}
          after={after}
          dateLine={phoneDate}
          dayTitle={day.title}
          dayN={day.id + 1}
          dayTotal={TIMED_DAYS.length}
          seoulTime={seoulTime}
          current={current ? { clock: current.clock, label: briefOf(current.item), zone: current.zone } : null}
          next={next ? { clock: next.clock, label: briefOf(next.item), zone: next.zone, inText: nextIn } : null}
          following={items
            .slice(Math.max(where.nextIndex, where.currentIndex) + 1)
            .slice(0, 2)
            .map((t) => ({ clock: t.clock, label: briefOf(t.item), zone: t.zone, inText: formatCountdown(t.ts - now) }))}
          done={done}
          free={free}
          metro={metro}
          stop={stop ? { id: stop.id, name: stop.italianName } : null}
          homeId={home.id}
          heroEnabled={heroEnabled}
          onToggleHero={onToggleHero}
          onRoute={onRoute}
          onGoTo={onGoTo}
          onTryTrip={() => setSim(msFromDayAndClock(3, '14:30', 'KR'))}
          onPreview={() => setPreviewOpen((v) => !v)}
        />
        <div className="ms-flat">
          <WalletShortcut onOpen={() => onGoTo('wallet')} nowMs={now} />
          <GroupLiveCard onRoute={onRoute} onShowMap={() => onGoTo('map')} />
          {weatherCard}
          {timelineCard}
          {stopsCard}
          {showKoreanCard}
          {remindersCard}
          <OfflineCard />
        </div>
      </div>
    );
  }

  /* ---------- Desktop: stesso linguaggio dell'intestazione (fondo unico, filetti, mono + Outfit) ---------- */
  const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.08em', color: '#94A3B8', textTransform: 'uppercase' };
  const DISP: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontWeight: 800, letterSpacing: '-.03em' };
  const RULE = '1px solid #1E2B40';
  const ghostBtn = 'min-h-[40px] px-3.5 rounded-xl border border-[#1E2B40] hover:border-[#60718C] text-[14px] font-semibold text-app-text inline-flex items-center gap-2 transition-colors';
  const cyanBtn = 'min-h-[40px] px-4 rounded-xl bg-app-accent text-app-on-accent text-[14px] font-bold inline-flex items-center gap-2';

  const Head: React.FC<{ label: string; color?: string; title?: string; action?: { text: string; onClick: () => void } }> = ({ label, color, title, action }) => (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p style={{ ...MONO, color: color ?? '#94A3B8', margin: 0 }}>{label}</p>
        {title && <h3 style={{ ...DISP, fontSize: 26, margin: '6px 0 0' }}>{title}</h3>}
      </div>
      {action && <button type="button" onClick={action.onClick} className="shrink-0 text-[13px] font-semibold text-app-accent hover:underline pb-0.5">{action.text} →</button>}
    </div>
  );

  const tzOf = (at: string) => (at.endsWith('+01:00') ? 'Europe/Rome' : at.endsWith('+08:00') ? 'Asia/Shanghai' : 'Asia/Seoul');

  // Durante il viaggio: "Adesso" prende il posto del conto alla rovescia
  const dNow = !before && (
    <section data-testid="today-hero" data-state={after ? 'after' : current ? 'now' : next ? 'next' : done ? 'done' : 'free'}>
      <Head label={after ? 'Viaggio concluso' : current ? `Adesso · ${current.clock || 'in corso'} · ${zoneLabel(current.zone)}` : next ? 'Prossima' : 'Oggi'} color="#00C5E8" />
      <h2 data-testid="today-now" style={{ ...DISP, fontSize: 40, lineHeight: 1.05, margin: '10px 0 0' }}>
        {after ? 'Bentornati! Spero sia stato bellissimo.' : current ? briefOf(current.item) : next ? briefOf(next.item) : done ? 'Le attività di oggi sono finite.' : day.title}
      </h2>
      {after && <p className="mt-2 text-[15px] text-app-muted">La galleria e le spese restano qui per ripensarci con calma.</p>}
      {!current && next && !after && <p className="mt-2 text-[15px] text-app-muted">alle {next.clock || next.item.time} · tra {nextIn}</p>}
      {current && next && (
        <div className="mt-5 flex items-baseline gap-5" style={{ borderTop: RULE, paddingTop: 16 }}>
          <span style={{ ...DISP, fontSize: 22, color: '#FBBF24', fontVariantNumeric: 'tabular-nums' }}>{next.clock || next.item.time}</span>
          <div className="min-w-0"><p style={{ ...MONO, margin: 0 }}>Dopo · tra {nextIn}</p><p className="mt-1 text-[16px] font-semibold">{briefOf(next.item)}</p></div>
        </div>
      )}
      {metro.level !== 'none' && (
        <div role="status" data-testid="last-metro" className="mt-5 flex gap-3" style={{ borderTop: RULE, paddingTop: 16 }}>
          {metro.level === 'closed' ? <MoonIcon className="w-5 h-5 text-fam-sos shrink-0 mt-0.5" /> : <TrainFront className="w-5 h-5 text-fam-weather shrink-0 mt-0.5" />}
          <div><p className={`text-[15px] font-bold ${metro.level === 'closed' ? 'text-fam-sos' : 'text-fam-weather'}`}>{metro.title}</p><p className="mt-0.5 text-[14px] text-app-muted">{metro.text}</p></div>
        </div>
      )}
      {!after && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {stop && !done && <button type="button" onClick={() => onRoute(stop.id)} className={cyanBtn} data-testid="route-to-stop"><Navigation className="w-4 h-4" /> Portami a {stop.italianName}</button>}
          {free && <button type="button" onClick={() => onGoTo('places')} className={cyanBtn} data-testid="free-day-places"><Bookmark className="w-4 h-4" /> Apri i luoghi salvati</button>}
          <button type="button" onClick={() => onRoute(home.id)} className={metro.level !== 'none' || done ? cyanBtn : ghostBtn} data-testid="route-home"><Home className="w-4 h-4" /> Torna all’alloggio</button>
        </div>
      )}
    </section>
  );

  const dTimeline = items.length > 0 && (
    <section>
      <Head label={`${day.dayOfWeek} ${day.dateStr.replace(' 2027', '')}`} title={day.title} action={{ text: 'Giorno completo', onClick: () => onGoTo('itinerary') }} />
      {where.currentIndex > 0 && !showPast && (
        <button type="button" onClick={() => setShowPast(true)} className="mt-3 text-[13px] text-app-muted hover:text-app-text flex items-center gap-1"><ChevronDown className="w-3.5 h-3.5" /> {where.currentIndex} già {where.currentIndex === 1 ? 'fatta' : 'fatte'}</button>
      )}
      <ol className="mt-4" style={{ borderBottom: RULE }}>
        {items.map((it, i) => {
          const past = i < where.currentIndex;
          if (past && !showPast) return null;
          const isNow = i === where.currentIndex;
          const isNext = i === where.nextIndex;
          return (
            <li key={i} data-testid={isNow ? 'timeline-now' : undefined} className="grid items-start gap-5" style={{ gridTemplateColumns: '84px minmax(0,1fr) auto', borderTop: RULE, padding: '16px 0', opacity: past ? 0.5 : 1 }}>
              <span style={{ ...DISP, fontSize: 20, fontVariantNumeric: 'tabular-nums', color: isNow ? '#00C5E8' : isNext ? '#FBBF24' : '#60A5FA' }}>{timeLabel(it.item.time)}</span>
              <div className={`text-[16px] leading-snug ${isNow ? 'font-bold' : 'font-medium text-slate-200'}`}>{briefOf(it.item)}{it.item.summary && it.item.summary !== it.item.activity && (<details className="mt-1.5 text-[14px] text-app-muted"><summary className="cursor-pointer select-none text-app-accent">Dettagli</summary><p className="mt-1.5 leading-relaxed">{it.item.activity}</p></details>)}</div>
              {(isNow || isNext) && <span style={{ ...MONO, color: isNow ? '#00C5E8' : '#FBBF24' }}>{isNow ? 'ora' : 'poi'}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );

  const dKorean = (
    <button type="button" onClick={() => onGoTo('show')} data-testid="open-show-korean" className="w-full text-left flex items-center gap-5 group" style={{ borderTop: RULE, borderBottom: RULE, padding: '20px 0' }}>
      <span style={{ ...DISP, fontSize: 34, color: '#FB923C' }} aria-hidden>한</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold">Mostra in coreano</span>
        <span className="block mt-0.5 text-[14px] text-app-muted">Destinazione per il tassista, dieta e allergie, frasi utili, emergenze.</span>
      </span>
      <ChevronRight className="w-5 h-5 text-app-muted group-hover:text-app-text shrink-0" />
    </button>
  );

  const dWeather = (
    <section>
      <Head label="Meteo" color="#FBBF24" title="Seul adesso" action={{ text: 'Dettagli', onClick: () => onGoTo('weather') }} />
      {weather ? (
        <div className="mt-4 flex items-center gap-5">
          <WeatherIcon name={weather.current.condition.iconName} className="w-12 h-12" />
          <div>
            <div style={{ ...DISP, fontSize: 56, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{Math.round(weather.current.temperatureC)}°</div>
            <div className="mt-1 text-[14px] text-app-muted">{weather.current.condition.labelIt}</div>
          </div>
          <div className="ml-auto text-right text-[13px] text-app-muted space-y-1.5">
            <div>{Math.round(weather.daily[0].tempMinC)}° / {Math.round(weather.daily[0].tempMaxC)}°</div>
            <div className="flex items-center justify-end gap-1.5"><Droplets className="w-3.5 h-3.5 text-sky-400" />{weather.daily[0].precipitationProbability}%</div>
            <div className="flex items-center justify-end gap-1.5"><Wind className="w-3.5 h-3.5" />{Math.round(weather.current.windSpeedKmH)} km/h</div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-app-muted">{weatherFailed ? 'Meteo non disponibile senza connessione.' : 'Carico il meteo…'}</p>
      )}
      {air && (
        <div className="mt-4 flex items-center gap-2.5 text-[13px]" style={{ borderTop: RULE, paddingTop: 14 }} data-testid="air-quality">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${['bg-emerald-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-500', 'bg-purple-500'][air.level]}`} />
          <span className="font-semibold">Aria: {air.labelIt}</span>
          <span className="ml-auto text-app-muted tabular-nums">PM2,5 {air.pm25} · PM10 {air.pm10}</span>
        </div>
      )}
      {air && air.adviceIt && <p className="mt-2 text-[13px] text-orange-200 leading-snug flex gap-2" data-testid="air-advice"><AlertTriangle className="w-4 h-4 shrink-0 text-orange-300" />{air.adviceIt}</p>}
      {weather && weather.daily[0].precipitationProbability >= 60 && (
        <p className="mt-2 text-[13px] text-sky-200 leading-snug flex gap-2" data-testid="rain-advice"><Droplets className="w-4 h-4 shrink-0 text-sky-300" />Pioggia probabile oggi ({weather.daily[0].precipitationProbability}%): porta l’ombrello e punta su musei, COEX e mercati coperti invece di Namsan o Bukhansan.</p>
      )}
      {weather && <p className="mt-3 text-[14px] text-slate-300 leading-snug" style={{ borderTop: RULE, paddingTop: 14 }}>{weather.current.condition.activityTipIt}</p>}
    </section>
  );

  const dStops = stops.length > 0 && (
    <section>
      <Head label="Luoghi" color="#A78BFA" title="Tappe di oggi" />
      <ul className="mt-3" style={{ borderBottom: RULE }}>
        {stops.map((s) => (
          <li key={s.id} style={{ borderTop: RULE }}>
            <button type="button" onClick={() => setPickedStop(s.id)} aria-pressed={stop?.id === s.id} className="w-full text-left flex items-center gap-3 py-3.5 min-h-[56px]" style={stop?.id === s.id ? { boxShadow: 'inset 2px 0 0 #00C5E8', paddingLeft: 12, background: '#101A2D' } : undefined}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold truncate">{s.italianName}</span>
                <span className="block text-[13px] text-app-muted truncate">{s.district}</span>
              </span>
              {s.koreanName && /[가-힣]/.test(s.koreanName) && <span className="text-[15px] text-slate-300 shrink-0">{s.koreanName}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  const dReminders = (
    <section data-testid="reminders-card">
      <Head label="Calendario" color="#FBBF24" title="Promemoria" />
      <ul className="mt-3" style={{ borderBottom: RULE }}>
        {upcoming.map((r) => {
          const tz = tzOf(r.at);
          const t = r.title.replace(/^Seul: /, '');
          return (
            <li key={r.id} className="grid items-center gap-4" style={{ gridTemplateColumns: '64px minmax(0,1fr)', borderTop: RULE, padding: '14px 0' }}>
              <span style={{ ...DISP, fontSize: 20, color: '#FBBF24' }}>{new Date(r.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: tz })}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug">{t.charAt(0).toUpperCase() + t.slice(1)}</p>
                <p className="text-[13px] text-app-muted">{r.at.slice(11, 16)} · {REMINDER_AUDIENCE_LABEL[r.audience]}</p>
              </div>
            </li>
          );
        })}
        {upcoming.length === 0 && <li style={{ borderTop: RULE, padding: '14px 0' }} className="text-[14px] text-app-muted">Nessun promemoria in programma.</li>}
      </ul>
      <button type="button" onClick={exportIcs} data-testid="export-ics" className={`${ghostBtn} mt-4`}>
        {icsState === 'done' ? <><Check className="w-4 h-4" /> Pronto: aprilo per aggiungerli</> : <><CalendarPlus className="w-4 h-4" /> Aggiungi tutti al calendario</>}
      </button>
      <p className="mt-2 text-[13px] text-app-muted leading-snug">{myReminders.length} promemoria con sveglia, validi anche senza connessione.</p>
    </section>
  );

  const dQuick = (
    <section data-testid="today-quicklinks">
      <p style={{ ...MONO, margin: 0 }}>Scorciatoie</p>
      <div className="mt-3 grid grid-cols-3" style={{ borderTop: RULE, borderLeft: RULE }}>
        {[
          { id: 'wallet' as const, label: 'Wallet', icon: WalletCards, tint: '#34D399' },
          { id: 'expenses' as const, label: 'Spese', icon: Wallet, tint: '#34D399' },
          { id: 'places' as const, label: 'Luoghi', icon: Bookmark, tint: '#A78BFA' },
          { id: 'flights' as const, label: 'Voli', icon: Plane, tint: '#818CF8' },
          { id: 'pdf' as const, label: 'PDF', icon: FileText, tint: '#FB923C' },
          { id: 'sos' as const, label: 'SOS', icon: ShieldAlert, tint: '#F87171' }
        ].map((q) => (
          <button key={q.id} type="button" onClick={() => onGoTo(q.id)} data-testid={`quick-${q.id}`} className="min-h-[76px] flex flex-col items-center justify-center gap-1.5 text-[13px] font-semibold hover:bg-[#101A2D] transition-colors" style={{ borderRight: RULE, borderBottom: RULE }}>
            <q.icon className="w-5 h-5" style={{ color: q.tint }} />
            {q.label}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="animate-in fade-in duration-200" data-testid="today-view">
      <DesktopOggiHero
        heroEnabled={heroEnabled}
        onToggleHero={onToggleHero}
        onOpenItinerary={() => onGoTo('itinerary')}
        simNow={sim}
        program={items.slice(0, 4).map((t) => ({ time: t.clock || timeLabel(t.item.time), title: briefOf(t.item), sub: zoneLabel(t.zone) }))}
        greeting={`${firstName ? `Ciao ${firstName}` : 'Oggi'} · Seul ${seoulTime} · Italia ${romeTime}`}
        shortcuts={dQuick}
      />
      <div className="px-10 pb-12" style={{ borderTop: RULE }}>
        {/* Barra di stato: saluto + modalità anteprima, nella stessa grammatica dell'intestazione */}
        <div className="flex flex-wrap items-center justify-end gap-3 py-5">
          <div className="flex gap-2.5">
            {before && (
              <button type="button" onClick={() => setSim(msFromDayAndClock(3, '14:30', 'KR'))} className={cyanBtn} data-testid="try-trip-mode"><Eye className="w-4 h-4" /> Prova la modalità viaggio</button>
            )}
            <button type="button" onClick={() => setPreviewOpen((v) => !v)} className={ghostBtn} aria-expanded={previewOpen} data-testid="preview-toggle">
              <Eye className="w-4 h-4" /> Anteprima
            </button>
          </div>
        </div>

        {previewOpen && (
          <div className="mb-6 flex flex-wrap items-end gap-3 py-4" style={{ borderTop: RULE, borderBottom: RULE }} data-testid="preview-panel">
            <label className="flex flex-col gap-1.5 min-w-[12rem] flex-1" style={MONO}>
              Giorno
              <select value={pvDay} onChange={(e) => setPvDay(Number(e.target.value))} className="bg-app-bg border border-[#1E2B40] rounded-xl px-3 py-2.5 text-[14px] text-app-text normal-case" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: 0 }}>
                {ITINERARY_DAYS.map((d) => <option key={d.id} value={d.id}>{d.dateStr.split(' ')[0]} marzo · {d.title}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5" style={MONO}>
              Ora (del posto)
              <input type="time" value={pvTime} onChange={(e) => setPvTime(e.target.value)} className="bg-app-bg border border-[#1E2B40] rounded-xl px-3 py-2.5 text-[14px] text-app-text" />
            </label>
            <button type="button" onClick={applyPreview} className={cyanBtn}>Mostra</button>
          </div>
        )}

        {sim !== null && (
          <div className="mb-6 flex items-center justify-between gap-3 py-3 text-[14px] text-amber-200" style={{ borderTop: '1px solid rgba(251,191,36,.4)', borderBottom: '1px solid rgba(251,191,36,.4)' }} data-testid="sim-banner">
            <span>Anteprima: stai vedendo il {formatInZone(sim, 'Asia/Seoul', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} (ora di Seul), non l’ora reale.</span>
            <button type="button" onClick={() => setSim(null)} className="shrink-0 flex items-center gap-1 font-bold hover:text-white"><X className="w-3.5 h-3.5" /> Esci</button>
          </div>
        )}

        {/* Stessa griglia dell'intestazione: 1.5fr / 1fr, gap 40 */}
        <div className="grid items-start gap-10" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
          <div className="space-y-10 min-w-0 oggi-flat">
            {dNow}
            <WalletShortcut onOpen={() => onGoTo('wallet')} nowMs={now} />
            <GroupLiveCard onRoute={onRoute} onShowMap={() => onGoTo('map')} />
            {dTimeline}
            {dKorean}
          </div>
          <div className="space-y-10 min-w-0 oggi-flat">
            {dWeather}
            {dStops}
            {dReminders}
            <OfflineCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodayView;
