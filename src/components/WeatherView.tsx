import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  Umbrella,
  Shirt,
  RefreshCw,
  AlertCircle,
  Calendar,
  MapPin,
  Sparkles,
  Clock,
  Compass,
  ArrowUpRight,
  Info,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  WEATHER_LOCATIONS,
  SEOUL_MARCH_CLIMATE,
  fetchLiveWeather,
  getWmoCondition,
  toFahrenheit,
  type WeatherLocation,
  type LiveWeatherData,
  type WeatherTheme
} from '../data/weatherData';
import { useMediaQuery } from '../pwa';
import { WeatherScene } from './WeatherScene';

interface WeatherViewProps {
  onNavigateToItinerary?: () => void;
}

/**
 * Mappatura tema meteo -> stili grafici, gradienti e accenti di colore
 */
const THEME_STYLES: Record<
  WeatherTheme,
  {
    bgGradient: string;
    ambientGlow: string;
    cardBorder: string;
    accentBadge: string;
    textAccent: string;
    particleIcon: string;
  }
> = {
  sunny: {
    bgGradient: 'from-amber-950/40 via-orange-950/20 to-slate-950',
    ambientGlow: 'rgba(245, 158, 11, 0.18)',
    cardBorder: 'border-amber-500/30',
    accentBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    textAccent: 'text-amber-400',
    particleIcon: '☀️'
  },
  clearNight: {
    bgGradient: 'from-indigo-950/70 via-slate-950 to-slate-950',
    ambientGlow: 'rgba(99, 102, 241, 0.22)',
    cardBorder: 'border-indigo-400/30',
    accentBadge: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
    textAccent: 'text-indigo-300',
    particleIcon: '🌙'
  },
  partlyCloudyNight: {
    bgGradient: 'from-slate-900 via-indigo-950/40 to-slate-950',
    ambientGlow: 'rgba(129, 140, 248, 0.16)',
    cardBorder: 'border-indigo-400/25',
    accentBadge: 'bg-slate-800/80 text-indigo-200 border-indigo-400/30',
    textAccent: 'text-indigo-300',
    particleIcon: '☁️'
  },
  partlyCloudy: {
    bgGradient: 'from-sky-950/40 via-slate-900 to-slate-950',
    ambientGlow: 'rgba(14, 165, 233, 0.16)',
    cardBorder: 'border-sky-500/30',
    accentBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    textAccent: 'text-sky-400',
    particleIcon: '⛅'
  },
  cloudy: {
    bgGradient: 'from-slate-900 via-slate-950 to-[#070b12]',
    ambientGlow: 'rgba(148, 163, 184, 0.12)',
    cardBorder: 'border-slate-700/60',
    accentBadge: 'bg-slate-800 text-slate-300 border-slate-700',
    textAccent: 'text-slate-300',
    particleIcon: '☁️'
  },
  rainy: {
    bgGradient: 'from-teal-950/45 via-cyan-950/25 to-slate-950',
    ambientGlow: 'rgba(20, 184, 166, 0.20)',
    cardBorder: 'border-teal-500/35',
    accentBadge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    textAccent: 'text-teal-400',
    particleIcon: '🌧️'
  },
  snowy: {
    bgGradient: 'from-indigo-950/45 via-blue-950/30 to-slate-950',
    ambientGlow: 'rgba(99, 102, 241, 0.22)',
    cardBorder: 'border-indigo-400/40',
    accentBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40',
    textAccent: 'text-indigo-300',
    particleIcon: '❄️'
  },
  stormy: {
    bgGradient: 'from-purple-950/50 via-indigo-950/30 to-slate-950',
    ambientGlow: 'rgba(168, 85, 247, 0.25)',
    cardBorder: 'border-purple-500/40',
    accentBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    textAccent: 'text-purple-400',
    particleIcon: '⚡'
  },
  foggy: {
    bgGradient: 'from-slate-900/60 via-slate-950 to-slate-950',
    ambientGlow: 'rgba(203, 213, 225, 0.12)',
    cardBorder: 'border-slate-700/50',
    accentBadge: 'bg-slate-800/80 text-slate-300 border-slate-600/50',
    textAccent: 'text-slate-300',
    particleIcon: '🌫️'
  }
};

/**
 * Restituisce il colore del gradiente di temperatura
 */
function getTemperatureColorClass(tempC: number): string {
  if (tempC <= 0) return 'text-cyan-300';
  if (tempC <= 8) return 'text-sky-300';
  if (tempC <= 16) return 'text-emerald-300';
  if (tempC <= 23) return 'text-amber-300';
  return 'text-orange-400';
}

