import React, { useMemo, useState } from 'react';
import {
  Footprints,
  TrainFront,
  ArrowRight,
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  Crosshair,
  AlertTriangle,
  Search,
  Home,
  MapPin,
  ExternalLink,
  Loader2,
  RotateCcw,
  LocateFixed,
  LocateOff,
  Compass,
  Play
} from 'lucide-react';
import { type LatLng, type MetroNetwork } from '../../data/seoulMetro';
import { type MapLocation, getNaverMapSearchUrl } from '../../data/tripData';
import {
  AREX_LINE_ID,
  computeMetroRoute,
  compareAccommodationsForDestination,
  findNearbyMetroStations,
  type MetroRouteResult
} from '../../data/metroRouter';
import {
  SEOUL_GPS_SIMULATION_PRESETS,
  type SeoulSimulationPreset
} from '../../data/seoulMetroOfficialData';
import { LineBadge } from './MetroPanel';
import { originLabel } from './categoryStyle';

export interface LiveGeoState {
  enabled: boolean;
  status: 'idle' | 'requesting' | 'active' | 'denied' | 'error';
  coords: LatLng | null;
  accuracyMeters: number | null;
  lastUpdated: number | null;
  errorMessage: string | null;
  isSimulated: boolean;
  simulatedPreset: SeoulSimulationPreset | null;
}

interface MetroRoutePanelProps {
  network: MetroNetwork | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  accommodations: MapLocation[];
  destinations: MapLocation[];
  activeOriginLocation: MapLocation;
  selectedOriginId: string;
  onSelectOrigin: (id: string) => void;
  selectedDestinationId: string;
  onSelectDestination: (id: string) => void;
  currentRoute: MetroRouteResult | null;
  onFitRoute: () => void;
  onReplayAnimation?: () => void;
  onFocusPoint: (latLng: LatLng, zoom?: number, stationKey?: string, lineId?: string) => void;
  geoState: LiveGeoState;
  onActivateRealGps: () => void;
  onStopGps: () => void;
  onActivateSimulatedGps: (preset: SeoulSimulationPreset) => void;
  /** Versione per telefono: partenza e arrivo si scelgono nella barra in alto, qui restano percorso e GPS */
  compact?: boolean;
  /** Percorsi senza AREX (solo le altre linee e a piedi) */
  avoidArex?: boolean;
  onToggleAvoidArex?: () => void;
}

