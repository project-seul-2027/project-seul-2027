import React, { useMemo, useState } from 'react';
import {
  TrainFront,
  Clock,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Crosshair
} from 'lucide-react';
import {
  lineLengthKm,
  lineStationKeys,
  type MetroLine,
  type MetroNetwork
} from '../../data/seoulMetro';
import {
  OFFICIAL_METRO_LINE_DATA,
  OFFICIAL_SEOUL_METRO_FARES,
  OFFICIAL_CAR_AND_EXIT_RULES,
  OFFICIAL_METRO_SOURCES
} from '../../data/seoulMetroOfficialData';
import { LineBadge } from './MetroPanel';

interface RealMetroDataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  network: MetroNetwork | null;
  onSelectLineOnMap?: (lineId: string) => void;
}

type DrawerSection = 'operators' | 'timetables' | 'fares' | 'cars_exits';

export const RealMetroDataDrawer: React.FC<RealMetroDataDrawerProps> = ({
  isOpen,
  onClose,
  network,
  onSelectLineOnMap
}) => {
  const [activeSection, setActiveSection] = useState<DrawerSection>('operators');
  const [lineFilter, setLineFilter] = useState('');
  const [expandedLineId, setExpandedLineId] = useState<string | null>('2');

  const linesWithStats = useMemo(() => {
    if (!network) return [];
    return network.lines.map((line) => {
      const stationCount = lineStationKeys(line).length;
      const km = lineLengthKm(line);
      const official = OFFICIAL_METRO_LINE_DATA[line.id];
      return {
        line,
        stationCount,
        km,
        official
      };
    });
  }, [network]);

  const filteredLines = useMemo(() => {
    if (!lineFilter.trim()) return linesWithStats;
    const q = lineFilter.toLowerCase();
    return linesWithStats.filter(
      ({ line, official }) =>
        line.it.toLowerCase().includes(q) ||
        line.en.toLowerCase().includes(q) ||
        line.ko.toLowerCase().includes(q) ||
        official?.operatorEn.toLowerCase().includes(q) ||
        official?.operatorIt.toLowerCase().includes(q) ||
        official?.terminalsEn.toLowerCase().includes(q) ||
        official?.keyHubExitsIt.toLowerCase().includes(q)
    );
  }, [linesWithStats, lineFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="rounded-2xl border border-slate-700/90 bg-slate-900/98 shadow-2xl overflow-hidden transition-all"
      role="region"
      aria-label="Menu Dati Ufficiali Metropolitana di Seul"
    >
      {/* Intestazione Menu a Tendina Sinistro */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <TrainFront className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">
              Dati Reali Ufficiali · Rete Metropolitana di Seul (수도권 전철)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Enti gestori, capolinea, orari prima/ultima corsa, frequenze, tariffe T-money/Climate Card, vagoni e uscite verificati da Seoul Metro, KORAIL, AREX e TOPIS.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="#fonti-ufficiali-metro"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-cyan-300 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Fonti a fondo pagina</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            aria-label="Chiudi menu dati reali metro"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra di navigazione tra le 4 sezioni richieste */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSection('operators')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSection === 'operators'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrainFront className="w-3.5 h-3.5" />
            <span>1. Enti Gestori, Capolinea & Stazioni ({linesWithStats.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('timetables')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSection === 'timetables'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>2. Orari Prima/Ultima Corsa & Frequenze</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('fares')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSection === 'fares'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>3. Tariffe T-money, Climate Card & Supplementi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('cars_exits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeSection === 'cars_exits'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span>4. Stato Servizio, Vagoni & Uscite Principali</span>
          </button>
        </div>

        {(activeSection === 'operators' || activeSection === 'timetables' || activeSection === 'cars_exits') && (
          <div className="relative min-w-[230px] flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              placeholder="Filtra linea, gestore, uscita (es. Linea 2, AREX, Hongdae)…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      {/* CONTENUTO SEZIONI */}
      <div className="p-4 max-h-[520px] overflow-y-auto space-y-4">
        {/* SEZIONE 1: ENTI GESTORI, CAPOLINEA E STAZIONI */}
        {activeSection === 'operators' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between gap-2">
              <span>
                Elenco completo delle <strong>{filteredLines.length} linee ferroviarie e metropolitane</strong> dell&apos;area di Seul con conteggio stazioni reale dal grafo OpenStreetMap e gestore istituzionale.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredLines.map(({ line, stationCount, km, official }) => {
                const isExp = expandedLineId === line.id;
                return (
                  <div
                    key={line.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden"
                  >
                    <div
                      className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-900/80 transition-colors"
                      onClick={() => setExpandedLineId(isExp ? null : line.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <LineBadge line={line} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {line.it} <span className="font-normal text-slate-400">({line.ko})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {official?.operatorIt ?? line.en}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-xs font-bold text-cyan-400">{stationCount} staz.</div>
                          <div className="text-[10px] text-slate-500">{km.toFixed(1)} km</div>
                        </div>
                        {isExp ? (
                          <ChevronUp className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {isExp && official && (
                      <div className="px-3 pb-3 pt-2 border-t border-slate-800/80 text-xs space-y-2 bg-slate-900/40">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Ente Gestore Ufficiale</span>
                            <span className="font-semibold text-slate-200">{official.operatorEn}</span>
                            <span className="block text-[11px] text-slate-400">{official.operatorKo}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Capolinea Ufficiali</span>
                            <span className="font-semibold text-slate-200">{official.terminalsEn}</span>
                            <span className="block text-[11px] text-slate-400">{official.terminalsKo}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60">
                          <span className="text-[11px] text-slate-300 font-mono tabular-nums">
                            Convogli: {official.carsPerTrain}
                          </span>
                          <div className="flex items-center gap-2">
                            {onSelectLineOnMap && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectLineOnMap(line.id);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <Crosshair className="w-3 h-3" />
                                <span>Mostra sulla mappa</span>
                              </button>
                            )}
                            <a
                              href={official.operatorUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] inline-flex items-center gap-1"
                            >
                              <span>Sito Gestore</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEZIONE 2: ORARI PRIMA/ULTIMA CORSA E FREQUENZE REALI */}
        {activeSection === 'timetables' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-white">
                Regola Generale Orari Servizio Metropolitano di Seul (Seoul Metro / KORAIL / AREX)
              </div>
              <p className="text-slate-400 leading-relaxed">
                I primi treni partono dai capolinea alle <strong>05:20 – 05:30</strong> ogni mattina. L&apos;ultima corsa termina tra le <strong>24:00 e le 00:55 nei giorni feriali</strong> (lun–ven) e intorno alle <strong>23:50 – 24:00 nel weekend e nei festivi</strong>. Attenzione: i treni che partono dopo le 23:45 spesso terminano la corsa in stazioni intermedie di deposito (es. Seongsu, Euljiro 1-ga, Sadang o Guro).
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Linea</th>
                    <th className="py-2.5 px-3 font-semibold">Prima Corsa</th>
                    <th className="py-2.5 px-3 font-semibold">Ultima (Feriali)</th>
                    <th className="py-2.5 px-3 font-semibold">Ultima (Festivi)</th>
                    <th className="py-2.5 px-3 font-semibold">Freq. Punta (07–09 / 18–20)</th>
                    <th className="py-2.5 px-3 font-semibold">Freq. Morbida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {filteredLines.map(({ line, official }) => {
                    if (!official) return null;
                    return (
                      <tr key={line.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-2 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            <LineBadge line={line} size="sm" />
                            <div>
                              <span className="font-semibold text-white block">{line.it}</span>
                              <span className="text-[10px] text-slate-500">{line.ko}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-emerald-400">{official.firstTrainWeekday}</td>
                        <td className="py-2 px-3 text-slate-200">{official.lastTrainWeekday}</td>
                        <td className="py-2 px-3 text-amber-300">{official.lastTrainWeekend}</td>
                        <td className="py-2 px-3 text-cyan-300 font-semibold">{official.peakHeadwayMin}</td>
                        <td className="py-2 px-3 text-slate-400">{official.offPeakHeadwayMin}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEZIONE 3: TARIFFE UFFICIALI T-MONEY, CLIMATE CARD & SOVRAPPREZZI */}
        {activeSection === 'fares' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OFFICIAL_SEOUL_METRO_FARES.map((tier) => (
                <div
                  key={tier.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-white">{tier.categoryIt}</span>
                      <span className="text-xs font-bold text-cyan-400 font-mono tabular-nums shrink-0">
                        {tier.priceKrw}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{tier.methodIt}</span>
                      <span className="font-mono tabular-nums text-slate-500">{tier.approxEur}</span>
                    </div>
                    <p className="text-xs text-slate-300 pt-1 leading-relaxed">{tier.validityRuleIt}</p>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/70 flex items-center justify-between">
                    <span>Fonte tariffaria: {tier.sourceOrg}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Riepilogo Copertura Climate Card e Supplementi per ciascuna linea */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2.5">
              <div className="text-xs font-bold text-white">
                Compatibilità Climate Card (기후동행카드) e Supplementi per Linea
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {linesWithStats.map(({ line, official }) => {
                  if (!official) return null;
                  const statusLabel =
                    official.climateCardEligible === 'full'
                      ? 'Climate Card: 100% Inclusa'
                      : official.climateCardEligible === 'partial'
                      ? 'Climate Card: Tratta Seul'
                      : 'Solo T-money (Esclusa)';
                  const statusColor =
                    official.climateCardEligible === 'full'
                      ? 'text-emerald-400'
                      : official.climateCardEligible === 'partial'
                      ? 'text-cyan-400'
                      : 'text-amber-400';

                  return (
                    <div
                      key={line.id}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <LineBadge line={line} size="sm" />
                          <span className="font-semibold text-white truncate">{line.it}</span>
                        </div>
                        <span className={`text-[10px] font-semibold shrink-0 ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{official.climateCardNoteIt}</p>
                      <div className="text-[10px] font-mono tabular-nums text-slate-300 pt-0.5">
                        {official.surchargeIt}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SEZIONE 4: STATO SERVIZIO, VAGONI (FAST TRANSFER) E USCITE PRINCIPALI */}
        {activeSection === 'cars_exits' && (
          <div className="space-y-4">
            {/* 4 Regole d'oro su Vagoni, Fast Transfer e Uscite */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OFFICIAL_CAR_AND_EXIT_RULES.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{rule.titleIt}</span>
                    <span className="text-[10px] font-mono tabular-nums text-cyan-400 shrink-0">
                      {rule.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{rule.detailIt}</p>
                </div>
              ))}
            </div>

            {/* Tabella Uscite Principali e Composizione Vagoni per Linea */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="p-3 border-b border-slate-800 bg-slate-900/80 text-xs font-bold text-white">
                Stato Servizio, Numero Vagoni e Uscite Strategiche (출구) per il Viaggio
              </div>
              <div className="divide-y divide-slate-800/70">
                {filteredLines.map(({ line, official }) => {
                  if (!official) return null;
                  return (
                    <div key={line.id} className="p-3 text-xs space-y-1 hover:bg-slate-900/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <LineBadge line={line} size="sm" />
                          <span className="font-bold text-white">{line.it}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-emerald-400 font-medium">{official.serviceStatusIt}</span>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400">
                          Composizione: {official.carsPerTrain}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 pl-6">
                        <strong className="text-cyan-300">Snodi e Uscite chiave:</strong> {official.keyHubExitsIt}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Piè di pannello con link diretti alle fonti istituzionali */}
      <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          Fonti ufficiali verificate:{' '}
          {OFFICIAL_METRO_SOURCES.slice(0, 5).map((src, i) => (
            <React.Fragment key={src.id}>
              {i > 0 && ' · '}
              <a
                href={src.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-cyan-300 underline"
              >
                {src.organizationEn}
              </a>
            </React.Fragment>
          ))}
        </span>
        <a
          href="#fonti-ufficiali-metro"
          onClick={onClose}
          className="text-cyan-400 hover:underline font-semibold"
        >
          Vedi bibliografia completa a fondo pagina ↓
        </a>
      </div>
    </div>
  );
};
