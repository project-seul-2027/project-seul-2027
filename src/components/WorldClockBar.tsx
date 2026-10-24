import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Sun, Moon, Globe, Info, PhoneCall, Plane, X, Sparkles } from 'lucide-react';

interface CityClock {
  id: 'rome' | 'seoul' | 'beijing';
  name: string;
  country: string;
  flag: string;
  timeZone: string;
  code: string;
  offsetLabel: string;
  role: string;
}

const CITIES: CityClock[] = [
  {
    id: 'rome',
    name: 'Italia',
    country: 'Roma',
    flag: '🇮🇹',
    timeZone: 'Europe/Rome',
    code: 'CET/CEST',
    offsetLabel: 'Base Italia',
    role: 'Casa & Contatti'
  },
  {
    id: 'seoul',
    name: 'Seul',
    country: 'Corea del Sud',
    flag: '🇰🇷',
    timeZone: 'Asia/Seoul',
    code: 'KST (UTC+9)',
    offsetLabel: '+8h risp. a Roma',
    role: 'Destinazione Viaggio'
  },
  {
    id: 'beijing',
    name: 'Pechino',
    country: 'Cina',
    flag: '🇨🇳',
    timeZone: 'Asia/Shanghai',
    code: 'CST (UTC+8)',
    offsetLabel: '+7h risp. a Roma',
    role: 'Scalo 240h · 19 Mar'
  }
];