function renderWeatherIcon(iconName: string, className = 'w-5 h-5') {
  switch (iconName) {
    case 'Sun':
      return <Sun className={`${className} text-amber-400`} />;
    case 'Moon':
      return <Moon className={`${className} text-indigo-300`} />;
    case 'CloudSun':
      return <CloudSun className={`${className} text-amber-300`} />;
    case 'CloudMoon':
      return <CloudMoon className={`${className} text-sky-300`} />;
    case 'Cloud':
      return <Cloud className={`${className} text-slate-400`} />;
    case 'CloudDrizzle':
      return <CloudDrizzle className={`${className} text-cyan-300`} />;
    case 'CloudRain':
      return <CloudRain className={`${className} text-teal-400`} />;
    case 'CloudSnow':
      return <CloudSnow className={`${className} text-indigo-200`} />;
    case 'CloudLightning':
      return <CloudLightning className={`${className} text-purple-400`} />;
    case 'CloudFog':
      return <CloudFog className={`${className} text-slate-300`} />;
    default:
      return <CloudSun className={`${className} text-sky-300`} />;
  }
}

export const WeatherView: React.FC<WeatherViewProps> = ({ onNavigateToItinerary }) => {
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation>(WEATHER_LOCATIONS[0]);
  const [weatherData, setWeatherData] = useState<LiveWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [activeTab, setActiveTab] = useState<'forecast' | 'climate'>('forecast');
  const [hourlyInterval, setHourlyInterval] = useState<'1h' | '3h'>('1h');
  const [isHourlyExpanded, setIsHourlyExpanded] = useState<boolean>(false);
  // Layout da telefono/tablet: sotto-schede invece di una pagina lunghissima
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileTab, setMobileTab] = useState<'hours' | 'days' | 'climate'>('hours');
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(0);
  const [isNoteOpen, setIsNoteOpen] = useState<boolean>(false);
  const [isTipOpen, setIsTipOpen] = useState<boolean>(false);

  // Calcolo delle ore da visualizzare (tutte le 24 ore o filtrate a intervalli di 3 ore)
  const displayedHourly = useMemo(() => {
    if (!weatherData?.hourly) return [];
    if (hourlyInterval === '3h') {
      return weatherData.hourly.filter((_, idx) => idx % 3 === 0);
    }
    return weatherData.hourly;
  }, [weatherData?.hourly, hourlyInterval]);

  // Range termico per l'indicatore visuale della temperatura nelle 24h
  const hourlyTempRange = useMemo(() => {
    if (!displayedHourly || displayedHourly.length === 0) return { min: 0, max: 20 };
    const temps = displayedHourly.map((h) => h.temperatureC);
    return {
      min: Math.min(...temps),
      max: Math.max(...temps)
    };
  }, [displayedHourly]);

  // Caricamento dati da Open-Meteo
  const loadWeather = async (loc: WeatherLocation) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLiveWeather(loc);
      setWeatherData(data);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Impossibile contattare il servizio meteo.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeather(selectedLocation);
  }, [selectedLocation]);

  const currentTheme: WeatherTheme = weatherData?.current.condition.theme ?? 'partlyCloudy';
  const themeStyle = THEME_STYLES[currentTheme];

  const formatTemp = (tempC: number) => {
    if (unit === 'F') {
      return `${toFahrenheit(tempC)}°F`;
    }
    return `${tempC}°C`;
  };

  const selectedDay = weatherData?.daily[selectedDayIndex] ?? null;

  const climateSection = (
    <div className="space-y-6">
      {/* Card Panoramica Clima Marzo a Seul */}
      <div className="p-4 sm:p-8 rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-950 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
              Archivio Climatologico Ufficiale Seul
            </span>
            <h3 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
              Cosa aspettarsi a Seul tra il 2 e il 19 Marzo
            </h3>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-400 text-cyan-300 text-xs font-semibold whitespace-nowrap">
            Transizione Inverno → Primavera
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
          Marzo a Seul segna il risveglio della primavera coreana. L&apos;aria è generalmente secca e pulita, con giornate limpide e soleggiate ideali per camminare. Tuttavia l&apos;escursione termica tra il primo pomeriggio e la tarda serata può superare i 10°C, richiedendo la tecnica della vestizione a strati (&ldquo;a cipolla&rdquo;).
        </p>

        {/* Metriche Clima Storico */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-sans block uppercase">Media Massime</span>
            <span className="text-lg font-bold text-emerald-300 mt-1 block">
              {formatTemp(SEOUL_MARCH_CLIMATE.avgHighC)}
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Ore centrali (13-15)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-sans block uppercase">Media Minime</span>
            <span className="text-lg font-bold text-cyan-300 mt-1 block">
              {formatTemp(SEOUL_MARCH_CLIMATE.avgLowC)}
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Notte e prima mattina</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-sans block uppercase">Record Storico Max</span>
            <span className="text-lg font-bold text-amber-300 mt-1 block">
              {formatTemp(SEOUL_MARCH_CLIMATE.recordHighC)}
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Pomeriggio mite</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-sans block uppercase">Record Storico Min</span>
            <span className="text-lg font-bold text-indigo-300 mt-1 block">
              {formatTemp(SEOUL_MARCH_CLIMATE.recordLowC)}
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Ondata di gelo siberiano</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-sans block uppercase">Giorni di Pioggia</span>
            <span className="text-lg font-bold text-teal-300 mt-1 block">
              ~{SEOUL_MARCH_CLIMATE.avgRainyDays} gg
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Su tutto il mese (basso)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-sans block uppercase">Ore Sole al Giorno</span>
            <span className="text-lg font-bold text-yellow-300 mt-1 block">
              {SEOUL_MARCH_CLIMATE.avgSunshineHoursPerDay}h
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Giornate limpide</span>
          </div>
        </div>
      </div>

      {/* Il Fenomeno "Kkot-saem-chu-wi" */}
      <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-950/15 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌸</span>
          <h4 className="text-sm font-bold text-amber-200">
            {SEOUL_MARCH_CLIMATE.phenomenonTitleIt} ({SEOUL_MARCH_CLIMATE.phenomenonKorean})
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {SEOUL_MARCH_CLIMATE.phenomenonDescriptionIt}
        </p>
      </div>

      {/* Checklist Valigia e Abbigliamento per il Gruppo */}
      <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-slate-950 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Shirt className="w-4 h-4 text-cyan-400 shrink-0" />
            <h4 className="text-sm font-bold text-white">
              Checklist Abbigliamento Consigliato per Seul a Marzo (Valigia 23kg)
            </h4>
          </div>
          <span className="text-xs text-slate-400">Preparazione valigia 4 amici</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SEOUL_MARCH_CLIMATE.packingChecklist.map((pack, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3"
            >
              <CheckCircle2
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  pack.importance === 'essenziale'
                    ? 'text-cyan-400'
                    : pack.importance === 'consigliato'
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100">{pack.item}</span>
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                      pack.importance === 'essenziale'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {pack.importance}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{pack.reasonIt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Riferimento API & citazioni ufficiali
  const footerSection = (
  <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span>Servizio Meteo fornito da</span>
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-400 hover:text-cyan-400 underline font-mono"
      >
        Open-Meteo API (Open Database License)
      </a>
      <span>·</span>
      <span>Dati climatici storici KMA (Korea Meteorological Administration)</span>
    </div>

    <button
      type="button"
      onClick={() => {
        if (onNavigateToItinerary) {
          onNavigateToItinerary();
        }
      }}
      className="text-cyan-400 hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
    >
      <span>Vedi tappe giornaliere dell&apos;itinerario</span>
      <ArrowUpRight className="w-3 h-3" />
    </button>
  </div>
  );

  // ───────────────────────── Layout da telefono e tablet ─────────────────────────
  // Tutto l'essenziale (città, meteo adesso, ore) sta nella prima schermata; il resto è in sotto-schede.
  if (!isDesktop) {
    const current = weatherData?.current ?? null;
    const today = weatherData?.daily[0] ?? null;
    const hourIdx = Math.min(selectedHourIdx, Math.max(0, displayedHourly.length - 1));
    const hour = displayedHourly[hourIdx] ?? null;
    const hourCond = hour ? getWmoCondition(hour.weatherCode, hour.isDay) : null;
    const firstDate = displayedHourly[0]?.time.slice(0, 10);
    // Riassunto delle prossime ore: escursione termica e momento con più probabilità di pioggia
    const next24 = weatherData?.hourly ?? [];
    const rainPeak = next24.reduce<(typeof next24)[number] | null>(
      (best, h) => (h.precipitationProbability > (best?.precipitationProbability ?? 0) ? h : best),
      null
    );
    const weekMin = weatherData ? Math.min(...weatherData.daily.map((d) => d.tempMinC)) : 0;
    const weekMax = weatherData ? Math.max(...weatherData.daily.map((d) => d.tempMaxC)) : 1;
    const weekSpan = Math.max(1, weekMax - weekMin);

    const tabs = [
      { id: 'hours' as const, label: 'Ore', icon: Clock },
      { id: 'days' as const, label: '7 giorni', icon: Calendar },
      { id: 'climate' as const, label: 'Clima marzo', icon: Thermometer }
    ];

    return (
      <div className="space-y-3 animate-in fade-in duration-200">
        {/* Barra compatta: aggiornamento, unità, aggiorna, info */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              <Compass className="w-3 h-3 shrink-0" />
              <span>Meteo live</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {weatherData ? `Aggiornato alle ${weatherData.fetchedAt}` : 'Caricamento…'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              {(['C', 'F'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    unit === u ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => loadWeather(selectedLocation)}
              disabled={isLoading}
              aria-label="Aggiorna meteo"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsNoteOpen((v) => !v)}
              aria-label="Informazioni sulle previsioni"
              aria-expanded={isNoteOpen}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border ${
                isNoteOpen ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isNoteOpen && (
          <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/70 text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-white">Nota sulle date:</strong> il viaggio a Seul è dal{' '}
            <strong className="text-cyan-300">2 al 19 marzo 2027</strong>. Le previsioni sono affidabili fino a 7 giorni:
            qui vedi quelle reali dei prossimi 7 giorni, mentre nella scheda <strong>Clima marzo</strong> trovi il profilo
            storico e cosa mettere in valigia. Dati: Open-Meteo e KMA.
          </div>
        )}

        {/* Tappe: una sola riga scorrevole */}
        <div
          className="-mx-4 px-4 flex gap-2 overflow-x-auto snap-x scroll-pl-4 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
          role="group"
          aria-label="Località"
        >
          {WEATHER_LOCATIONS.map((loc) => {
            const isSelected = selectedLocation.id === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedLocation(loc);
                  setSelectedDayIndex(0);
                  setSelectedHourIdx(0);
                }}
                className={`snap-start shrink-0 h-10 pl-2.5 pr-3.5 rounded-full border flex items-center gap-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 text-cyan-300 ring-1 ring-cyan-500/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-200'
                }`}
              >
                <span className="text-base leading-none">{loc.flag}</span>
                <span className="whitespace-nowrap">{loc.shortName}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadWeather(selectedLocation)}
              className="px-3 py-1 rounded-lg bg-red-900/60 text-white font-medium shrink-0"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Meteo adesso, compatto */}
        <div
          className={`relative rounded-3xl border ${themeStyle.cardBorder} bg-gradient-to-br ${themeStyle.bgGradient} p-3.5 overflow-hidden`}
          style={{ boxShadow: `0 12px 32px -12px ${themeStyle.ambientGlow}` }}
        >
          <div
            className="absolute -right-8 -top-10 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-40"
            style={{ backgroundColor: themeStyle.ambientGlow }}
          />
          {current && (
            <WeatherScene
              code={current.weatherCode}
              isDay={current.isDay === 1}
              precipitationMm={current.precipitationMm}
              windKmH={current.windSpeedKmH}
              compact
            />
          )}
          <div className="relative z-10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-white truncate">{selectedLocation.name.split(' (')[0]}</div>
              <span
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${themeStyle.accentBadge}`}
              >
                <Sparkles className="w-3 h-3" />
                {current?.condition.labelIt ?? '…'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-5xl font-extrabold font-display tracking-tight text-white font-mono tabular-nums leading-none">
                {current ? formatTemp(current.temperatureC) : '--'}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5 text-[11px] font-mono tabular-nums text-slate-300">
                <div>
                  Percepita{' '}
                  <strong className={getTemperatureColorClass(current?.apparentTemperatureC ?? 10)}>
                    {current ? formatTemp(current.apparentTemperatureC) : '--'}
                  </strong>
                </div>
                <div>
                  Oggi{' '}
                  <strong className="text-white">
                    {today ? `${formatTemp(today.tempMinC)} / ${formatTemp(today.tempMaxC)}` : '--'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
              <div className="px-2 py-1.5 rounded-xl bg-slate-950/50 border border-slate-800/70 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white">{current?.windSpeedKmH ?? '--'}</span>
                <span className="text-[10px] text-slate-500">km/h</span>
              </div>
              <div className="px-2 py-1.5 rounded-xl bg-slate-950/50 border border-slate-800/70 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white">{current?.relativeHumidity ?? '--'}%</span>
                <span className="text-[10px] text-slate-500">umid.</span>
              </div>
              <div className="px-2 py-1.5 rounded-xl bg-slate-950/50 border border-slate-800/70 flex items-center gap-1.5">
                <Umbrella className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white">{today?.precipitationProbability ?? 0}%</span>
                <span className="text-[10px] text-slate-500">pioggia</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sotto-schede */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-800" role="tablist" aria-label="Sezioni meteo">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mobileTab === id}
              onClick={() => setMobileTab(id)}
              className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === id ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ORE: striscia orizzontale, subito visibile */}
        {mobileTab === 'hours' && (
          <div className="space-y-2.5" role="tabpanel" aria-label="Previsioni orarie">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Prossime 24 ore
                <span className="text-[10px] font-mono font-normal text-slate-500">
                  {selectedLocation.id === 'beijing' ? 'UTC+8' : 'UTC+9'}
                </span>
              </span>
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                {(['1h', '3h'] as const).map((iv) => (
                  <button
                    key={iv}
                    type="button"
                    aria-pressed={hourlyInterval === iv}
                    onClick={() => {
                      setHourlyInterval(iv);
                      setSelectedHourIdx(0);
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold ${
                      hourlyInterval === iv ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    {iv === '1h' ? 'Ogni ora' : 'Ogni 3 ore'}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="-mx-4 px-4 flex gap-2 overflow-x-auto snap-x scroll-pl-4 pb-1 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
              role="list"
              aria-label="Ore"
            >
              {displayedHourly.length === 0 && (
                <div className="text-xs text-slate-500 py-6">{isLoading ? 'Caricamento delle ore…' : 'Nessun dato orario.'}</div>
              )}
              {displayedHourly.map((h, i) => {
                const cond = getWmoCondition(h.weatherCode, h.isDay);
                const isNow = i === 0;
                const isSel = i === hourIdx;
                const nextDay = firstDate && h.time.slice(0, 10) !== firstDate;
                return (
                  <button
                    key={h.time}
                    type="button"
                    role="listitem"
                    aria-pressed={isSel}
                    onClick={() => setSelectedHourIdx(i)}
                    className={`snap-start shrink-0 w-[68px] py-2.5 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                      isSel
                        ? 'bg-slate-800 border-cyan-400 ring-1 ring-cyan-500/40'
                        : isNow
                        ? 'bg-slate-900 border-cyan-500/40'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <span className={`text-[11px] font-mono font-bold ${isNow ? 'text-cyan-300' : 'text-white'}`}>
                      {isNow ? 'Adesso' : h.hourStr}
                    </span>
                    <span className={`text-[9px] font-mono leading-none ${nextDay ? 'text-slate-400' : 'text-transparent'}`}>
                      {nextDay ? 'domani' : '.'}
                    </span>
                    {renderWeatherIcon(cond.iconName, 'w-6 h-6')}
                    <span className={`text-sm font-mono tabular-nums font-bold ${getTemperatureColorClass(h.temperatureC)}`}>
                      {unit === 'F' ? `${toFahrenheit(h.temperatureC)}°` : `${h.temperatureC}°`}
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums flex items-center gap-0.5 ${
                        h.precipitationProbability > 0 ? 'text-teal-300 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      <Droplets className="w-2.5 h-2.5" />
                      {h.precipitationProbability}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dettaglio dell'ora toccata */}
            {hour && hourCond && (
              <div className="p-3 rounded-2xl border border-slate-800 bg-slate-900/70 flex items-center gap-3">
                {renderWeatherIcon(hourCond.iconName, 'w-8 h-8')}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {hourIdx === 0 ? 'Adesso' : hour.hourStr} · {hourCond.labelIt}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                    Pioggia {hour.precipitationProbability}% · Vento {hour.windSpeedKmH} km/h
                  </div>
                </div>
                <span className={`text-xl font-mono font-bold tabular-nums ${getTemperatureColorClass(hour.temperatureC)}`}>
                  {formatTemp(hour.temperatureC)}
                </span>
              </div>
            )}

            {next24.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-slate-500">Escursione 24 h</div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {formatTemp(Math.min(...next24.map((h) => h.temperatureC)))} → {formatTemp(Math.max(...next24.map((h) => h.temperatureC)))}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-slate-500">Più probabile pioggia</div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {rainPeak && rainPeak.precipitationProbability > 0
                      ? `${rainPeak.precipitationProbability}% alle ${rainPeak.hourStr}`
                      : 'Nessuna'}
                  </div>
                </div>
              </div>
            )}

            {/* Consiglio: due righe, si apre toccando */}
            <button
              type="button"
              onClick={() => setIsTipOpen((v) => !v)}
              aria-expanded={isTipOpen}
              className="w-full text-left p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5"
            >
              <Shirt className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white">Consiglio per oggi</div>
                <p className={`text-[11px] text-slate-300 leading-relaxed ${isTipOpen ? '' : 'line-clamp-2'}`}>
                  {current?.condition.activityTipIt ?? 'Caricamento dei consigli meteo…'}
                </p>
              </div>
              {isTipOpen ? (
                <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
            </button>
          </div>
        )}

        {/* 7 GIORNI: righe compatte, il giorno scelto si apre */}
        {mobileTab === 'days' && (
          <div className="space-y-1.5" role="tabpanel" aria-label="Previsioni a sette giorni">
            {weatherData?.daily.map((day, idx) => {
              const isSel = selectedDayIndex === idx;
              const left = ((day.tempMinC - weekMin) / weekSpan) * 100;
              const width = Math.max(8, ((day.tempMaxC - day.tempMinC) / weekSpan) * 100);
              return (
                <div
                  key={day.date}
                  className={`rounded-2xl border overflow-hidden transition-colors ${
                    isSel ? 'bg-slate-900 border-cyan-400/70' : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    aria-expanded={isSel}
                    className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left"
                  >
                    <div className="w-[68px] shrink-0">
                      <div className="text-xs font-bold text-white">{day.dayNameIt}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {day.dayNumber} {day.monthNameIt}
                      </div>
                    </div>
                    <div className="shrink-0 w-7 flex justify-center">{renderWeatherIcon(day.condition.iconName, 'w-6 h-6')}</div>
                    <div
                      className={`w-10 shrink-0 text-[11px] font-mono tabular-nums text-center ${
                        day.precipitationProbability > 0 ? 'text-teal-300 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      {day.precipitationProbability}%
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 font-mono tabular-nums text-xs">
                      <span className="w-9 text-right text-slate-400">{unit === 'F' ? `${toFahrenheit(day.tempMinC)}°` : `${day.tempMinC}°`}</span>
                      <div className="relative flex-1 h-1.5 rounded-full bg-slate-800">
                        <div
                          className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400"
                          style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                        />
                      </div>
                      <span className="w-9 font-bold text-white">{unit === 'F' ? `${toFahrenheit(day.tempMaxC)}°` : `${day.tempMaxC}°`}</span>
                    </div>
                  </button>

                  {isSel && (
                    <div className="px-3 pb-3 space-y-2 border-t border-slate-800/80 pt-2.5">
                      <div className="text-xs font-bold text-white">{day.condition.labelIt}</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{day.condition.descriptionIt}</p>
                      <div className="grid grid-cols-2 gap-1.5 font-mono tabular-nums text-[11px]">
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300">
                          Max {formatTemp(day.tempMaxC)} <span className="text-slate-500">(perc. {formatTemp(day.apparentTempMaxC)})</span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300">
                          Min {formatTemp(day.tempMinC)} <span className="text-slate-500">(perc. {formatTemp(day.apparentTempMinC)})</span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                          Pioggia {day.precipitationProbability}% · {day.precipitationMm} mm
                        </div>
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                          Vento {day.windSpeedMaxKmH} km/h · UV {day.uvIndexMax}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p>{day.condition.activityTipIt}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!weatherData && <div className="text-xs text-slate-500 py-6 text-center">{isLoading ? 'Caricamento…' : 'Nessun dato.'}</div>}
          </div>
        )}

        {/* CLIMA: profilo storico di marzo */}
        {mobileTab === 'climate' && (
          <div role="tabpanel" aria-label="Clima di marzo">
            {climateSection}
          </div>
        )}

        {footerSection}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Intestazione Sezione & Switcher Città */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
            <Compass className="w-3.5 h-3.5" />
            <span>Meteo Live & Clima Viaggio 2-19 Marzo</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight mt-1">
            Previsioni Meteo Seul & Clima Atteso
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Dati meteorologici in tempo reale da Open-Meteo API (modelli ad alta risoluzione WMO) per i prossimi 7 giorni e analisi climatica storica KMA per il periodo del viaggio.
          </p>
        </div>

        {/* Switcher Unità °C / °F e Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setUnit('C')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                unit === 'C' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setUnit('F')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                unit === 'F' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              °F
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadWeather(selectedLocation)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Aggiorna dati meteo da Open-Meteo"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selettore Tappe del Viaggio (Seul, Incheon, Suwon, Pechino) - Griglia reattiva senza tagli di testo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {WEATHER_LOCATIONS.map((loc) => {
          const isSelected = selectedLocation.id === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => {
                setSelectedLocation(loc);
                setSelectedDayIndex(0);
              }}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                isSelected
                  ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base select-none leading-none">{loc.flag}</span>
                  <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                    {loc.shortName}
                  </span>
                </div>
                {isSelected ? (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 animate-pulse shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0 group-hover:bg-slate-500" />
                )}
              </div>

              <div className="text-[11px] text-slate-400 truncate">
                {loc.tag}
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner Informativo sulla distanza temporale del viaggio */}
      <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-slate-300 leading-relaxed">
            <strong className="text-white">Nota sulle date:</strong> Il nostro viaggio a Seul è programmato dal{' '}
            <strong className="text-cyan-300">2 al 19 marzo 2027</strong>. Poiché le previsioni ad alta precisione sono affidabili fino a 7 giorni, qui visualizzi le <strong>previsioni reali aggiornate per i prossimi 7 giorni</strong>, affiancate dal <strong>profilo climatico storico e packing list per marzo</strong>.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('forecast')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'forecast' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Previsioni 7 Giorni
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('climate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'climate' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Clima 2-19 Marzo</span>
          </button>
        </div>
      </div>

      {/* Errore eventuale di rete */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadWeather(selectedLocation)}
            className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-medium"
          >
            Riprova
          </button>
        </div>
      )}

      {/* CONTENUTO TAB 1: PREVISIONI LIVE 7 GIORNI CON UI DINAMICA */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          {/* Card Meteo Principale con UI che cambia colore e atmosfera rispetto a condizione e temperatura */}
          <div
            className={`relative rounded-3xl border ${themeStyle.cardBorder} bg-gradient-to-br ${themeStyle.bgGradient} p-6 sm:p-8 shadow-2xl overflow-hidden backdrop-blur-md transition-all duration-300`}
            style={{
              boxShadow: `0 20px 50px -10px ${themeStyle.ambientGlow}`
            }}
          >
            {/* Elemento d'atmosfera decorativo nello sfondo */}
            <div
              className="absolute -right-8 -top-8 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-40 transition-all duration-500"
              style={{ backgroundColor: themeStyle.ambientGlow }}
            />
            {weatherData && (
              <WeatherScene
                code={weatherData.current.weatherCode}
                isDay={weatherData.current.isDay === 1}
                precipitationMm={weatherData.current.precipitationMm}
                windKmH={weatherData.current.windSpeedKmH}
              />
            )}

            <div className="relative z-10 space-y-6">
              {/* Riga superiore: Luogo, Tag e Timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-950/60 border border-slate-700/80 flex items-center justify-center text-lg">
                    {themeStyle.particleIcon}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>{selectedLocation.name}</span>
                      {selectedLocation.koreanName && (
                        <span className="text-xs font-normal text-slate-400">({selectedLocation.koreanName})</span>
                      )}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{selectedLocation.country}</span>
                      <span aria-hidden="true">·</span>
                      <span>Aggiornato alle {weatherData?.fetchedAt ?? '--:--'}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 shadow-sm ${themeStyle.accentBadge}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{weatherData?.current.condition.labelIt ?? 'Caricamento…'}</span>
                </div>
              </div>

              {/* Centro: Temperatura grande, Condizione e Consiglio di Viaggio */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-6 flex items-baseline gap-4">
                  <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold font-display tracking-tight text-white font-mono tabular-nums">
                    {weatherData ? formatTemp(weatherData.current.temperatureC) : '--'}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm sm:text-base font-bold text-slate-200">
                      {weatherData?.current.condition.labelIt}
                    </div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      Percepita:{' '}
                      <strong className={getTemperatureColorClass(weatherData?.current.apparentTemperatureC ?? 10)}>
                        {weatherData ? formatTemp(weatherData.current.apparentTemperatureC) : '--'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 backdrop-blur-md space-y-1.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shirt className="w-4 h-4 text-cyan-400" />
                    <span>Consiglio per i viaggiatori oggi:</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {weatherData?.current.condition.activityTipIt ??
                      'Caricamento dei consigli meteo personalizzati per la giornata…'}
                  </p>
                </div>
              </div>

              {/* Metriche Rapide (Vento, Umidità, Pioggia, Min/Max Oggi) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/60 font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center gap-1">
                    <Wind className="w-3 h-3 text-cyan-400" /> Vento
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {weatherData?.current.windSpeedKmH ?? '--'} km/h
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Umidità
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {weatherData?.current.relativeHumidity ?? '--'}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center gap-1">
                    <Umbrella className="w-3 h-3 text-cyan-400" /> Precipitazioni
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {weatherData?.current.precipitationMm ?? 0} mm
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-cyan-400" /> Min / Max Oggi
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {weatherData?.daily[0]
                      ? `${formatTemp(weatherData.daily[0].tempMinC)} / ${formatTemp(weatherData.daily[0].tempMaxC)}`
                      : '--'}
                  </div>
                </div>
              </div>
            </div>
          </div>



          {/* Griglia Interattiva Previsioni 7 Giorni */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Previsioni giornaliere per i prossimi 7 giorni</span>
              </h3>
              <span className="text-xs text-slate-500">Clicca su un giorno per vedere i dettagli</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {weatherData?.daily.map((day, idx) => {
                const isSelected = selectedDayIndex === idx;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                        : 'bg-slate-950/80 border-slate-800 hover:bg-slate-900/90 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white">{day.dayNameIt}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {day.dayNumber} {day.monthNameIt}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{day.condition.labelIt}</div>
                    </div>

                    <div className="my-1 flex items-center justify-center py-2">
                      {renderWeatherIcon(day.condition.iconName, 'w-8 h-8')}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono tabular-nums text-xs">
                      <span className="font-bold text-white">{formatTemp(day.tempMaxC)}</span>
                      <span className="text-slate-400">{formatTemp(day.tempMinC)}</span>
                    </div>

                    {day.precipitationProbability > 0 && (
                      <div className="text-[10px] font-mono text-teal-300 text-center font-semibold">
                        {day.precipitationProbability}% pioggia
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dettaglio del giorno selezionato */}
            {selectedDay && (
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {renderWeatherIcon(selectedDay.condition.iconName, 'w-7 h-7')}
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Dettaglio {selectedDay.dayNameIt} {selectedDay.dayNumber} {selectedDay.monthNameIt} ·{' '}
                        {selectedDay.condition.labelIt}
                      </h4>
                      <p className="text-xs text-slate-400">{selectedDay.condition.descriptionIt}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300">
                      Max: {formatTemp(selectedDay.tempMaxC)} (percepita {formatTemp(selectedDay.apparentTempMaxC)})
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300">
                      Min: {formatTemp(selectedDay.tempMinC)} (percepita {formatTemp(selectedDay.apparentTempMinC)})
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-300">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">Attività raccomandata con questo meteo:</strong>{' '}
                    {selectedDay.condition.activityTipIt}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 font-sans block">Probabilità Pioggia</span>
                    <span className="font-bold text-white">{selectedDay.precipitationProbability}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 font-sans block">Accumulo Previsto</span>
                    <span className="font-bold text-white">{selectedDay.precipitationMm} mm</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 font-sans block">Vento Massimo</span>
                    <span className="font-bold text-white">{selectedDay.windSpeedMaxKmH} km/h</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 font-sans block">Indice UV Max</span>
                    <span className="font-bold text-white">{selectedDay.uvIndexMax} / 11</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Previsioni Orarie: Lista verticale di righe orizzontali (da adesso in poi) */}
          {weatherData && weatherData.hourly.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-950/90 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Previsioni orarie nelle prossime 24 ore
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                      {selectedLocation.id === 'beijing'
                        ? '· Fuso Pechino (UTC+8)'
                        : '· Fuso Seul (UTC+9)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Elenco orario continuo da adesso in cima fino a 24 ore in avanti
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* Selettore intervallo: Ogni 1h (tutte le 24 ore) oppure Ogni 3h (condensato) */}
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setHourlyInterval('1h')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        hourlyInterval === '1h'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Ogni 1h (24h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHourlyInterval('3h')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        hourlyInterval === '3h'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Ogni 3h (8 fasce)
                    </button>
                  </div>

                  {/* Toggle Espandi/Comprimi */}
                  <button
                    type="button"
                    onClick={() => setIsHourlyExpanded(!isHourlyExpanded)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <span>{isHourlyExpanded ? 'Compatto' : 'Espandi tutto'}</span>
                    {isHourlyExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Intestazione Colonne (per schermi medi e grandi) */}
              <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-1.5 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                <div className="col-span-2">Orario</div>
                <div className="col-span-4">Condizione Meteo</div>
                <div className="col-span-2 text-center">Pioggia</div>
                <div className="col-span-2 text-center">Vento</div>
                <div className="col-span-2 text-right">Temperatura</div>
              </div>

              {/* Elenco righe orizzontali una sotto l'altra con scrollbar scura personalizzata */}
              <div
                className={`space-y-1.5 transition-all ${
                  isHourlyExpanded
                    ? ''
                    : 'max-h-[500px] overflow-y-auto pr-1.5 custom-weather-scrollbar'
                }`}
              >
                {displayedHourly.map((h, i) => {
                  const cond = getWmoCondition(h.weatherCode, h.isDay);
                  const isCurrentHour = i === 0;
                  const firstDate = displayedHourly[0]?.time.slice(0, 10);
                  const thisDate = h.time.slice(0, 10);
                  const isTomorrow = firstDate && thisDate && firstDate !== thisDate;

                  // Percentuale temperatura nella scala min/max 24h
                  const tempPercent = Math.max(
                    0,
                    Math.min(
                      100,
                      ((h.temperatureC - hourlyTempRange.min) /
                        Math.max(1, hourlyTempRange.max - hourlyTempRange.min)) *
                        100
                    )
                  );

                  return (
                    <div
                      key={h.time}
                      className={`p-2.5 sm:px-3 sm:py-2.5 rounded-xl border transition-all ${
                        isCurrentHour
                          ? 'bg-slate-800/90 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900/60 border-slate-800/70 hover:bg-slate-900 hover:border-slate-700/80'
                      }`}
                    >
                      {/* Layout a Griglia su Desktop / Flex su Mobile */}
                      <div className="grid grid-cols-12 items-center gap-2 sm:gap-3">
                        {/* Colonna Orario: 2 colonne */}
                        <div className="col-span-4 sm:col-span-2 flex items-center gap-2">
                          {isCurrentHour ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              Adesso
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs sm:text-sm text-white">
                                {h.hourStr}
                              </span>
                              {isTomorrow && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                  +1gg
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Colonna Condizione Meteo: 4 colonne */}
                        <div className="col-span-5 sm:col-span-4 flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <div className="shrink-0">
                            {renderWeatherIcon(cond.iconName, 'w-5 h-5')}
                          </div>
                          <span className="text-xs sm:text-sm text-slate-200 truncate">
                            {cond.labelIt}
                          </span>
                        </div>

                        {/* Colonna Pioggia: 2 colonne */}
                        <div className="hidden sm:flex col-span-2 items-center justify-center">
                          {h.precipitationProbability > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-950/80 text-teal-300 border border-teal-500/30 text-[11px] font-mono font-semibold">
                              <Droplets className="w-3 h-3 text-teal-400 shrink-0" />
                              {h.precipitationProbability}%
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono text-xs">—</span>
                          )}
                        </div>

                        {/* Colonna Vento: 2 colonne */}
                        <div className="hidden sm:flex col-span-2 items-center justify-center gap-1 text-slate-400 font-mono text-xs">
                          <Wind className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{h.windSpeedKmH} km/h</span>
                        </div>

                        {/* Colonna Temperatura: 3 col su mobile, 2 col su desktop */}
                        <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2 text-right">
                          {/* Mini barra termica relativa su schermi medi */}
                          <div className="hidden md:block w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden relative shrink-0">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400"
                              style={{
                                marginLeft: `${tempPercent * 0.7}%`,
                                width: '10px'
                              }}
                            />
                          </div>

                          <span
                            className={`font-mono tabular-nums text-xs sm:text-sm font-bold ${getTemperatureColorClass(
                              h.temperatureC
                            )}`}
                          >
                            {formatTemp(h.temperatureC)}
                          </span>
                        </div>
                      </div>

                      {/* Riga secondaria su mobile per mostrare pioggia e vento */}
                      <div className="flex sm:hidden items-center justify-between text-[11px] font-mono text-slate-400 pt-1.5 mt-1.5 border-t border-slate-800/50">
                        <div className="flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-cyan-400" />
                          {h.precipitationProbability > 0 ? (
                            <span className="text-teal-300 font-semibold">{h.precipitationProbability}% pioggia</span>
                          ) : (
                            <span>0% pioggia</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Wind className="w-3 h-3 text-slate-500" />
                          <span>{h.windSpeedKmH} km/h</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Barra inferiore con pulsante rapido per espandere o ridurre la vista */}
              <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
                <span className="text-[11px]">
                  Visualizzando {displayedHourly.length} rilevamenti orari continui
                </span>

                <button
                  type="button"
                  onClick={() => setIsHourlyExpanded(!isHourlyExpanded)}
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  <span>
                    {isHourlyExpanded ? 'Riduci a finestra scorrevole' : 'Mostra tutte le 24 ore'}
                  </span>
                  {isHourlyExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTENUTO TAB 2: CLIMA STORICO E ATTESO PER IL VIAGGIO (2 - 19 MARZO) */}
      {activeTab === 'climate' && climateSection}

      {footerSection}
    </div>
  );
};
