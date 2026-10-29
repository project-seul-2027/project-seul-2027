import React, { useEffect, useState } from 'react';
import { ITINERARY_DAYS, ItineraryDay, MAP_LOCATIONS } from '../data/tripData';
import { 
  Calendar, Clock, MapPin, Tag, ChevronDown, ChevronUp, 
  Sparkles, AlertCircle, Banknote, Search, ExternalLink, ArrowRight
} from 'lucide-react';

interface ItineraryViewProps {
  onViewOnMap: (locationId: string, dayNumber?: number) => void;
  /** Giorno da aprire e raggiungere con lo scroll (il nonce permette di richiedere lo stesso giorno più volte) */
  focusDay?: { id: number; nonce: number } | null;
  onFocusHandled?: () => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ onViewOnMap, focusDay, onFocusHandled }) => {
  const [activePhase, setActivePhase] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDayId, setExpandedDayId] = useState<number | null>(1); // Day 1 expanded by default

  // Arrivo da un altro tab (es. galleria): apre il giorno richiesto e ci scorre fino
  useEffect(() => {
    if (!focusDay) return;
    setActivePhase('all');
    setSearchQuery('');
    setExpandedDayId(focusDay.id);
    const timer = setTimeout(() => {
      document.getElementById(`itinerary-day-${focusDay.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onFocusHandled?.();
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay?.nonce]);

  const phases = [
    { id: 'all', label: 'Tutti i giorni' },
    { id: 'Partenza', label: 'Partenza (1 Mar)' },
    { id: 'Prima settimana', label: 'Settimana 1 (2 - 9 Mar)' },
    { id: 'Seconda settimana', label: 'Settimana 2 (10 - 15 Mar)' },
    { id: 'Ultima parte', label: 'Ultima parte (16 - 20 Mar)' }
  ];

  const filteredDays = ITINERARY_DAYS.filter((day) => {
    if (activePhase !== 'all' && day.phase !== activePhase) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchesTitle = day.title.toLowerCase().includes(q);
      const matchesSub = day.subtitle.toLowerCase().includes(q);
      const matchesDesc = day.description.toLowerCase().includes(q);
      const matchesBullets = day.bulletPoints.some((b) => b.toLowerCase().includes(q));
      const matchesTags = day.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchesTitle && !matchesSub && !matchesDesc && !matchesBullets && !matchesTags) return false;
    }
    return true;
  });

  const toggleExpand = (id: number) => {
    setExpandedDayId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Search bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-xl flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Phase selector tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setActivePhase(phase.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activePhase === phase.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {phase.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cerca attività, pocha, DMZ, orari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-4">
        {filteredDays.map((day) => {
          const isExpanded = expandedDayId === day.id;
          const isSpecial = day.isSpecialEvent;
          const isBeijing = day.id === 18;

          return (
            <div
              key={day.id}
              id={`itinerary-day-${day.id}`}
              className={`scroll-mt-48 rounded-2xl border transition-all duration-200 overflow-hidden ${
                isSpecial
                  ? 'border-red-500/40 bg-gradient-to-r from-red-950/20 via-slate-900/90 to-slate-900/90 shadow-xl shadow-red-500/5'
                  : isBeijing
                  ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-slate-900/90 to-slate-900/90 shadow-xl shadow-amber-500/5'
                  : isExpanded
                  ? 'border-slate-700 bg-slate-900/90 shadow-lg'
                  : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              {/* Header / Summary Row */}
              <div
                onClick={() => toggleExpand(day.id)}
                className="p-4 sm:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  {/* Day Date Badge */}
                  <div className={`shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center border text-center transition-transform ${
                    isSpecial
                      ? 'bg-red-500/10 border-red-500/50 text-red-400'
                      : isBeijing
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                      : 'bg-slate-800/80 border-slate-700 text-cyan-400'
                  }`}>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                      {day.dateStr.split(' ')[1].slice(0, 3)}
                    </span>
                    <span className="text-xl font-bold font-mono leading-none">
                      {day.dateStr.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {day.dayOfWeek.slice(0, 3)}
                    </span>
                  </div>

                  {/* Title & Highlights */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                        {day.phase}
                      </span>
                      {isSpecial && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          VALORANT MASTERS (3 MAR) · ARENA TBD
                        </span>
                      )}
                      {day.id === 8 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          👋 SERATA DI SALUTI (PIETRO RIPARTE IL 10)
                        </span>
                      )}
                      {day.id === 9 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ✈️ RIENTRO DI PIETRO A MILANO (VOLO 11:10)
                        </span>
                      )}
                      {day.id === 13 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40">
                          🌸 WHITE DAY COREANO
                        </span>
                      )}
                      {day.id === 17 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          🛂 ARRIVAL CARD & TIANANMEN ONLINE
                        </span>
                      )}
                      {isBeijing && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          🇨🇳 SCALO PECHINO 240H (19 MAR)
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {day.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 line-clamp-1">
                      {day.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right Metadata & Expand Trigger */}
                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                  {day.costsEstimate && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-mono">
                      <Banknote className="w-3.5 h-3.5" />
                      <span>{day.costsEstimate}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {isExpanded ? 'Comprimi' : 'Dettagli'}
                    </span>
                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Detailed Content */}
              {isExpanded && (
                <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-800/80 space-y-5 animate-in fade-in duration-200">
                  {/* Arena TBD Alert Box for Valorant */}
                  {isSpecial && (
                    <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold text-white mb-0.5">
                          ⚠️ Sede e orari: non ancora pubblicati (in attesa di annuncio ufficiale Riot Games)
                        </strong>
                        <span className="leading-relaxed">
                          Sede, orari della finale e biglietti del Valorant Masters Seoul non sono ancora stati annunciati. La posizione sulla mappa è indicativa: il giorno resta riservato e il piano va aggiornato appena escono le informazioni.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Narrative Description */}
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
                    {day.description}
                  </p>

                  {/* Schedule Timetable if available */}
                  {day.schedule && day.schedule.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Tabella di marcia oraria
                      </h4>
                      <div className="relative border-l-2 border-slate-800 ml-3 pl-4 space-y-3.5 py-1">
                        {day.schedule.map((item, idx) => (
                          <div key={idx} className="relative group">
                            {/* Dot on timeline */}
                            <div className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 ${
                              item.isHighlight
                                ? 'bg-cyan-500 border-slate-950 ring-4 ring-cyan-500/20'
                                : 'bg-slate-700 border-slate-950'
                            }`} />
                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                              <span className="font-mono text-xs font-semibold text-cyan-300 shrink-0 sm:w-28">
                                {item.time}
                              </span>
                              <div className="text-xs sm:text-sm text-slate-200">
                                <span>{item.activity}</span>
                                {item.notes && (
                                  <span className="block text-xs text-slate-400 mt-0.5">
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bullet Points from PDF */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Punti chiave & Attività
                    </h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {day.bulletPoints.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-slate-300 flex items-start gap-2 bg-slate-800/30 p-2.5 rounded-lg border border-slate-800/40"
                        >
                          <span className="text-cyan-400 font-bold shrink-0">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Practical Tips */}
                  {day.tips && day.tips.length > 0 && (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Consigli pratici & Note importanti</span>
                      </div>
                      <div className="space-y-1 text-xs text-amber-200/90 pl-5">
                        {day.tips.map((tip, idx) => (
                          <p key={idx}>• {tip}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Locations associated & Action Button */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Tappe del giorno:
                      </span>
                      {day.locationIds.map((locId) => {
                        const loc = MAP_LOCATIONS.find((l) => l.id === locId);
                        if (!loc) return null;
                        return (
                          <button
                            key={locId}
                            onClick={() => onViewOnMap(locId, day.id)}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1"
                          >
                            <span>{loc.name}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => onViewOnMap(day.locationIds[0] || 'hongdae_base', day.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-medium flex items-center gap-1.5 transition-all self-end"
                    >
                      <span>Vedi giorno sulla mappa</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredDays.length === 0 && (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
            <p className="text-slate-400 text-sm">Nessuna giornata corrisponde alla ricerca "{searchQuery}".</p>
            <button
              onClick={() => { setSearchQuery(''); setActivePhase('all'); }}
              className="text-xs text-cyan-400 hover:underline"
            >
              Reimposta filtri
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