export const MetroRoutePanel: React.FC<MetroRoutePanelProps> = ({
  network,
  loading,
  error,
  onRetry,
  accommodations,
  destinations,
  activeOriginLocation,
  selectedOriginId,
  onSelectOrigin,
  selectedDestinationId,
  onSelectDestination,
  currentRoute,
  onFitRoute,
  onReplayAnimation,
  onFocusPoint,
  geoState,
  onActivateRealGps,
  onStopGps,
  onActivateSimulatedGps,
  compact = false,
  avoidArex = false,
  onToggleAvoidArex
}) => {
  const routeOptions = useMemo(() => (avoidArex ? { excludeLineIds: [AREX_LINE_ID] } : {}), [avoidArex]);
  const [destQuery, setDestQuery] = useState('');
  const [destCategory, setDestCategory] = useState<string>('all');
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showSimPresets, setShowSimPresets] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});

  const isGpsSelected = selectedOriginId === 'gps_origin';

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.id === selectedDestinationId) ?? destinations[0],
    [destinations, selectedDestinationId]
  );

  // Stazioni metro più vicine alla posizione GPS attuale (entro 2,4 km)
  const nearbyGpsStations = useMemo(() => {
    if (!network || !geoState.coords) return [];
    return findNearbyMetroStations(network, geoState.coords, 2400, 3);
  }, [network, geoState.coords]);

  // Calcola in anticipo l'accessibilità metro di ciascuna destinazione (inclusi gli alloggi) rispetto all'origine attiva
  const reachabilityByDestId = useMemo(() => {
    const map = new Map<string, { reachable: boolean; mins: number; transfers: number }>();
    if (!network || !activeOriginLocation) return map;
    for (const dest of destinations) {
      const res = computeMetroRoute(network, activeOriginLocation, dest, routeOptions);
      map.set(dest.id, {
        reachable: res.reachable,
        mins: res.estimatedTotalMinutes,
        transfers: res.totalTransfers
      });
    }
    return map;
  }, [network, activeOriginLocation, destinations, routeOptions]);

  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      if (destCategory !== 'all' && d.category !== destCategory) return false;
      if (destQuery.trim() !== '') {
        const q = destQuery.toLowerCase();
        const matchName =
          d.italianName.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q) ||
          (d.koreanName && d.koreanName.toLowerCase().includes(q));
        const matchDist = d.district.toLowerCase().includes(q);
        if (!matchName && !matchDist) return false;
      }
      return true;
    });
  }, [destinations, destCategory, destQuery]);

  // Confronto tra tutti i 4 alloggi per la tappa selezionata
  const allAccommodationsComparison = useMemo(() => {
    if (!network || !selectedDestination) return [];
    return compareAccommodationsForDestination(network, accommodations, selectedDestination, routeOptions);
  }, [network, accommodations, selectedDestination, routeOptions]);

  const toggleSegmentStops = (idx: number) => {
    setExpandedSegments((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!network) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            Caricamento rete metropolitana di Seul…
          </div>
        )}
        {error && (
          <>
            <p className="text-red-300">Impossibile caricare la rete metro: {error}</p>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Riprova
            </button>
          </>
        )}
      </div>
    );
  }

  const lastUpdatedTimeStr = geoState.lastUpdated
    ? new Date(geoState.lastUpdated).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : null;

  const originSection = (
      <section className={compact ? 'space-y-2.5 pt-3 border-t border-slate-800/80' : 'space-y-2.5'}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-cyan-400" />
            {compact ? 'La mia posizione (GPS)' : '1. Punto di partenza (GPS Live o Alloggio)'}
          </span>
          {!compact && <span className="text-[11px] text-slate-500">Scegli o clicca sulla mappa</span>}
        </div>

        {/* Scheda Geolocalizzazione Dispositivo in Tempo Reale */}
        <div
          className={`p-3 rounded-xl border transition-colors space-y-2.5 ${
            isGpsSelected
              ? 'bg-slate-800/95 border-cyan-400 text-white'
              : 'bg-slate-950/90 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LocateFixed
                className={`w-4 h-4 shrink-0 ${
                  geoState.status === 'active'
                    ? geoState.isSimulated
                      ? 'text-amber-400'
                      : 'text-cyan-400'
                    : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {geoState.isSimulated && geoState.simulatedPreset
                    ? `Posizione Simulata: ${geoState.simulatedPreset.labelIt}`
                    : 'La mia posizione attuale (GPS Browser)'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {geoState.status === 'idle' &&
                    'Attiva il GPS per calcolare la metro più vicina a te in tempo reale'}
                  {geoState.status === 'requesting' &&
                    'Richiesta autorizzazione posizione al browser in corso…'}
                  {geoState.status === 'active' &&
                    geoState.coords &&
                    `${geoState.coords[0].toFixed(4)}, ${geoState.coords[1].toFixed(4)} · ${
                      geoState.isSimulated
                        ? 'Test Seul attivo'
                        : `±${Math.round(geoState.accuracyMeters ?? 15)}m`
                    }${lastUpdatedTimeStr ? ` · agg. ${lastUpdatedTimeStr}` : ''}`}
                  {(geoState.status === 'denied' || geoState.status === 'error') &&
                    (geoState.errorMessage || 'Autorizzazione GPS negata o non disponibile')}
                </div>
              </div>
            </div>

            {/* Pulsante Attiva / Usa / Ferma GPS */}
            <div className="flex items-center gap-1.5 shrink-0">
              {geoState.status !== 'active' ? (
                <button
                  type="button"
                  onClick={onActivateRealGps}
                  disabled={geoState.status === 'requesting'}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  {geoState.status === 'requesting' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="w-3.5 h-3.5" />
                  )}
                  <span>Attiva Posizione</span>
                </button>
              ) : (
                <>
                  {!isGpsSelected && (
                    <button
                      type="button"
                      onClick={() => onSelectOrigin('gps_origin')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold whitespace-nowrap"
                    >
                      Usa come partenza
                    </button>
                  )}
                  {geoState.coords && (
                    <button
                      type="button"
                      onClick={() => onFocusPoint(geoState.coords!, 15)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-cyan-300 border border-slate-700"
                      title="Centra mappa sulla mia posizione"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onStopGps}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-700"
                    title="Disattiva tracciamento GPS"
                  >
                    <LocateOff className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stazioni metro più vicine quando il GPS è attivo e dentro l'area di Seul */}
          {geoState.status === 'active' && nearbyGpsStations.length > 0 && (
            <div className="pt-2 border-t border-slate-700/70 space-y-1">
              <div className="text-[10px] font-semibold text-cyan-300 flex items-center justify-between">
                <span>Stazioni metro più vicine alla tua posizione:</span>
                {geoState.isSimulated && (
                  <button
                    type="button"
                    onClick={onActivateRealGps}
                    className="text-amber-300 hover:underline font-normal"
                  >
                    Torna a GPS reale
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {nearbyGpsStations.map((st) => (
                  <button
                    key={st.stationKey}
                    type="button"
                    onClick={() => onFocusPoint(st.latLng, 16, st.stationKey, st.lines[0]?.id)}
                    className="w-full text-left px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-white truncate">{st.station.en}</span>
                      <span className="text-slate-400 shrink-0 text-[10px]">({st.station.ko}역)</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {st.lines.map((l) => (
                          <LineBadge key={l.id} line={l} size="sm" />
                        ))}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-cyan-300 shrink-0 text-[10px]">
                      {st.distanceMeters} m · ~{st.walkMinutes}m
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Barra rapida per simulare una posizione a Seul (sempre accessibile per testare da casa) */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setShowSimPresets((v) => !v)}
              className="text-amber-300 hover:text-amber-200 font-medium inline-flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>
                {showSimPresets
                  ? 'Nascondi posizioni simulate a Seul'
                  : 'Sei in Italia? Simula posizione GPS a Seul'}
              </span>
            </button>
            {isGpsSelected && (
              <span className="text-[10px] font-mono text-cyan-400">Origine attiva</span>
            )}
          </div>

          {showSimPresets && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {SEOUL_GPS_SIMULATION_PRESETS.map((preset) => {
                const isThisPreset =
                  geoState.isSimulated && geoState.simulatedPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onActivateSimulatedGps(preset);
                      setShowSimPresets(false);
                    }}
                    className={`p-2 rounded-lg border text-left text-[11px] transition-colors ${
                      isThisPreset
                        ? 'bg-amber-950/40 border-amber-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-white truncate">{preset.labelIt}</div>
                    <div className="text-[10px] text-slate-400 truncate">{preset.district}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!compact && (
          <>
        {/* Griglia dei 4 Alloggi come punto di partenza alternativo */}
        <div className="grid grid-cols-2 gap-1.5">
          {accommodations.map((acc) => {
            const isSel = acc.id === selectedOriginId;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectOrigin(acc.id)}
                className={`p-2.5 rounded-xl border text-left transition-colors ${
                  isSel
                    ? 'bg-slate-800 border-cyan-500 text-white'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    Alloggio {acc.accommodationCode}
                  </span>
                  {isSel && <span className="text-[10px] font-mono text-cyan-400">Partenza</span>}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{acc.district}</div>
              </button>
            );
          })}
        </div>
          </>
        )}
      </section>
  );

  const destSection = (
      <section className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            2. Punto di interesse o Alloggio di arrivo
          </span>
          <button
            type="button"
            onClick={() => setShowDestPicker((v) => !v)}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            {showDestPicker ? 'Chiudi elenco' : 'Cambia destinazione'}
            {showDestPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Destinazione attualmente attiva */}
        {selectedDestination && (
          <button
            type="button"
            onClick={() => setShowDestPicker((v) => !v)}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-cyan-500/60 text-left flex items-center justify-between gap-2 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {selectedDestination.category === 'alloggio' ? '🏠 ' : ''}
                {selectedDestination.italianName}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {selectedDestination.district} · {selectedDestination.city}
                {selectedDestination.koreanName ? ` · ${selectedDestination.koreanName}` : ''}
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                showDestPicker ? 'rotate-180 text-cyan-400' : ''
              }`}
            />
          </button>
        )}

        {/* Selettore espandibile di tutte le tappe della Corea + tutti i 4 Alloggi */}
        {showDestPicker && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                placeholder="Cerca tappa o alloggio: Alloggio A, Gyeongbokgung, Hongdae…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'Tutti' },
                { id: 'alloggio', label: '🏠 Alloggi (4)' },
                { id: 'cultura', label: 'Cultura' },
                { id: 'nightlife', label: 'Nightlife' },
                { id: 'food', label: 'Food' },
                { id: 'natura', label: 'Natura' },
                { id: 'gita', label: 'Gite' },
                { id: 'logistica', label: 'Aeroporto' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setDestCategory(cat.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    destCategory === cat.id
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
              {filteredDestinations.map((dest) => {
                const isSel = dest.id === selectedDestinationId;
                const info = reachabilityByDestId.get(dest.id);
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => {
                      onSelectDestination(dest.id);
                      setShowDestPicker(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 flex items-center justify-between gap-2 transition-colors ${
                      isSel ? 'bg-slate-800 text-white' : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {dest.category === 'alloggio' ? '🏠 ' : ''}
                        {dest.italianName}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {dest.district} · {dest.city}
                      </div>
                    </div>
                    {info && (
                      <span
                        className={`text-[10px] font-mono tabular-nums shrink-0 ${
                          info.reachable ? 'text-cyan-400' : 'text-amber-400'
                        }`}
                      >
                        {info.reachable
                          ? `~${info.mins} min · ${info.transfers === 0 ? 'diretto' : `${info.transfers} camb.`}`
                          : 'No metro'}
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredDestinations.length === 0 && (
                <div className="p-3 text-center text-xs text-slate-500">Nessuna destinazione trovata.</div>
              )}
            </div>
          </div>
        )}
      </section>
  );

  const routeSection = currentRoute && (
        <section className={`space-y-3 ${compact ? '' : 'pt-2 border-t border-slate-800/80'}`}>
          {!currentRoute.reachable ? (
            /* STATO: ERRORE DISTANZA DALLA METRO O TAPPA NON SERVITA */
            <div
              className={`p-4 rounded-xl bg-slate-950 border space-y-3 ${
                currentRoute.originOutOfMetroCoverage ? 'border-red-500/50' : 'border-amber-500/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    currentRoute.originOutOfMetroCoverage ? 'text-red-400' : 'text-amber-400'
                  }`}
                />
                <div>
                  <h3 className="text-xs font-bold text-white">
                    {currentRoute.originOutOfMetroCoverage
                      ? 'Al momento non ti trovi ancora in prossimità della metro di Seul'
                      : 'Nessuna tratta metro disponibile per questa tappa'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {currentRoute.reasonIfUnreachable}
                  </p>
                </div>
              </div>

              {currentRoute.nearestStationIfUnreachable && (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <div className="text-[11px] text-slate-400">
                    {currentRoute.originOutOfMetroCoverage
                      ? 'Stazione della metropolitana di Seul più vicina alla tua posizione:'
                      : 'Stazione metro più vicina alla destinazione in linea d\'aria:'}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200">
                      {currentRoute.nearestStationIfUnreachable.station.en} (
                      {currentRoute.nearestStationIfUnreachable.station.ko}역)
                    </span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {(currentRoute.nearestStationIfUnreachable.distanceMeters / 1000)
                        .toFixed(1)
                        .replace('.', ',')}{' '}
                      km
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    {currentRoute.nearestStationIfUnreachable.lines.map((l) => (
                      <LineBadge key={l.id} line={l} size="sm" />
                    ))}
                  </div>
                </div>
              )}

              {/* Se l'utente è fuori dall'area metro di Seul (es. in Italia), offre subito i pulsanti per simulare una posizione a Seul */}
              {currentRoute.originOutOfMetroCoverage && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-2">
                  <div className="text-[11px] font-semibold text-amber-200">
                    Vuoi testare il calcolo percorso metro live prima di arrivare in Corea?
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SEOUL_GPS_SIMULATION_PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onActivateSimulatedGps(preset)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-colors"
                      >
                        Simula: {preset.labelIt.split(' (')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onFitRoute}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" /> Mostra posizione sulla mappa
                </button>
                <a
                  href={getNaverMapSearchUrl(currentRoute.destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5"
                  title={
                    currentRoute.destination.koreanName
                      ? `Cerca "${currentRoute.destination.koreanName}" su Naver Map`
                      : 'Cerca su Naver Map'
                  }
                >
                  <span>Cerca su Naver Map</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            /* STATO: PERCORSO METRO TROVATO */
            <>
              {/* Barra Metriche Principali (tabular-nums) */}
              <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">Durata stimata</div>
                  <div className="text-sm font-bold text-white font-mono tabular-nums mt-0.5">
                    ~{currentRoute.estimatedTotalMinutes}m
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Fermate</div>
                  <div className="text-sm font-bold text-cyan-400 font-mono tabular-nums mt-0.5">
                    {currentRoute.totalStops}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Cambi linea</div>
                  <div className="text-sm font-bold text-slate-100 font-mono tabular-nums mt-0.5">
                    {currentRoute.totalTransfers === 0 ? 'Diretto' : currentRoute.totalTransfers}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Tot. a piedi</div>
                  <div className="text-sm font-bold text-slate-200 font-mono tabular-nums mt-0.5">
                    {currentRoute.totalWalkMeters}m
                  </div>
                </div>
              </div>

              {/* Pulsanti rapidi Inquadra Tratta, Rivedi Animazione & Naver Map */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onFitRoute}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Inquadra tratta</span>
                </button>
                {onReplayAnimation && (
                  <button
                    type="button"
                    onClick={onReplayAnimation}
                    className="py-1.5 px-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
                    title="Ridisegna con animazione fluida il percorso dall'origine alla destinazione sulla mappa"
                  >
                    <Play className="w-3 h-3 text-cyan-400 fill-cyan-400 shrink-0" />
                    <span>Anima tratta</span>
                  </button>
                )}
                <a
                  href={getNaverMapSearchUrl(currentRoute.destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
                  title={
                    currentRoute.destination.koreanName
                      ? `Cerca "${currentRoute.destination.koreanName}" su Naver Map`
                      : 'Cerca su Naver Map'
                  }
                >
                  <span>Naver Map</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* TIMELINE PASSO-PASSO DEL PERCORSO */}
              <div className="space-y-2.5">
                {/* PASSO 1: Partenza (GPS o Alloggio) e camminata alla stazione */}
                {currentRoute.walkStart && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        Partenza:{' '}
                        {currentRoute.origin.id === 'gps_origin' || currentRoute.origin.category !== 'alloggio'
                          ? originLabel(currentRoute.origin)
                          : `Alloggio ${currentRoute.origin.accommodationCode} (${currentRoute.origin.district})`}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        {currentRoute.walkStart.distanceMeters} m · ~{currentRoute.walkStart.walkMinutes} min
                      </span>
                    </div>
                    {currentRoute.segments.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onFocusPoint(
                            currentRoute.walkStart!.toLatLng,
                            16,
                            currentRoute.walkStart!.stationKey,
                            currentRoute.walkStart!.lineId
                          )
                        }
                        className="w-full text-left text-xs text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 pt-0.5 transition-colors"
                      >
                        <Footprints className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Cammina fino alla stazione <strong>{currentRoute.walkStart.station.en}</strong> (
                          {currentRoute.walkStart.station.ko}역)
                        </span>
                      </button>
                    )}
                    {currentRoute.walkStart.note && (
                      <p className="text-[11px] text-amber-300 pt-1">{currentRoute.walkStart.note}</p>
                    )}
                  </div>
                )}

                {/* SEGMENTI METRO E INTERSCAMBI */}
                {currentRoute.segments.map((seg, sIdx) => {
                  const transfer = sIdx > 0 ? currentRoute.transfers[sIdx - 1] : null;
                  const isExpanded = Boolean(expandedSegments[sIdx]);
                  const boardPos =
                    seg.fromStation.at[seg.line.id] ?? Object.values(seg.fromStation.at)[0];
                  const alightPos =
                    seg.toStation.at[seg.line.id] ?? Object.values(seg.toStation.at)[0];

                  return (
                    <React.Fragment key={`${seg.line.id}-${seg.fromStationKey}-${sIdx}`}>
                      {/* Blocco Interscambio se presente */}
                      {transfer && (
                        <button
                          type="button"
                          onClick={() =>
                            onFocusPoint(transfer.latLng, 16, transfer.stationKey, transfer.toLine.id)
                          }
                          className="w-full p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/40 hover:bg-amber-950/40 text-left flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ArrowDownUp className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-amber-200 truncate">
                                {transfer.isSameLineBranchChange
                                  ? `Cambio banchina a ${transfer.station.en} (${transfer.station.ko}역)`
                                  : `Cambio linea a ${transfer.station.en} (${transfer.station.ko}역)`}
                              </div>
                              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                                <span>Scendi da</span>
                                <LineBadge line={transfer.fromLine} size="sm" />
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span>Prendi</span>
                                <LineBadge line={transfer.toLine} size="sm" />
                                <span className="font-semibold text-white">{transfer.toLine.it}</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-amber-300 shrink-0">~4 min</span>
                        </button>
                      )}

                      {/* Blocco Tratta in Treno / Metro */}
                      <div
                        className="rounded-xl border bg-slate-950 overflow-hidden"
                        style={{ borderColor: `${seg.line.color}66` }}
                      >
                        {/* Intestazione Linea */}
                        <div
                          className="p-3 flex items-center justify-between gap-2"
                          style={{ background: `linear-gradient(90deg, ${seg.line.color}28, transparent)` }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <LineBadge line={seg.line} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {seg.line.it}
                                {seg.branchLabel ? ` · ${seg.branchLabel}` : ''}
                              </div>
                              <div className="text-[11px] text-slate-300 truncate">
                                {seg.directionSummary}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono tabular-nums">
                            <div className="text-xs font-bold text-white">{seg.stopCount} ferm.</div>
                            <div className="text-[10px] text-slate-400">~{seg.estimatedMinutes} min</div>
                          </div>
                        </div>

                        {/* Stazione di salita, fermate intermedie e stazione di discesa */}
                        <div className="p-3 space-y-2 text-xs">
                          <button
                            type="button"
                            onClick={() => onFocusPoint(boardPos, 16, seg.fromStationKey, seg.line.id)}
                            className="w-full text-left flex items-center justify-between gap-2 py-1 px-2 rounded-lg hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 bg-white"
                                style={{ border: `2px solid ${seg.line.color}` }}
                              />
                              <span className="font-bold text-white truncate">
                                Salita: {seg.fromStation.en}
                              </span>
                              <span className="text-slate-400 text-[11px] shrink-0">
                                {seg.fromStation.ko}역
                              </span>
                            </div>
                            <span className="text-[10px] text-cyan-400 shrink-0">Mappa</span>
                          </button>

                          {/* Elenco espandibile delle fermate intermedie */}
                          {seg.intermediateStations.length > 0 && (
                            <div className="pl-3">
                              <button
                                type="button"
                                onClick={() => toggleSegmentStops(sIdx)}
                                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 py-0.5"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                                )}
                                <span>
                                  {isExpanded ? 'Nascondi' : 'Mostra'} le {seg.intermediateStations.length}{' '}
                                  fermate intermedie
                                </span>
                              </button>

                              {isExpanded && (
                                <ol className="mt-1.5 space-y-1 pl-2 border-l border-slate-800">
                                  {seg.intermediateStations.map((st, idx) => {
                                    const stKey = seg.intermediateStationKeys[idx];
                                    const pos = st.at[seg.line.id] ?? Object.values(st.at)[0];
                                    return (
                                      <li key={`${stKey}-${idx}`}>
                                        <button
                                          type="button"
                                          onClick={() => onFocusPoint(pos, 15, stKey, seg.line.id)}
                                          className="w-full text-left py-0.5 px-1.5 rounded hover:bg-slate-900 text-[11px] text-slate-300 flex items-center justify-between gap-2"
                                        >
                                          <span className="truncate">{st.en}</span>
                                          <span className="text-[10px] text-slate-500 shrink-0">
                                            {st.ko}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ol>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => onFocusPoint(alightPos, 16, seg.toStationKey, seg.line.id)}
                            className="w-full text-left flex items-center justify-between gap-2 py-1 px-2 rounded-lg hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: seg.line.color }}
                              />
                              <span className="font-bold text-white truncate">
                                {sIdx === currentRoute.segments.length - 1 ? 'Discesa' : 'Scendi per cambio'}:{' '}
                                {seg.toStation.en}
                              </span>
                              <span className="text-slate-400 text-[11px] shrink-0">
                                {seg.toStation.ko}역
                              </span>
                            </div>
                            <span className="text-[10px] text-cyan-400 shrink-0">Mappa</span>
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* PASSO FINALE: Camminata dalla stazione di discesa alla Destinazione */}
                {currentRoute.walkEnd && currentRoute.segments.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        Arrivo: {currentRoute.destination.italianName}
                        {currentRoute.destination.koreanName
                          ? ` (${currentRoute.destination.koreanName})`
                          : ''}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        {currentRoute.walkEnd.distanceMeters} m · ~{currentRoute.walkEnd.walkMinutes} min
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onFocusPoint([currentRoute.destination.lat, currentRoute.destination.lng], 16)
                      }
                      className="w-full text-left text-xs text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 pt-0.5 transition-colors"
                    >
                      <Footprints className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Dalla stazione <strong>{currentRoute.walkEnd.station.en}</strong> fino a{' '}
                        {currentRoute.destination.category === 'alloggio' ? 'questo alloggio' : 'questa tappa'}
                      </span>
                    </button>
                    {currentRoute.walkEnd.note && (
                      <p className="text-[11px] text-amber-300 pt-1 leading-relaxed">
                        {currentRoute.walkEnd.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
  );

  const compareSection = selectedDestination && allAccommodationsComparison.length > 0 && (
        <section className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <TrainFront className="w-3.5 h-3.5 text-cyan-400" />
              Confronto dai 4 Alloggi verso {selectedDestination.italianName}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/70 overflow-hidden">
            {allAccommodationsComparison.map((res) => {
              const isSelectedOrigin = res.origin.id === selectedOriginId;
              return (
                <button
                  key={res.origin.id}
                  type="button"
                  onClick={() => onSelectOrigin(res.origin.id)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                    isSelectedOrigin ? 'bg-slate-800/90 text-white' : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-100 truncate">
                      Alloggio {res.origin.accommodationCode} · {res.origin.district}
                    </div>
                    {res.reachable ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 flex-wrap">
                        {res.segments.length === 0 ? (
                          <span>A piedi diretto</span>
                        ) : (
                          res.segments.map((s, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span className="text-slate-600">→</span>}
                              <LineBadge line={s.line} size="sm" />
                            </React.Fragment>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-400 mt-0.5">Nessuna tratta metro</div>
                    )}
                  </div>

                  {res.reachable && (
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-xs font-bold text-cyan-300">~{res.estimatedTotalMinutes} min</div>
                      <div className="text-[10px] text-slate-400">
                        {res.totalStops} ferm. ·{' '}
                        {res.totalTransfers === 0 ? '0 cambi' : `${res.totalTransfers} camb.`}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
  );

  // Interruttore "Senza AREX" (sul telefono sta nella scheda della partenza/destinazione)
  const arexSection =
    onToggleAvoidArex && !compact ? (
      <button
        type="button"
        onClick={onToggleAvoidArex}
        aria-pressed={avoidArex}
        data-testid="avoid-arex"
        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
          avoidArex ? 'bg-cyan-950/50 border-cyan-500/60' : 'bg-slate-950 border-slate-800 hover:border-slate-600'
        }`}
      >
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-bold text-white">Senza AREX</span>
          <span className="block text-[11px] text-slate-400 leading-snug">
            Percorsi solo con le altre linee metro e a piedi: niente treno per l&apos;aeroporto.
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors ${avoidArex ? 'bg-cyan-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${avoidArex ? 'left-[1.125rem]' : 'left-0.5'}`} />
        </span>
      </button>
    ) : null;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
      {compact ? (
        <>
          {routeSection}
          {compareSection}
          {originSection}
        </>
      ) : (
        <>
          {originSection}
          {destSection}
          {arexSection}
          {routeSection}
          {compareSection}
        </>
      )}
    </div>
  );
};
