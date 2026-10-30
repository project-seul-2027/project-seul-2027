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
import {
  TIMED_DAYS, locateNow, formatCountdown, formatInZone, msFromDayAndClock, zoneLabel, zoneOfDay
} from '../utils/tripClock';
import {
  TRIP_REMINDERS, REMINDER_AUDIENCE_LABEL, buildIcs, reminderApplies, saveIcsFile
} from '../utils/tripReminders';

export type TodayTarget = 'wallet' | 'places' | 'sos' | 'map' | 'show' | 'weather' | 'expenses' | 'flights' | 'itinerary' | 'pdf';

interface TodayViewProps {
  /** Apre la mappa già in modalità percorso: dalla posizione GPS verso la destinazione */
  onRoute: (destinationId: string) => void;
  onGoTo: (tab: TodayTarget) => void;
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

export const TodayView: React.FC<TodayViewProps> = ({ onRoute, onGoTo }) => {
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
  const firstName = user?.firstName || user?.displayName || '';
  const daysToGo = Math.max(0, Math.ceil((TIMED_DAYS[0].startTs + 2 * 3_600_000 - now) / 86_400_000));

  const nextIn = next ? formatCountdown(next.ts - now) : '';
  // Solo durante il viaggio e nei giorni a Seul: l'ultima metro conta se sei fuori la sera
  const metro = useMemo(
    () => (where.phase === 'during' && day.id >= 1 && day.id <= 18 ? lastMetroStatus(now) : { level: 'none' as const, title: '', text: '' }),
    [where.phase, day.id, now]
  );

  /* ------------------------------------------------------------------ */

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
            {current ? current.item.activity : `Inizia la giornata: ${day.title}`}
          </h2>
          {next && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-950/60 border border-slate-800 p-3.5">
              <div className="shrink-0 w-14 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Dopo</div>
                <div className="text-base font-bold font-mono text-amber-300">{next.clock || next.item.time}</div>
                <div className="text-[10px] text-slate-500">tra {nextIn}</div>
              </div>
              <p className="text-sm text-slate-200 leading-snug min-w-0">{next.item.activity}</p>
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
                  <span className={`text-xs font-mono font-bold ${isNow ? 'text-cyan-300' : isNext ? 'text-amber-300' : 'text-slate-400'}`}>{it.item.time}</span>
                  {isNow && <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-950 bg-cyan-400 rounded px-1.5 py-0.5">ora</span>}
                  {isNext && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-950 bg-amber-400 rounded px-1.5 py-0.5">poi</span>}
                </div>
                <p className={`text-[13px] leading-snug ${isNow ? 'text-white font-semibold' : 'text-slate-300'}`}>{it.item.activity}</p>
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

  return (
    <div className="space-y-4 animate-in fade-in duration-200" data-testid="today-view">
      {/* Intestazione: saluto, orologi, anteprima */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-black font-display text-white">
            {firstName ? `Ciao ${firstName}` : 'Oggi'}
            <span className="text-slate-500 font-semibold">  ·  </span>
            <span className="capitalize text-slate-300 font-semibold text-base sm:text-lg">{seoulDate}</span>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-cyan-400" /> Seul <b className="text-slate-100 font-mono">{seoulTime}</b></span>
            <span className="flex items-center gap-1.5">Italia <b className="text-slate-300 font-mono">{romeTime}</b></span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5"
          aria-expanded={previewOpen}
          data-testid="preview-toggle"
        >
          <Eye className="w-3.5 h-3.5" /> Anteprima
        </button>
      </header>

      {previewOpen && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 flex flex-wrap items-end gap-3" data-testid="preview-panel">
          <label className="flex flex-col gap-1 text-[11px] text-slate-400 min-w-[10rem] flex-1">
            Giorno
            <select value={pvDay} onChange={(e) => setPvDay(Number(e.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white">
              {ITINERARY_DAYS.map((d) => <option key={d.id} value={d.id}>{d.dateStr.split(' ')[0]} marzo · {d.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            Ora (del posto)
            <input type="time" value={pvTime} onChange={(e) => setPvTime(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white" />
          </label>
          <button type="button" onClick={applyPreview} className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold">Mostra</button>
        </div>
      )}

      {sim !== null && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200" data-testid="sim-banner">
          <span>Anteprima: stai vedendo il {formatInZone(sim, 'Asia/Seoul', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} (ora di Seul), non l’ora reale.</span>
          <button type="button" onClick={() => setSim(null)} className="shrink-0 flex items-center gap-1 font-bold hover:text-white"><X className="w-3.5 h-3.5" /> Esci</button>
        </div>
      )}

      {/* Telefono: una colonna in ordine d'uso. PC: due colonne. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-3 space-y-4">
          <WalletShortcut onOpen={() => onGoTo('wallet')} nowMs={now} />
          {heroCard}
          <GroupLiveCard onRoute={onRoute} onShowMap={() => onGoTo('map')} />
          {showKoreanCard}
          <div className="lg:hidden space-y-4">{stopsCard}{weatherCard}</div>
          {timelineCard}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="hidden lg:block space-y-4">{stopsCard}{weatherCard}</div>
          {remindersCard}
          <OfflineCard />
          {quickLinks}
        </div>
      </div>
    </div>
  );
};

export default TodayView;
