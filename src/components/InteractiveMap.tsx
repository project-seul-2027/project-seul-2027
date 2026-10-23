import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { MAP_LOCATIONS, MapLocation, ITINERARY_DAYS } from '../data/tripData';
import {
  MapPin, Compass, Search, Moon, Sun, Home, ExternalLink,
  Calendar, TrainFront, X, Info
} from 'lucide-react';
import { loadSeoulMetro, lineStationKeys, type MetroNetwork } from '../data/seoulMetro';
import { MetroLayer } from './map/metroLayer';
import { MetroPanel, LineBadge } from './map/MetroPanel';

interface InteractiveMapProps {
  selectedLocationId?: string | null;
  onSelectLocation?: (location: MapLocation | null) => void;
  selectedDayFilter?: number | null;
}

// Google Maps English Tiles (Forces English labels across Seoul, subway stations, roads & districts via hl=en)
const GOOGLE_EN_TILE_URL = 'https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
// Stessa mappa senza le linee dei trasporti (stile "transit.line: off"): le linee metro le disegna
// il sito sopra la mappa, così si possono selezionare e nascondere una per una.
const GOOGLE_EN_NO_TRANSIT_TILE_URL = `${GOOGLE_EN_TILE_URL}&apistyle=s.t%3A65%7Cp.v%3Aoff`;
const TILE_OPTIONS = {
  maxZoom: 20,
  subdomains: ['0', '1', '2', '3']
};

const METRO_PREFS_KEY = 'seul2027.metro.v1';

interface MetroPrefs {
  visible: string[] | null;
  googleLines: boolean;
}

function readMetroPrefs(): MetroPrefs {
  try {
    const raw = localStorage.getItem(METRO_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MetroPrefs>;
      return {
        visible: Array.isArray(parsed.visible) ? parsed.visible.filter((v) => typeof v === 'string') : null,
        googleLines: parsed.googleLines === true
      };
    }
  } catch {
    // localStorage non disponibile (navigazione privata, anteprime): si usano i valori predefiniti
  }
  return { visible: null, googleLines: false };
}