export const WorldClockBar: React.FC = () => {
  const [now, setNow] = useState<Date>(new Date());
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Aggiornamento ogni secondo per orologio in tempo reale
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isDetailsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDetailsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailsOpen]);

  // Formatta l'orario e la data per un fuso orario specifico
  const getCityTime = (timeZone: string) => {
    try {
      const timeStr = new Intl.DateTimeFormat('it-IT', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now);

      const dayStr = new Intl.DateTimeFormat('it-IT', {
        timeZone,
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }).format(now);

      const fullDateStr = new Intl.DateTimeFormat('it-IT', {
        timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(now);

      const hourInt = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          hour: 'numeric',
          hour12: false
        }).format(now),
        10
      );

      // Giorno tra 06:00 e 18:59, Notte altrimenti
      const isDay = hourInt >= 6 && hourInt < 19;

      return { timeStr, dayStr, fullDateStr, hourInt, isDay };
    } catch {
      return {
        timeStr: '--:--:--',
        dayStr: '',
        fullDateStr: '',
        hourInt: 12,
        isDay: true
      };
    }
  };

  const romeData = getCityTime('Europe/Rome');
  const seoulData = getCityTime('Asia/Seoul');
  const beijingData = getCityTime('Asia/Shanghai');

  // Verifica se la data a Seul o Pechino è già il giorno successivo rispetto all'Italia
  const isSeoulNextDay = seoulData.dayStr !== romeData.dayStr;
  const isBeijingNextDay = beijingData.dayStr !== romeData.dayStr;

  return (
    <>
      {/* Barra Orologio Globale - Sticky e visibile su ogni pagina */}
      <section
        aria-label="Orologio mondiale in tempo reale: Italia, Seul e Pechino"
        className="w-full bg-[#080d1a]/95 border-b border-cyan-950/60 backdrop-blur-md px-3 sm:px-6 py-2 transition-all relative z-40"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          {/* Label Sinistra / Badge Live */}
          <div className="flex items-center justify-between md:justify-start gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
                Fusi Orari Live
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="inline-flex md:hidden items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
            >
              <Info className="w-3 h-3" />
              <span>Dettagli fusi</span>
            </button>
          </div>

          {/* Griglia / Ticker dei 3 orologi: Italia, Seul, Pechino */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 flex-1 md:max-w-3xl md:mx-4">
            {/* 1. ITALIA */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm select-none shrink-0">🇮🇹</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="hidden min-[460px]:inline font-bold text-white text-[11px] sm:text-xs truncate">
                      Italia
                    </span>
                    {romeData.isDay ? (
                      <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <Moon className="w-3 h-3 text-indigo-300 shrink-0" />
                    )}
                  </div>
                  <span className="hidden sm:block text-[10px] text-slate-400 font-mono truncate">
                    {romeData.dayStr}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono tabular-nums font-bold text-xs sm:text-sm text-emerald-300">
                  {romeData.timeStr}
                </span>
                <span className="hidden sm:block text-[9px] font-mono text-slate-400">
                  CET
                </span>
              </div>
            </div>

            {/* 2. SEUL */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 hover:border-cyan-400 transition-colors shadow-sm shadow-cyan-500/10">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm select-none shrink-0">🇰🇷</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="hidden min-[460px]:inline font-bold text-cyan-300 text-[11px] sm:text-xs truncate">
                      Seul
                    </span>
                    {seoulData.isDay ? (
                      <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <Moon className="w-3 h-3 text-indigo-300 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="hidden sm:block text-[10px] text-slate-400 font-mono truncate">
                      {seoulData.dayStr}
                    </span>
                    {isSeoulNextDay && (
                      <span className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-500/30">
                        +1gg
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono tabular-nums font-bold text-xs sm:text-sm text-cyan-300">
                  {seoulData.timeStr}
                </span>
                <span className="hidden sm:block text-[9px] font-mono text-cyan-400/80">
                  +8h (KST)
                </span>
              </div>
            </div>

            {/* 3. PECHINO */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm select-none shrink-0">🇨🇳</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="hidden min-[460px]:inline font-bold text-white text-[11px] sm:text-xs truncate">
                      Pechino
                    </span>
                    {beijingData.isDay ? (
                      <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <Moon className="w-3 h-3 text-indigo-300 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="hidden sm:block text-[10px] text-slate-400 font-mono truncate">
                      {beijingData.dayStr}
                    </span>
                    {isBeijingNextDay && (
                      <span className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-amber-900/60 text-amber-200 border border-amber-500/30">
                        +1gg
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono tabular-nums font-bold text-xs sm:text-sm text-amber-300">
                  {beijingData.timeStr}
                </span>
                <span className="hidden sm:block text-[9px] font-mono text-slate-400">
                  +7h (CST)
                </span>
              </div>
            </div>
          </div>

          {/* Pulsante info / guida fusi su desktop */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-colors text-xs font-mono"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Consigli fusi & chiamate</span>
            </button>
          </div>
        </div>
      </section>

      {/* Modal / Scheda di dettaglio fusi orari per i viaggiatori - Portaled to document.body */}
      {isDetailsOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsDetailsOpen(false)}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-200 my-auto max-h-[92vh] overflow-y-auto"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Guida ai Fusi Orari · Italia, Seul & Pechino
                  </h3>
                  <p className="text-xs text-slate-400">
                    Riferimento rapido per chiamate, jet lag e spostamenti
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dettagli Orologi in Tempo Reale */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CITIES.map((city) => {
                const info = getCityTime(city.timeZone);
                return (
                  <div
                    key={city.id}
                    className={`p-3.5 rounded-2xl border text-center space-y-1.5 ${
                      city.id === 'seoul'
                        ? 'bg-cyan-950/30 border-cyan-500/50'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg">{city.flag}</span>
                      <span className="font-bold text-sm text-white">{city.name}</span>
                    </div>

                    <div className="font-mono tabular-nums text-lg font-extrabold text-cyan-300">
                      {info.timeStr}
                    </div>

                    <div className="text-[11px] font-mono text-slate-400">
                      {info.dayStr}
                    </div>

                    <div className="text-[10px] font-mono text-cyan-400 pt-1 border-t border-slate-800/80">
                      {city.offsetLabel}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consigli Pratici per il Viaggio */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-white block">
                    Fascia ideale per videochiamare casa in Italia:
                  </strong>
                  <p className="text-slate-300 leading-relaxed">
                    Dalle <strong>15:00 alle 23:00 ora di Seul</strong> (corrispondenti alle <strong>07:00 - 15:00 ora italiana</strong>). Evita di chiamare la mattina presto da Seul poiché in Italia è piena notte!
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <Plane className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-white block">
                    Differenza Seul ↔ Pechino (Scalo 240h):
                  </strong>
                  <p className="text-slate-300 leading-relaxed">
                    Pechino è soltanto <strong>1 ora indietro rispetto a Seul</strong>. Quando atterrerai a Pechino per lo scalo del 19 marzo dovrai portare l'orologio indietro di 1 ora.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-white block">
                    Adattamento Jet Lag (8 ore avanti):
                  </strong>
                  <p className="text-slate-300 leading-relaxed">
                    Durante il primo giorno a Seul (2 marzo), esponiti alla luce naturale e cerca di rimanere sveglio fino alle 22:00 ora locale per agganciare subito il ritmo circadiano coreano.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