function writeMetroPrefs(prefs: MetroPrefs) {
  try {
    localStorage.setItem(METRO_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignorato: le preferenze restano solo per questa visita
  }
}

const CATEGORY_STYLE: Record<string, { badge: string; ring: string; letter: string }> = {
  alloggio: { badge: '#3b82f6', ring: 'rgba(59, 130, 246, 0.6)', letter: '🏠' },
  nightlife: { badge: '#ec4899', ring: 'rgba(236, 72, 153, 0.5)', letter: '🍸' },
  food: { badge: '#f59e0b', ring: 'rgba(245, 158, 11, 0.5)', letter: '🍜' },
  cultura: { badge: '#8b5cf6', ring: 'rgba(139, 92, 246, 0.5)', letter: '🏯' },
  natura: { badge: '#10b981', ring: 'rgba(16, 185, 129, 0.5)', letter: '🌲' },
  gita: { badge: '#0ea5e9', ring: 'rgba(14, 165, 233, 0.5)', letter: '🚆' },
  logistica: { badge: '#94a3b8', ring: 'rgba(148, 163, 184, 0.4)', letter: '✈️' }
};

function makeMarkerIcon(loc: MapLocation, isSelected: boolean): L.DivIcon {
  const style = CATEGORY_STYLE[loc.category] ?? { badge: '#06b6d4', ring: 'rgba(6, 182, 212, 0.4)', letter: '📍' };
  const isAccommodation = loc.category === 'alloggio';
  const size = isSelected ? 38 : isAccommodation ? 34 : 30;
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
        background-color: ${isAccommodation ? '#1e3a8a' : '#090d16'};
        border: 2px solid ${style.badge};
        border-radius: 50%;
        box-shadow: 0 0 ${isSelected ? '16px' : '8px'} ${style.ring};
        color: #ffffff;
        font-size: ${isSelected ? '16px' : '13px'};
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
      ">
        <span>${style.letter}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function poiTooltipHtml(loc: MapLocation): string {
  const warn =
    loc.id === 'valorant_masters_arena'
      ? '<div class="poi-tip-warn">⚠️ Sede non ancora annunciata</div>'
      : '';
  return `<div class="poi-tip">
    <div class="poi-tip-kicker">${loc.district} · ${loc.city}</div>
    <div class="poi-tip-title">${loc.italianName}</div>
    ${warn}
    <div class="poi-tip-hint">Clicca per i dettagli</div>
  </div>`;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  selectedLocationId,
  onSelectLocation,
  selectedDayFilter: initialDayFilter = null
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeCity, setActiveCity] = useState<string>('all');
  const [activeDay, setActiveDay] = useState<number | 'all'>(initialDayFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentSelectedLoc, setCurrentSelectedLoc] = useState<MapLocation | null>(null);
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark');
  // Letti dai listener dei segnaposto, che non devono ricrearsi a ogni cambio
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = currentSelectedLoc?.id ?? null;
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;

  // ── Linee metro ──
  const initialPrefs = useMemo(readMetroPrefs, []);
  const [sidebarTab, setSidebarTab] = useState<'places' | 'metro'>('places');
  const [metroNetwork, setMetroNetwork] = useState<MetroNetwork | null>(null);
  const [metroError, setMetroError] = useState<string | null>(null);
  const [metroAttempt, setMetroAttempt] = useState(0);
  const [metroVisible, setMetroVisible] = useState<Set<string>>(() => new Set(initialPrefs.visible ?? []));
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [showGoogleLines, setShowGoogleLines] = useState(initialPrefs.googleLines);
  const metroLayerRef = useRef<MetroLayer | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hiddenMetroRef = useRef<string[] | null>(null);

  // Sync external selectedLocationId
  useEffect(() => {
    if (selectedLocationId) {
      const loc = MAP_LOCATIONS.find((l) => l.id === selectedLocationId);
      if (loc) {
        setCurrentSelectedLoc(loc);
        mapInstanceRef.current?.setView([loc.lat, loc.lng], 15, { animate: true });
      }
    }
  }, [selectedLocationId]);

  // Sync external day filter if changed
  useEffect(() => {
    if (initialDayFilter !== undefined && initialDayFilter !== null) {
      setActiveDay(initialDayFilter);
    }
  }, [initialDayFilter]);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return MAP_LOCATIONS.filter((loc) => {
      if (activeCategory !== 'all' && loc.category !== activeCategory) return false;
      if (activeCity !== 'all' && loc.city !== activeCity) return false;
      if (activeDay !== 'all' && !loc.dayNumbers.includes(activeDay)) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = loc.italianName.toLowerCase().includes(q) || loc.name.toLowerCase().includes(q);
        const matchesDistrict = loc.district.toLowerCase().includes(q);
        const matchesDesc = loc.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDistrict && !matchesDesc) return false;
      }
      return true;
    });
  }, [activeCategory, activeCity, activeDay, searchQuery]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [37.5568, 126.9738],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('Mappa © Google')
        .addTo(map);

      mapInstanceRef.current = map;
    }
  }, []);

  // Truly switch between Dark and Light tiles (e con/senza le linee dei trasporti di Google)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const newLayer = L.tileLayer(showGoogleLines ? GOOGLE_EN_TILE_URL : GOOGLE_EN_NO_TRANSIT_TILE_URL, {
      ...TILE_OPTIONS,
      className: mapTheme === 'dark' ? 'osm-dark-tiles' : 'osm-light-tiles'
    }).addTo(map);

    currentTileLayerRef.current = newLayer;
  }, [mapTheme, showGoogleLines]);

  // Carica i tracciati delle linee (file separato, scaricato solo quando serve la mappa)
  useEffect(() => {
    let cancelled = false;
    setMetroError(null);
    loadSeoulMetro()
      .then((network) => {
        if (cancelled) return;
        setMetroVisible((prev) => {
          const known = new Set(network.lines.map((l) => l.id));
          if (initialPrefs.visible) return new Set([...prev].filter((id) => known.has(id)));
          return new Set(network.lines.filter((l) => l.defaultVisible).map((l) => l.id));
        });
        setMetroNetwork(network);
      })
      .catch((err: Error) => {
        if (!cancelled) setMetroError(err.message || 'errore di rete');
      });
    return () => {
      cancelled = true;
    };
  }, [metroAttempt, initialPrefs]);

  const selectLine = useCallback((id: string | null) => {
    setSelectedLine(id);
    if (id) setMetroVisible((prev) => (prev.has(id) ? prev : new Set([...prev, id])));
  }, []);

  // Crea il livello delle linee quando mappa e dati sono pronti
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !metroNetwork) return;
    const layer = new MetroLayer(map, metroNetwork, { onSelectLine: selectLine });
    metroLayerRef.current = layer;
    map.attributionControl?.addAttribution('Linee metro © OpenStreetMap');
    return () => {
      layer.destroy();
      metroLayerRef.current = null;
    };
  }, [metroNetwork, selectLine]);

  useEffect(() => {
    metroLayerRef.current?.setTheme(mapTheme);
  }, [mapTheme, metroNetwork]);

  useEffect(() => {
    metroLayerRef.current?.setVisible(metroVisible);
  }, [metroVisible, metroNetwork]);

  useEffect(() => {
    metroLayerRef.current?.setSelected(selectedLine);
  }, [selectedLine, metroNetwork]);

  // La linea selezionata non può essere nascosta
  useEffect(() => {
    if (selectedLine && !metroVisible.has(selectedLine)) setSelectedLine(null);
  }, [metroVisible, selectedLine]);

  // Ricorda le scelte su questo dispositivo
  useEffect(() => {
    if (!metroNetwork) return;
    writeMetroPrefs({ visible: [...metroVisible], googleLines: showGoogleLines });
  }, [metroVisible, showGoogleLines, metroNetwork]);

  const toggleMetroLine = (id: string) =>
    setMetroVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Su telefono mappa e pannello sono uno sopra l'altro: porta in vista quello che è cambiato. */
  const isStacked = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  const revealMap = () => {
    if (isStacked()) mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const revealPanel = () => {
    if (isStacked()) sidebarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectLineFromPanel = (id: string | null) => {
    selectLine(id);
    if (id) {
      metroLayerRef.current?.fitLine(id);
      revealMap();
    }
  };

  const focusStation = (key: string, lineId?: string) => {
    metroLayerRef.current?.focusStation(key, lineId);
    revealMap();
  };

  /** Pulsante sulla mappa: spegne tutte le linee e le riaccende come prima. */
  const toggleAllMetro = () => {
    if (metroVisible.size > 0) {
      hiddenMetroRef.current = [...metroVisible];
      setMetroVisible(new Set());
    } else {
      const restore =
        hiddenMetroRef.current ?? metroNetwork?.lines.filter((l) => l.defaultVisible).map((l) => l.id) ?? [];
      setMetroVisible(new Set(restore));
    }
  };

  const selectedLineDef = selectedLine ? metroNetwork?.lines.find((l) => l.id === selectedLine) : undefined;

  // Segnaposto delle tappe: si ricreano solo quando cambiano i filtri (non a ogni click)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    filteredLocations.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng], {
        icon: makeMarkerIcon(loc, selectedIdRef.current === loc.id)
      });
      // Passando sopra il segnaposto: solo un'etichetta con il nome
      marker.bindTooltip(poiTooltipHtml(loc), {
        direction: 'top',
        offset: [0, -16],
        className: 'poi-tooltip',
        opacity: 1
      });
      // Click: apre il riquadro di dettaglio in basso a sinistra (nessun popup)
      marker.on('click', () => selectLocation(loc));
      marker.addTo(map);
      markersRef.current[loc.id] = marker;
    });
  }, [filteredLocations]);

  // Evidenzia il segnaposto selezionato senza ricrearlo
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const loc = MAP_LOCATIONS.find((l) => l.id === id);
      if (loc) marker.setIcon(makeMarkerIcon(loc, id === currentSelectedLoc?.id));
    });
  }, [currentSelectedLoc]);

  /** Seleziona una tappa (o toglie la selezione con null): aggiorna il riquadro e il segnaposto. */
  const selectLocation = (loc: MapLocation | null) => {
    setCurrentSelectedLoc(loc);
    onSelectRef.current?.(loc);
  };

  const handleSelectLocation = (loc: MapLocation) => {
    selectLocation(loc);
    mapInstanceRef.current?.setView([loc.lat, loc.lng], 15, { animate: true });
  };

  const jumpToView = (viewName: 'seoul' | 'alloggi' | 'hongdae' | 'gite' | 'pechino' | 'tiananmen') => {
    if (!mapInstanceRef.current) return;
    switch (viewName) {
      case 'seoul':
        mapInstanceRef.current.setView([37.5568, 126.9738], 12, { animate: true });
        break;
      case 'alloggi':
        mapInstanceRef.current.setView([37.5550, 126.9800], 13, { animate: true });
        setActiveCategory('alloggio');
        break;
      case 'hongdae':
        mapInstanceRef.current.setView([37.5568, 126.9238], 15, { animate: true });
        break;
      case 'gite':
        mapInstanceRef.current.setView([37.50, 126.85], 10, { animate: true });
        break;
      case 'pechino':
      case 'tiananmen':
        mapInstanceRef.current.setView([39.9055, 116.3976], 15, { animate: true });
        setActiveCity('all');
        const tiananmen = MAP_LOCATIONS.find((l) => l.id === 'beijing_tiananmen');
        if (tiananmen) selectLocation(tiananmen);
        break;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[860px] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl relative">
      {/* Sidebar Controls & Location Directory */}
      <div ref={sidebarRef} className="order-2 lg:order-none w-full lg:w-[430px] h-[640px] lg:h-auto flex flex-col bg-slate-900/95 border-t lg:border-t-0 lg:border-r border-slate-800 backdrop-blur-md z-10 shrink-0">
        {/* Search & Theme Switcher */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Mappa Seul (Nomi in Inglese · Google Maps)</span>
            </div>

            {/* REAL Working Map Theme Toggle with OpenStreetMap */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setMapTheme('dark')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mapTheme === 'dark'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mappa notturna ad alto contrasto"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Notte</span>
              </button>
              <button
                onClick={() => setMapTheme('light')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mapTheme === 'light'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mappa chiara completa OpenStreetMap (zero errori)"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Chiara</span>
              </button>
            </div>
          </div>

          {sidebarTab === 'places' && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cerca in italiano: alloggio, mercato, palazzo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          )}

          {/* Quick preset jumps */}
          <div className="flex flex-wrap gap-1.5 text-xs pt-0.5">
            <button
              onClick={() => jumpToView('alloggi')}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-bold transition-colors flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
              <span>4 Alloggi Enko</span>
            </button>
            <button
              onClick={() => jumpToView('seoul')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium"
            >
              Panoramica Seul
            </button>
            <button
              onClick={() => jumpToView('hongdae')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors font-medium"
            >
              Hongdae
            </button>
            <button
              onClick={() => jumpToView('gite')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 transition-colors font-medium"
            >
              Gite Esterne
            </button>
            <button
              onClick={() => jumpToView('pechino')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors font-medium"
            >
              Scalo Pechino
            </button>
            <button
              onClick={() => jumpToView('tiananmen')}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 transition-colors font-bold flex items-center gap-1 shadow-sm"
              title="Vola direttamente alla Piazza Tiananmen"
            >
              <span>🇨🇳 Piazza Tiananmen</span>
            </button>
          </div>
        </div>

        {/* Tappe / Metro */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-800" role="tablist" aria-label="Contenuto del pannello">
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              role="tab"
              aria-selected={sidebarTab === 'places'}
              onClick={() => setSidebarTab('places')}
              className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                sidebarTab === 'places' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> Tappe
            </button>
            <button
              role="tab"
              aria-selected={sidebarTab === 'metro'}
              onClick={() => setSidebarTab('metro')}
              className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                sidebarTab === 'metro' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrainFront className="w-3.5 h-3.5" /> Metro & AREX
              {metroNetwork && (
                <span className="text-[10px] font-mono text-slate-500">
                  {metroVisible.size}/{metroNetwork.lines.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {sidebarTab === 'metro' ? (
          <MetroPanel
            network={metroNetwork}
            loading={!metroNetwork && !metroError}
            error={metroError}
            onRetry={() => setMetroAttempt((n) => n + 1)}
            visible={metroVisible}
            onToggleLine={toggleMetroLine}
            onSetVisible={(ids) => setMetroVisible(new Set(ids))}
            selected={selectedLine}
            onSelectLine={selectLineFromPanel}
            onFitLine={(id) => metroLayerRef.current?.fitLine(id)}
            onFocusStation={focusStation}
            showGoogleLines={showGoogleLines}
            onToggleGoogleLines={() => setShowGoogleLines((v) => !v)}
          />
        ) : (
        <>
        {/* Filter Categories */}
        <div className="p-3.5 border-b border-slate-800 space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Filtra Categoria Tappe:</span>
            {activeCategory !== 'all' && (
              <button
                onClick={() => setActiveCategory('all')}
                className="text-cyan-400 hover:underline lowercase font-normal"
              >
                mostra tutte
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Tutte ({MAP_LOCATIONS.length})
            </button>

            {/* Alloggio Category (4 options Enko Stay) */}
            <button
              onClick={() => setActiveCategory('alloggio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeCategory === 'alloggio'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                  : 'bg-blue-950/40 text-blue-300 border border-blue-500/30 hover:bg-blue-900/50'
              }`}
            >
              🏠 Alloggi ({MAP_LOCATIONS.filter((l) => l.category === 'alloggio').length})
            </button>

            <button
              onClick={() => setActiveCategory('cultura')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === 'cultura'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🏯 Cultura
            </button>
            <button
              onClick={() => setActiveCategory('nightlife')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === 'nightlife'
                  ? 'bg-pink-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🍸 Nightlife
            </button>
            <button
              onClick={() => setActiveCategory('food')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === 'food'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🍜 Food & Mercati
            </button>
            <button
              onClick={() => setActiveCategory('natura')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === 'natura'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🌲 Parchi & Hike
            </button>
            <button
              onClick={() => setActiveCategory('gita')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === 'gita'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🚆 Gite Esterne
            </button>
          </div>

          {/* Day selection dropdown */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 text-xs flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Giorno Viaggio:
            </span>
            <select
              value={activeDay}
              onChange={(e) => setActiveDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 max-w-[220px]"
            >
              <option value="all">Tutti i giorni (1 - 19 Mar)</option>
              <option value="0">1 Mar · Ritrovo Malpensa</option>
              <option value="1">2 Mar · Arrivo Seul, Mangwon & Hongdae</option>
              <option value="2">3 Mar · VALORANT MASTERS SEOUL & Pocha</option>
              <option value="3">4 Mar · Palazzi in Hanbok, Bukchon & Gangnam</option>
              <option value="4">5 Mar · Seongsu-dong, Seoul Forest & Club</option>
              <option value="5">6 Mar · Itaewon (Relax & Serata Cosmopolita)</option>
              <option value="6">7 Mar · Gwangjang, DDP & Saluto a Pietro (Noraebang)</option>
              <option value="7">8 Mar · Rientro Pietro a Milano, Namsan, Myeongdong & Insadong</option>
              <option value="8">9 Mar · Museo Nazionale & Kondae (Konkuk)</option>
              <option value="9">10 Mar · Gita Incheon (Chinatown & Wolmido)</option>
              <option value="10">11 Mar · COEX (Starfield Library), Bongeunsa & Sinchon</option>
              <option value="11">12 Mar · Gita Suwon (Fortezza Hwaseong & Ingye-dong)</option>
              <option value="12">13 Mar · Sabato Sera Grande (Hongdae o Itaewon)</option>
              <option value="13">14 Mar · White Day (Fiume Han con Ramyeon)</option>
              <option value="14">15 Mar · Tour DMZ & Language Exchange</option>
              <option value="15">16 Mar · Parco Bukhansan Hike & Pocha Sinchon</option>
              <option value="16">17 Mar · Souvenir (Olive Young) & Sera Grande Hongdae</option>
              <option value="17">18 Mar · Ultimo Giorno Pieno (Valigie 23kg & Modulo Cina)</option>
              <option value="18">19 Mar · Seul + Scalo Pechino 240h (Qianmen & Anatra)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Location List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2.5 space-y-1">
          {filteredLocations.map((loc) => {
            const isSelected = currentSelectedLoc?.id === loc.id;
            const isAccommodation = loc.category === 'alloggio';

            const isValorant = loc.id === 'valorant_masters_arena';

            return (
              <button
                key={loc.id}
                onClick={() => handleSelectLocation(loc)}
                className={`w-full text-left p-3 rounded-xl transition-all overflow-hidden ${
                  isSelected
                    ? 'bg-slate-800 text-white shadow-lg border border-cyan-500/50 ring-1 ring-cyan-500/20'
                    : isAccommodation
                    ? 'bg-blue-950/20 border border-blue-500/30 hover:bg-blue-900/40 text-slate-200'
                    : isValorant
                    ? 'bg-red-950/20 border border-red-500/30 hover:bg-red-900/40 text-slate-200'
                    : 'hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5 min-w-0">
                  <div className="font-semibold text-xs text-slate-100 flex items-center gap-2 min-w-0 flex-1">
                    <span className="shrink-0 text-sm">
                      {loc.category === 'alloggio' && '🏠'}
                      {loc.category === 'cultura' && (isValorant ? '🎮' : '🏯')}
                      {loc.category === 'nightlife' && '🍸'}
                      {loc.category === 'food' && '🍜'}
                      {loc.category === 'natura' && '🌲'}
                      {loc.category === 'gita' && '🚆'}
                      {loc.category === 'logistica' && '✈️'}
                    </span>
                    <span className="truncate">{loc.italianName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800/80 max-w-[125px] truncate text-right">
                    {loc.district}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 pl-6">
                  {loc.description}
                </p>

                {isValorant && (
                  <div className="mt-1 pl-6 text-[10px] text-red-400 font-bold flex items-center gap-1">
                    <span>⚠️ Sede TBD: Riot Games deve ancora annunciare l'arena</span>
                  </div>
                )}

                {loc.mustTry && (
                  <div className="mt-1 pl-6 text-[10px] text-amber-400 font-semibold">
                    ⭐ Da provare: {loc.mustTry}
                  </div>
                )}
              </button>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nessuna tappa corrisponde ai filtri selezionati.
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Map Canvas */}
      {/* Su telefono la mappa sta sopra al pannello */}
      <div className="isolate order-1 lg:order-none lg:flex-1 h-[62vh] min-h-[360px] max-h-[560px] lg:h-full lg:max-h-none relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Interruttore rapido delle linee metro */}
        {metroNetwork && (
          <button
            onClick={toggleAllMetro}
            aria-pressed={metroVisible.size > 0}
            className={`absolute top-4 right-4 z-[400] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-md shadow-xl transition-colors ${
              metroVisible.size > 0
                ? 'bg-slate-900/95 border-cyan-500/50 text-cyan-300 hover:bg-slate-800'
                : 'bg-slate-900/95 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={metroVisible.size > 0 ? 'Nascondi tutte le linee metro' : 'Mostra le linee metro'}
          >
            <TrainFront className="w-3.5 h-3.5" />
            {metroVisible.size > 0 ? 'Metro visibile' : 'Metro nascosta'}
          </button>
        )}

        {/* Floating Day badge */}
        <div className="absolute top-4 left-4 z-[400] flex flex-wrap gap-2 max-w-[calc(100%-11rem)]">
          {selectedLineDef && (
            <div
              className="bg-slate-900/95 border rounded-xl pl-2 pr-1 py-1 backdrop-blur-md text-xs shadow-xl flex items-center gap-2"
              style={{ borderColor: `${selectedLineDef.color}aa` }}
            >
              <LineBadge line={selectedLineDef} size="sm" />
              <span className="font-semibold text-white">{selectedLineDef.it}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {lineStationKeys(selectedLineDef).length} staz.
              </span>
              {sidebarTab !== 'metro' && (
                <button
                  onClick={() => {
                    setSidebarTab('metro');
                    revealPanel();
                  }}
                  className="px-1.5 py-0.5 rounded text-cyan-300 hover:bg-slate-800 inline-flex items-center gap-1"
                  title="Mostra le stazioni nel pannello"
                >
                  <Info className="w-3 h-3" /> Stazioni
                </button>
              )}
              <button
                onClick={() => setSelectedLine(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                aria-label="Deseleziona linea"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {activeDay !== 'all' && (
            <div className="bg-slate-900/95 border border-cyan-500/50 rounded-xl px-3 py-1.5 backdrop-blur-md text-xs shadow-xl flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {activeDay === 0 ? '1 Mar (Malpensa)' : `${activeDay + 1} Mar`}
                  {(() => {
                    const matchedDay = ITINERARY_DAYS.find(d => d.id === activeDay);
                    return matchedDay ? ` · ${matchedDay.title}` : '';
                  })()}
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {filteredLocations.length} tappe visibili
                </span>
              </div>
              <button
                onClick={() => setActiveDay('all')}
                className="ml-1 p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Rimuovi filtro giorno"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Selected location detail banner on bottom overlay */}
        {currentSelectedLoc && (
          <div className="absolute bottom-4 left-4 right-16 z-[400] bg-slate-900/95 border border-slate-700 rounded-2xl p-4 pr-10 shadow-2xl backdrop-blur-md max-w-lg animate-in fade-in duration-150">
            <button
              onClick={() => selectLocation(null)}
              className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Chiudi dettagli tappa"
              title="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide">
                  {currentSelectedLoc.district} · {currentSelectedLoc.city}
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {currentSelectedLoc.italianName}
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                  {currentSelectedLoc.description}
                </p>
                {currentSelectedLoc.mustTry && (
                  <div className="text-xs text-amber-300 mt-1.5 font-medium">
                    💡 Specialità: {currentSelectedLoc.mustTry}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <a
                  href={`https://map.naver.com/v5/search/${encodeURIComponent(currentSelectedLoc.italianName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <span>Naver Map</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${currentSelectedLoc.lat},${currentSelectedLoc.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
