import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { MAP_LOCATIONS, MapLocation, ITINERARY_DAYS, getNaverMapSearchUrl } from '../data/tripData';
import {
  MapPin,
  Compass,
  Search,
  Moon,
  Sun,
  Home,
  ExternalLink,
  Calendar,
  TrainFront,
  X,
  Info,
  Route,
  Layers,
  Navigation,
  LocateFixed,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { loadSeoulMetro, lineStationKeys, type LatLng, type MetroNetwork } from '../data/seoulMetro';
import { computeMetroRoute } from '../data/metroRouter';
import {
  OFFICIAL_METRO_SOURCES,
  type SeoulSimulationPreset
} from '../data/seoulMetroOfficialData';
import { MetroLayer } from './map/metroLayer';
import { MetroPanel, LineBadge } from './map/MetroPanel';
import { MetroRoutePanel, type LiveGeoState } from './map/MetroRoutePanel';
import { RealMetroDataDrawer } from './map/RealMetroDataDrawer';
import { CATEGORY_STYLE, originLabel } from './map/categoryStyle';
import { MobileMapOverlay, sheetHeight, useIsMobileMap, type SheetSnap } from './map/MobileMapUI';

interface InteractiveMapProps {
  selectedLocationId?: string | null;
  onSelectLocation?: (location: MapLocation | null) => void;
  selectedDayFilter?: number | null;
}

export type MapInteractionMode = 'explore' | 'route';

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

function makeMarkerIcon(
  loc: MapLocation,
  isSelected: boolean,
  routeRole?: 'origin' | 'destination' | 'dimmed' | null,
  touch = false
): L.DivIcon {
  const style = CATEGORY_STYLE[loc.category] ?? { badge: '#06b6d4', ring: 'rgba(6, 182, 212, 0.4)', letter: '📍' };
  const isAccommodation = loc.category === 'alloggio';
  const isRouteActiveNode = routeRole === 'origin' || routeRole === 'destination';
  const size = (isRouteActiveNode ? 42 : isSelected ? 38 : isAccommodation ? 34 : 30) + (touch ? 6 : 0);
  const borderColor =
    routeRole === 'origin'
      ? '#38bdf8'
      : routeRole === 'destination'
      ? '#34d399'
      : style.badge;
  const opacity = routeRole === 'dimmed' ? 0.55 : 1;

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
        border: ${isRouteActiveNode ? '3px' : '2px'} solid ${borderColor};
        border-radius: 50%;
        box-shadow: 0 0 ${isRouteActiveNode ? '20px' : isSelected ? '16px' : '8px'} ${style.ring};
        color: #ffffff;
        font-size: ${isRouteActiveNode ? '17px' : isSelected ? '16px' : '13px'};
        opacity: ${opacity};
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

function makeGpsMarkerIcon(isSimulated: boolean): L.DivIcon {
  const color = isSimulated ? '#f59e0b' : '#06b6d4';
  const glow = isSimulated ? 'rgba(245, 158, 11, 0.65)' : 'rgba(6, 182, 212, 0.7)';
  return L.divIcon({
    className: 'custom-gps-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 18px ${glow};
      ">
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function poiTooltipHtml(
  loc: MapLocation,
  mode: MapInteractionMode,
  isGpsOriginActive: boolean
): string {
  const warn =
    loc.id === 'valorant_masters_arena'
      ? '<div class="poi-tip-warn">⚠️ Sede non ancora annunciata</div>'
      : '';
  const hint =
    mode === 'route'
      ? loc.category === 'alloggio' && !isGpsOriginActive
        ? 'Clicca per impostare come partenza o destinazione'
        : 'Clicca per calcolare il percorso metro fin qui'
      : 'Clicca per i dettagli';
  return `<div class="poi-tip">
    <div class="poi-tip-kicker">${loc.district} · ${loc.city}</div>
    <div class="poi-tip-title">${loc.italianName}</div>
    ${warn}
    <div class="poi-tip-hint">${hint}</div>
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
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsAccuracyCircleRef = useRef<L.Circle | null>(null);

  // Modalità Principale: 'explore' (Esplora Mappa & Legenda) vs 'route' (Calcola Percorso Metro)
  const isMobile = useIsMobileMap();
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  // Foglio trascinabile della versione per telefono
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>(() => (selectedLocationId ? 'mid' : 'peek'));
  const sheetSnapRef = useRef<SheetSnap>(sheetSnap);
  sheetSnapRef.current = sheetSnap;
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellTop, setShellTop] = useState(64);
  const [shellH, setShellH] = useState(0);
  const [shellBottom, setShellBottom] = useState<number | null>(null);
  const [topInset, setTopInset] = useState(116);
  const topInsetRef = useRef(116);
  const handleTopInset = useCallback((px: number) => {
    topInsetRef.current = px;
    setTopInset(px);
  }, []);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const showNotice = useCallback((msg: string) => {
    setMapNotice(msg);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setMapNotice(null), 7000);
  }, []);
  const focusRef = useRef<(latlng: LatLng, zoom: number, snap?: SheetSnap) => void>(() => {});
  const pendingFocusRef = useRef<{ latlng: LatLng; zoom: number } | null>(null);

  const [mapMode, setMapModeState] = useState<MapInteractionMode>('explore');
  /** Cambia modalità; sul telefono porta il foglio all'altezza giusta (percorso: a metà) */
  const setMapMode = useCallback((m: MapInteractionMode) => {
    setMapModeState(m);
    setSheetSnap(m === 'route' ? 'mid' : selectedIdRef.current ? 'mid' : 'peek');
  }, []);
  const [isRealDataOpen, setIsRealDataOpen] = useState<boolean>(false);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeCity, setActiveCity] = useState<string>('all');
  const [activeDay, setActiveDay] = useState<number | 'all'>(initialDayFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentSelectedLoc, setCurrentSelectedLoc] = useState<MapLocation | null>(null);
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark');

  // Stato per il Calcolatore Percorsi Metro (supporta sia i 4 Alloggi sia tutte le Tappe in Corea come destinazioni)
  const accommodations = useMemo(
    () => MAP_LOCATIONS.filter((l) => l.category === 'alloggio'),
    []
  );
  const koreanDestinations = useMemo(
    () =>
      MAP_LOCATIONS.filter(
        (l) => l.city === 'Seul' || l.city === 'Dintorni / Gite'
      ),
    []
  );
  // Qualsiasi punto della Corea del Sud raggiungibile in metro può fare da partenza (oltre ad alloggi e GPS)
  const originCandidates = useMemo(
    () =>
      MAP_LOCATIONS.filter(
        (l) => l.category !== 'alloggio' && (l.city === 'Seul' || l.city === 'Dintorni / Gite')
      ),
    []
  );
  const [selectedOriginId, setSelectedOriginId] = useState<string>(() => accommodations[0]?.id ?? 'acc_a');
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>(
    () => koreanDestinations.find((d) => d.id === 'gyeongbokgung')?.id ?? koreanDestinations[0]?.id ?? ''
  );

  // Stato Geolocalizzazione Dispositivo in Tempo Reale (watchPosition + aggiornamento ogni 5s)
  const [geoState, setGeoState] = useState<LiveGeoState>({
    enabled: false,
    status: 'idle',
    coords: null,
    accuracyMeters: null,
    lastUpdated: null,
    errorMessage: null,
    isSimulated: false,
    simulatedPreset: null
  });
  const watchIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const clearGpsWatchers = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const handleActivateRealGps = useCallback((opts?: { route?: boolean; recenter?: boolean }) => {
    clearGpsWatchers();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState({
        enabled: false,
        status: 'error',
        coords: null,
        accuracyMeters: null,
        lastUpdated: null,
        errorMessage: 'Il tuo browser non supporta la geolocalizzazione.',
        isSimulated: false,
        simulatedPreset: null
      });
      return;
    }

    setGeoState((prev) => ({
      ...prev,
      enabled: true,
      status: 'requesting',
      errorMessage: null,
      isSimulated: false,
      simulatedPreset: null
    }));
    setSelectedOriginId('gps_origin');
    // Il pulsante "posizione" del telefono centra soltanto la mappa; gli altri aprono anche il percorso
    if (opts?.route !== false) setMapMode('route');
    let pendingRecenter = opts?.recenter === true;

    const onPosSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      if (pendingRecenter) {
        pendingRecenter = false;
        const km = L.latLng(lat, lng).distanceTo(L.latLng(37.5568, 126.9738)) / 1000;
        if (km < 120) {
          focusRef.current([lat, lng], 15);
        } else {
          showNotice(
            `Sei a circa ${Math.round(km).toLocaleString('it-IT')} km da Seul. Per provare il percorso apri "Percorso" e simula una posizione a Seul.`
          );
        }
      }
      setGeoState({
        enabled: true,
        status: 'active',
        coords: [lat, lng],
        accuracyMeters: acc,
        lastUpdated: Date.now(),
        errorMessage: null,
        isSimulated: false,
        simulatedPreset: null
      });
    };

    const onPosError = (err: GeolocationPositionError) => {
      let msg = 'Impossibile rilevare la posizione GPS.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Permesso di geolocalizzazione negato nel browser. Puoi comunque usare "Simula posizione a Seul".';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Segnale GPS non disponibile su questo dispositivo.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'Tempo scaduto per la richiesta GPS.';
      }
      setGeoState((prev) => ({
        ...prev,
        enabled: false,
        status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
        errorMessage: msg,
        isSimulated: false,
        simulatedPreset: null
      }));
      showNotice(msg);
    };

    const geoOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 10000
    };

    navigator.geolocation.getCurrentPosition(onPosSuccess, onPosError, geoOpts);
    watchIdRef.current = navigator.geolocation.watchPosition(onPosSuccess, onPosError, geoOpts);

    // Aggiornamento periodico ogni 5 secondi per garantire il refresh continuo del pallino sulla mappa
    pollIntervalRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPosSuccess, () => {}, geoOpts);
    }, 5000);
  }, [clearGpsWatchers, setMapMode, showNotice]);

  const handleActivateSimulatedGps = useCallback(
    (preset: SeoulSimulationPreset) => {
      clearGpsWatchers();
      setGeoState({
        enabled: true,
        status: 'active',
        coords: [preset.lat, preset.lng],
        accuracyMeters: 12,
        lastUpdated: Date.now(),
        errorMessage: null,
        isSimulated: true,
        simulatedPreset: preset
      });
      setSelectedOriginId('gps_origin');
      setMapMode('route');

      // Rinnova il timestamp ogni 5 secondi mantenendo il pallino attivo
      pollIntervalRef.current = window.setInterval(() => {
        setGeoState((prev) =>
          prev.status === 'active' && prev.isSimulated
            ? { ...prev, lastUpdated: Date.now() }
            : prev
        );
      }, 5000);
    },
    [clearGpsWatchers, setMapMode]
  );

  const handleStopGps = useCallback(() => {
    clearGpsWatchers();
    setGeoState({
      enabled: false,
      status: 'idle',
      coords: null,
      accuracyMeters: null,
      lastUpdated: null,
      errorMessage: null,
      isSimulated: false,
      simulatedPreset: null
    });
    setSelectedOriginId((prev) => (prev === 'gps_origin' ? accommodations[0]?.id ?? 'acc_a' : prev));
  }, [clearGpsWatchers, accommodations]);

  useEffect(() => {
    return () => {
      clearGpsWatchers();
    };
  }, [clearGpsWatchers]);

  // Costruisce l'oggetto MapLocation virtuale quando il punto di partenza è la posizione GPS attuale
  const activeOriginLocation: MapLocation = useMemo(() => {
    if (selectedOriginId === 'gps_origin' && geoState.coords) {
      return {
        id: 'gps_origin',
        name: geoState.isSimulated && geoState.simulatedPreset
          ? geoState.simulatedPreset.labelIt
          : 'My Live GPS Position',
        italianName:
          geoState.isSimulated && geoState.simulatedPreset
            ? `Posizione GPS (${geoState.simulatedPreset.labelIt.split(' (')[0]})`
            : 'La mia posizione GPS attuale',
        koreanName: geoState.simulatedPreset?.koreanName ?? '현재 위치',
        category: 'logistica',
        city: 'Seul',
        district:
          geoState.isSimulated && geoState.simulatedPreset
            ? geoState.simulatedPreset.district
            : `GPS Live (±${Math.round(geoState.accuracyMeters ?? 15)}m)`,
        lat: geoState.coords[0],
        lng: geoState.coords[1],
        description: 'Posizione rilevata in tempo reale dal browser per il calcolo del percorso metro più vicino.',
        dayNumbers: []
      };
    }
    return (
      accommodations.find((a) => a.id === selectedOriginId) ??
      MAP_LOCATIONS.find((l) => l.id === selectedOriginId) ??
      accommodations[0]
    );
  }, [selectedOriginId, geoState, accommodations]);

  // Letti dai listener dei segnaposto
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = currentSelectedLoc?.id ?? null;
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;
  const mapModeRef = useRef<MapInteractionMode>(mapMode);
  mapModeRef.current = mapMode;
  const selectedOriginIdRef = useRef<string>(selectedOriginId);
  selectedOriginIdRef.current = selectedOriginId;

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

  // Calcolo in tempo reale della tratta metro quando si è in modalità 'route'
  const currentMetroRoute = useMemo(() => {
    if (mapMode !== 'route' || !metroNetwork) return null;
    const dest =
      MAP_LOCATIONS.find((d) => d.id === selectedDestinationId) ??
      koreanDestinations[0];
    if (!activeOriginLocation || !dest) return null;
    return computeMetroRoute(metroNetwork, activeOriginLocation, dest);
  }, [mapMode, metroNetwork, activeOriginLocation, koreanDestinations, selectedDestinationId]);

  /** Margini della mappa coperti da barra in alto e foglio (solo telefono) con il foglio nella posizione indicata */
  const insetsFor = (snap: SheetSnap) => {
    if (!isMobileRef.current) return { top: 0, bottom: 0 };
    const H = shellRef.current?.clientHeight ?? 0;
    const top = topInsetRef.current;
    return { top, bottom: Math.min(sheetHeight(snap, H, top), Math.round(H * 0.62)) };
  };

  /** Centra la mappa su un punto; sul telefono lo porta al centro della parte non coperta dal foglio */
  const focusLatLng = (latlng: LatLng, zoom: number, snap: SheetSnap = sheetSnapRef.current) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const { top, bottom } = insetsFor(snap);
    const dy = (bottom - top) / 2;
    const base = L.latLng(latlng[0], latlng[1]);
    const target = dy ? map.unproject(map.project(base, zoom).add([0, dy]), zoom) : base;
    map.setView(target, zoom, { animate: true });
  };
  focusRef.current = focusLatLng;

  /** Prima di spostare la mappa da un pannello: se il foglio è tutto aperto lo abbassa, così il punto resta visibile */
  const prepareMapView = () => {
    if (!isMobileRef.current) return;
    let snap = sheetSnapRef.current;
    if (snap === 'full') {
      snap = 'mid';
      setSheetSnap('mid');
    }
    if (metroLayerRef.current) metroLayerRef.current.insets = insetsFor(snap);
  };

  // Sync external selectedLocationId
  useEffect(() => {
    if (selectedLocationId) {
      const loc = MAP_LOCATIONS.find((l) => l.id === selectedLocationId);
      if (loc) {
        if (mapModeRef.current === 'route') {
          if (loc.category === 'alloggio' && selectedOriginIdRef.current !== 'gps_origin') {
            setSelectedOriginId(loc.id);
          } else {
            setSelectedDestinationId(loc.id);
          }
        } else {
          setCurrentSelectedLoc(loc);
          if (isMobileRef.current) setSheetSnap('mid');
          if (mapInstanceRef.current) {
            focusLatLng([loc.lat, loc.lng], 15, 'mid');
          } else {
            // la mappa si crea subito dopo: la vista viene impostata appena è pronta
            pendingFocusRef.current = { latlng: [loc.lat, loc.lng], zoom: 15 };
          }
        }
      }
    }
  }, [selectedLocationId]);

  // Telefono: la mappa occupa lo spazio tra l'intestazione dell'app e la barra in basso
  useLayoutEffect(() => {
    if (!isMobile) return;
    const sticky = document.querySelector('[data-app-sticky]') as HTMLElement | null;
    const bottomNav = document.querySelector('[data-app-bottomnav]') as HTMLElement | null;
    const update = () => {
      setShellTop(Math.round(sticky ? sticky.getBoundingClientRect().bottom : 64));
      // la mappa finisce dove inizia la barra di navigazione in basso
      if (bottomNav) setShellBottom(Math.max(0, Math.round(window.innerHeight - bottomNav.getBoundingClientRect().top)));
      setShellH(shellRef.current?.clientHeight ?? 0);
    };
    update();
    const ro = new ResizeObserver(update);
    if (sticky) ro.observe(sticky);
    if (bottomNav) ro.observe(bottomNav);
    if (shellRef.current) ro.observe(shellRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isMobile]);

  // Telefono: la pagina dietro la mappa non scorre (si muove solo la mappa)
  useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const prev = { overflow: html.style.overflow, over: html.style.overscrollBehavior };
    // la pagina riparte dall'alto, così l'intestazione fissa è al suo posto e la mappa le sta sotto
    window.scrollTo(0, 0);
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prev.overflow;
      html.style.overscrollBehavior = prev.over;
    };
  }, [isMobile]);

  // Sync external day filter if changed
  useEffect(() => {
    if (initialDayFilter !== undefined && initialDayFilter !== null) {
      setActiveDay(initialDayFilter);
    }
  }, [initialDayFilter]);

  // Filtered locations (in modalità 'route' mostra sempre tutti gli alloggi e le tappe della Corea sulla mappa)
  const filteredLocations = useMemo(() => {
    if (mapMode === 'route') {
      return MAP_LOCATIONS.filter(
        (loc) => loc.city === 'Seul' || loc.city === 'Dintorni / Gite' || loc.id === selectedDestinationId
      );
    }
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
  }, [mapMode, activeCategory, activeCity, activeDay, searchQuery, selectedDestinationId]);

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

      if (pendingFocusRef.current) {
        const { latlng, zoom } = pendingFocusRef.current;
        pendingFocusRef.current = null;
        focusRef.current(latlng, zoom, 'mid');
      }
    }
  }, []);

  // La mappa segue le dimensioni del contenitore (rotazione, tastiera, foglio che cambia layout)
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapInstanceRef.current?.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Aggiorna in tempo reale il pallino GPS e il cerchio di precisione sulla mappa SENZA spostare la vista
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (geoState.status === 'active' && geoState.coords) {
      const [lat, lng] = geoState.coords;
      const radius = Math.max(15, Math.min(geoState.accuracyMeters ?? 25, 400));
      const color = geoState.isSimulated ? '#f59e0b' : '#06b6d4';

      if (!gpsAccuracyCircleRef.current) {
        gpsAccuracyCircleRef.current = L.circle([lat, lng], {
          radius,
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.14,
          interactive: false
        }).addTo(map);
      } else {
        gpsAccuracyCircleRef.current.setLatLng([lat, lng]);
        gpsAccuracyCircleRef.current.setRadius(radius);
        gpsAccuracyCircleRef.current.setStyle({ color, fillColor: color });
      }

      const tooltipText = geoState.isSimulated && geoState.simulatedPreset
        ? `Posizione GPS simulata: ${geoState.simulatedPreset.labelIt}`
        : `La tua posizione GPS attuale (±${Math.round(geoState.accuracyMeters ?? 15)}m)`;

      if (!gpsMarkerRef.current) {
        gpsMarkerRef.current = L.marker([lat, lng], {
          icon: makeGpsMarkerIcon(geoState.isSimulated),
          zIndexOffset: 900
        })
          .bindTooltip(tooltipText, {
            direction: 'top',
            offset: [0, -14],
            className: 'poi-tooltip',
            opacity: 1
          })
          .addTo(map);
      } else {
        gpsMarkerRef.current.setLatLng([lat, lng]);
        gpsMarkerRef.current.setIcon(makeGpsMarkerIcon(geoState.isSimulated));
        gpsMarkerRef.current.setTooltipContent(tooltipText);
      }
    } else {
      if (gpsMarkerRef.current) {
        gpsMarkerRef.current.remove();
        gpsMarkerRef.current = null;
      }
      if (gpsAccuracyCircleRef.current) {
        gpsAccuracyCircleRef.current.remove();
        gpsAccuracyCircleRef.current = null;
      }
    }
  }, [geoState]);

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

  // Le inquadrature della metro evitano le parti coperte da barra e foglio (telefono)
  useEffect(() => {
    if (metroLayerRef.current) metroLayerRef.current.insets = insetsFor(sheetSnap);
  }, [isMobile, sheetSnap, shellH, topInset, metroNetwork]);

  // Traccia l'ultima coppia origine/destinazione inquadrata per non spostare la vista a ogni tick GPS di 5 secondi
  const lastFittedKeyRef = useRef<string>('');

  // Isola sulla mappa la tratta metro attiva quando si è in modalità 'route'
  useEffect(() => {
    if (!metroLayerRef.current) return;
    if (mapMode === 'route' && currentMetroRoute) {
      const routeKey = `${selectedOriginId}|${selectedDestinationId}|${
        geoState.isSimulated ? geoState.simulatedPreset?.id ?? 'sim' : 'real'
      }`;
      const shouldAutoFit = lastFittedKeyRef.current !== routeKey && currentMetroRoute.reachable;
      if (shouldAutoFit) {
        lastFittedKeyRef.current = routeKey;
      }
      metroLayerRef.current.setActiveRoute(currentMetroRoute, shouldAutoFit);
    } else {
      lastFittedKeyRef.current = '';
      metroLayerRef.current.setActiveRoute(null, false);
    }
  }, [
    mapMode,
    currentMetroRoute,
    metroNetwork,
    selectedOriginId,
    selectedDestinationId,
    geoState.isSimulated,
    geoState.simulatedPreset
  ]);

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
    if (isStacked() && !isMobileRef.current) mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const revealPanel = () => {
    if (isStacked() && !isMobileRef.current) sidebarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectLineFromPanel = (id: string | null) => {
    selectLine(id);
    if (id) {
      prepareMapView();
      metroLayerRef.current?.fitLine(id);
      revealMap();
    }
  };

  const focusStation = (key: string, lineId?: string) => {
    prepareMapView();
    metroLayerRef.current?.focusStation(key, lineId);
    revealMap();
  };

  const handleFocusRoutePoint = (
    latLng: LatLng,
    zoom = 16,
    stationKey?: string,
    lineId?: string
  ) => {
    prepareMapView();
    if (stationKey && metroLayerRef.current) {
      metroLayerRef.current.focusStation(stationKey, lineId);
    } else {
      focusLatLng(latLng, zoom, sheetSnapRef.current === 'full' ? 'mid' : sheetSnapRef.current);
    }
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

  // Telefono: scegliendo una categoria o un giorno la mappa inquadra i risultati (come una ricerca su Google Maps)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMobileRef.current || mapMode !== 'explore') return;
    if (activeCategory === 'all' && activeDay === 'all') return;
    const inKorea = filteredLocations.filter((l) => l.city === 'Seul' || l.city === 'Dintorni / Gite');
    const pts = (inKorea.length > 0 ? inKorea : filteredLocations).map((l) => [l.lat, l.lng] as LatLng);
    if (pts.length === 0) return;
    const { top, bottom } = insetsFor(sheetSnapRef.current === 'full' ? 'mid' : sheetSnapRef.current);
    map.fitBounds(L.latLngBounds(pts), {
      paddingTopLeft: [28, top + 16],
      paddingBottomRight: [28, bottom + 16],
      maxZoom: 14,
      animate: true
    });
    // solo quando cambiano i filtri scelti dall'utente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeDay]);

  // Segnaposto delle tappe: si ricreano quando cambiano i filtri o la modalità
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const isGpsOriginActive = selectedOriginId === 'gps_origin';

    filteredLocations.forEach((loc) => {
      const routeRole =
        mapMode === 'route'
          ? loc.id === selectedOriginId
            ? 'origin'
            : loc.id === selectedDestinationId
            ? 'destination'
            : 'dimmed'
          : null;

      const marker = L.marker([loc.lat, loc.lng], {
        icon: makeMarkerIcon(loc, selectedIdRef.current === loc.id, routeRole, isMobile),
        zIndexOffset: routeRole === 'origin' || routeRole === 'destination' ? 500 : 0
      });

      // Sul telefono non c'è il passaggio del mouse: i dettagli stanno nel foglio in basso
      if (!isMobile) {
        marker.bindTooltip(poiTooltipHtml(loc, mapMode, isGpsOriginActive), {
          direction: 'top',
          offset: [0, -16],
          className: 'poi-tooltip',
          opacity: 1
        });
      }

      marker.on('click', () => {
        if (mapModeRef.current === 'route') {
          // Se è attiva la posizione GPS come partenza, cliccare qualsiasi pin (inclusi i 4 alloggi) lo imposta come destinazione!
          if (selectedOriginIdRef.current === 'gps_origin') {
            setSelectedDestinationId(loc.id);
          } else if (loc.category === 'alloggio' && loc.id !== selectedOriginIdRef.current) {
            // Permette di scegliere un altro alloggio o impostarlo come partenza
            setSelectedOriginId(loc.id);
          } else {
            setSelectedDestinationId(loc.id);
          }
        } else if (isMobileRef.current) {
          handleSelectLocationRef.current(loc);
        } else {
          selectLocation(loc);
        }
      });

      marker.addTo(map);
      markersRef.current[loc.id] = marker;
    });
  }, [filteredLocations, mapMode, selectedOriginId, selectedDestinationId, isMobile]);

  // Evidenzia il segnaposto selezionato senza ricrearlo (in modalità explore)
  useEffect(() => {
    if (mapMode === 'route') return;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const loc = MAP_LOCATIONS.find((l) => l.id === id);
      if (loc) marker.setIcon(makeMarkerIcon(loc, id === currentSelectedLoc?.id, null, isMobile));
    });
  }, [currentSelectedLoc, mapMode, isMobile]);

  /** Seleziona una tappa (o toglie la selezione con null): aggiorna il riquadro e il segnaposto. */
  const selectLocation = (loc: MapLocation | null) => {
    setCurrentSelectedLoc(loc);
    onSelectRef.current?.(loc);
  };

  const handleSelectLocation = (loc: MapLocation) => {
    selectLocation(loc);
    if (isMobileRef.current) {
      // Telefono: il foglio sale a metà con i dettagli e la tappa resta visibile sopra di esso
      setSheetSnap('mid');
      focusLatLng([loc.lat, loc.lng], 15, 'mid');
    } else {
      mapInstanceRef.current?.setView([loc.lat, loc.lng], 15, { animate: true });
    }
  };
  const handleSelectLocationRef = useRef(handleSelectLocation);
  handleSelectLocationRef.current = handleSelectLocation;

  const closePlace = () => {
    selectLocation(null);
    setSheetSnap('peek');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setActiveCity('all');
    setActiveDay('all');
  };

  /** Pulsante "Percorso" del telefono: se c'è una tappa aperta diventa la destinazione */
  const startRouteFromUi = () => {
    if (
      currentSelectedLoc &&
      (currentSelectedLoc.city === 'Seul' || currentSelectedLoc.city === 'Dintorni / Gite')
    ) {
      setSelectedDestinationId(currentSelectedLoc.id);
    }
    setMapMode('route');
  };

  const handleOriginChange = (id: string) => {
    if (id !== 'gps_origin') {
      setSelectedOriginId(id);
    } else if (geoState.status === 'active') {
      setSelectedOriginId('gps_origin');
    } else {
      handleActivateRealGps({ route: false });
    }
  };

  const handleLocate = () => {
    if (geoState.status === 'active' && geoState.coords) {
      focusLatLng(geoState.coords, 15);
    } else {
      handleActivateRealGps({ route: false, recenter: true });
    }
  };

  const toggleDayChip = (d: number | 'all') => setActiveDay(d);

  /** Passa direttamente alla modalità Calcola Percorso Metro verso una specifica tappa o alloggio */
  const startRouteToLocation = (loc: MapLocation) => {
    if (loc.category === 'alloggio' && selectedOriginId !== 'gps_origin') {
      setSelectedOriginId(loc.id);
    } else {
      setSelectedDestinationId(loc.id);
    }
    setMapMode('route');
  };

  const jumpToView = (viewName: 'seoul' | 'alloggi' | 'hongdae' | 'gite' | 'pechino' | 'tiananmen') => {
    if (!mapInstanceRef.current) return;
    switch (viewName) {
      case 'seoul':
        mapInstanceRef.current.setView([37.5568, 126.9738], 12, { animate: true });
        break;
      case 'alloggi':
        mapInstanceRef.current.setView([37.555, 126.98], 13, { animate: true });
        setActiveCategory('alloggio');
        break;
      case 'hongdae':
        mapInstanceRef.current.setView([37.5568, 126.9238], 15, { animate: true });
        break;
      case 'gite':
        mapInstanceRef.current.setView([37.5, 126.85], 10, { animate: true });
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

  const activeDestObj =
    MAP_LOCATIONS.find((d) => d.id === selectedDestinationId) ?? koreanDestinations[0];

  const routePanelEl = (
    <MetroRoutePanel
    compact={isMobile}
    network={metroNetwork}
    loading={!metroNetwork && !metroError}
    error={metroError}
    onRetry={() => setMetroAttempt((n) => n + 1)}
    accommodations={accommodations}
    destinations={koreanDestinations}
    activeOriginLocation={activeOriginLocation}
    selectedOriginId={selectedOriginId}
    onSelectOrigin={setSelectedOriginId}
    selectedDestinationId={selectedDestinationId}
    onSelectDestination={setSelectedDestinationId}
    currentRoute={currentMetroRoute}
    onFitRoute={() => {
      metroLayerRef.current?.fitActiveRoute();
      metroLayerRef.current?.replayRouteAnimation();
      revealMap();
    }}
    onReplayAnimation={() => {
      metroLayerRef.current?.fitActiveRoute();
      metroLayerRef.current?.replayRouteAnimation();
      revealMap();
    }}
    onFocusPoint={handleFocusRoutePoint}
    geoState={geoState}
    onActivateRealGps={handleActivateRealGps}
    onStopGps={handleStopGps}
    onActivateSimulatedGps={handleActivateSimulatedGps}
  />
  );

  const metroPanelEl = (
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
  );

  const realDataDrawer = (
    <RealMetroDataDrawer
    isOpen={isRealDataOpen}
    onClose={() => setIsRealDataOpen(false)}
    network={metroNetwork}
    onSelectLineOnMap={(lineId) => {
      setMapMode('explore');
      setSidebarTab('metro');
      selectLineFromPanel(lineId);
    }}
  />
  );

  const sourcesSection = (
  <section
    id="fonti-ufficiali-metro"
    className="p-4 rounded-2xl border border-slate-800/90 bg-slate-900/70 space-y-3"
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          Fonti Ufficiali e Riferimenti Verificati · Rete Metropolitana di Seul
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Tutti i dati su linee, numero stazioni, orari prima/ultima corsa, frequenze medie, tariffe T-money / Climate Card e tracciati ferroviari sono reali e verificati presso gli enti gestori ufficiali:
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setIsRealDataOpen(true);
          if (isMobile) document.getElementById('map-data-overlay')?.scrollTo({ top: 0, behavior: 'smooth' });
          else window.scrollTo({ top: 320, behavior: 'smooth' });
        }}
        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold shrink-0 whitespace-nowrap"
      >
        Apri tabella dati reali ↑
      </button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
      {OFFICIAL_METRO_SOURCES.map((source) => (
        <a
          key={source.id}
          href={source.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 hover:border-cyan-500/40 transition-colors flex flex-col justify-between gap-1.5 group"
        >
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                {source.organizationIt}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {source.organizationKo} · {source.organizationEn}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug pt-0.5">{source.roleIt}</p>
          </div>
          <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900 flex items-center justify-between">
            <span className="truncate">{source.officialUrl.replace(/^https?:\/\//, '')}</span>
            <span className="shrink-0 text-emerald-400">Verificato {source.verifiedDate}</span>
          </div>
        </a>
      ))}
    </div>
  </section>
  );

  return (
    <div className={isMobile ? undefined : 'space-y-3'}>
      {/* BARRA ESTERNA SOPRA LA MAPPA: MENU DATI REALI A TENDINA A SINISTRA + SWITCH MODALITÀ */}
      {!isMobile && (
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl border border-slate-800 bg-slate-900/95">
        <div className="flex flex-wrap items-center gap-2">
          {/* Pulsante a sinistra per aprire il menu a tendina con i Dati Reali verificati della Metro di Seul */}
          <button
            type="button"
            onClick={() => setIsRealDataOpen((v) => !v)}
            aria-expanded={isRealDataOpen}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 ${
              isRealDataOpen
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                : 'bg-slate-950 text-emerald-300 border-emerald-500/40 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Dati Reali Metro Seul</span>
            {isRealDataOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Segmented control Esplora vs Calcola Percorso Metro */}
          <div className="grid grid-cols-2 sm:flex w-full sm:w-auto items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMapMode('explore')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                mapMode === 'explore'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="sm:hidden">Esplora mappa</span>
              <span className="hidden sm:inline">Esplora Mappa & Legenda</span>
            </button>
            <button
              type="button"
              onClick={() => setMapMode('route')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                mapMode === 'route'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Route className="w-4 h-4" />
              <span className="sm:hidden">Percorso metro</span>
              <span className="hidden sm:inline">Calcola Percorso Metro</span>
            </button>
          </div>

          {/* Pulsante rapido Attiva Posizione GPS nella barra superiore */}
          <button
            type="button"
            onClick={() => {
              if (geoState.status === 'active' && selectedOriginId === 'gps_origin') {
                if (geoState.coords) handleFocusRoutePoint(geoState.coords, 15);
              } else {
                handleActivateRealGps();
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 ${
              geoState.status === 'active'
                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 hover:bg-cyan-900/60'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {geoState.status === 'active'
                ? geoState.isSimulated
                  ? 'GPS Simulato Attivo'
                  : 'GPS Live Attivo'
                : 'Usa Mia Posizione GPS'}
            </span>
          </button>
        </div>

        {/* Stato sintetico contestuale nella barra superiore */}
        <div className="text-xs text-slate-400 flex items-center gap-2 truncate px-1">
          {mapMode === 'route' && activeOriginLocation && activeDestObj ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-300 font-semibold whitespace-nowrap">
                {originLabel(activeOriginLocation)}
              </span>
              <span aria-hidden="true">→</span>
              <span className="text-cyan-300 font-semibold truncate">{activeDestObj.italianName}</span>
            </div>
          ) : (
            <span className="truncate">
              Attiva &ldquo;Calcola Percorso Metro&rdquo; o &ldquo;Usa Mia Posizione GPS&rdquo; per trovare la metro più vicina
            </span>
          )}
        </div>
      </div>
      )}

      {/* MENU A TENDINA SULLA SINISTRA CON I DATI REALI DELLA METRO DI SEUL */}
      {!isMobile && realDataDrawer}

      {/* CONTENITORE PRINCIPALE MAPPA + SIDEBAR */}
      <div
        ref={shellRef}
        className={
          isMobile
            ? 'map-shell-mobile fixed inset-x-0 z-40 isolate overflow-hidden bg-slate-950 overscroll-contain'
            : 'flex flex-col lg:flex-row lg:h-[860px] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl relative'
        }
        style={
          isMobile
            ? { top: shellTop, bottom: shellBottom ?? 'calc(4rem + env(safe-area-inset-bottom))' }
            : undefined
        }
      >
        {/* Sidebar Controls & Location Directory / Route Planner */}
        {!isMobile && (
        <div
          ref={sidebarRef}
          className="order-2 lg:order-none w-full lg:w-[430px] h-[640px] lg:h-auto flex flex-col bg-slate-900/95 border-t lg:border-t-0 lg:border-r border-slate-800 backdrop-blur-md z-10 shrink-0"
        >
          {/* Intestazione Pannello & Switcher Tema Mappa */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                {mapMode === 'route' ? (
                  <>
                    <Route className="w-4 h-4 text-cyan-400" />
                    <span>Navigatore Metro Seul (GPS / Alloggio → Tappa)</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span>Mappa Seul (Nomi in Inglese · Google Maps)</span>
                  </>
                )}
              </div>

              {/* REAL Working Map Theme Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  onClick={() => setMapTheme('dark')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    mapTheme === 'light'
                      ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mappa chiara completa"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Chiara</span>
                </button>
              </div>
            </div>

            {mapMode === 'explore' && sidebarTab === 'places' && (
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

            {mapMode === 'explore' && (
              /* Quick preset jumps */
              <div className="flex flex-wrap gap-1.5 text-xs pt-0.5">
                <button
                  onClick={() => jumpToView('alloggi')}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-bold transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>4 Alloggi Enko</span>
                </button>
                <button
                  onClick={() => jumpToView('seoul')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium whitespace-nowrap"
                >
                  Panoramica Seul
                </button>
                <button
                  onClick={() => jumpToView('hongdae')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors font-medium whitespace-nowrap"
                >
                  Hongdae
                </button>
                <button
                  onClick={() => jumpToView('gite')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 transition-colors font-medium whitespace-nowrap"
                >
                  Gite Esterne
                </button>
                <button
                  onClick={() => jumpToView('pechino')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors font-medium whitespace-nowrap"
                >
                  Scalo Pechino
                </button>
                <button
                  onClick={() => jumpToView('tiananmen')}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 transition-colors font-bold flex items-center gap-1 shadow-sm whitespace-nowrap"
                  title="Vola direttamente alla Piazza Tiananmen"
                >
                  <span>🇨🇳 Piazza Tiananmen</span>
                </button>
              </div>
            )}
          </div>

          {mapMode === 'route' ? (
            /* MODALITÀ CALCOLO PERCORSO METRO */
            routePanelEl
          ) : (
            /* MODALITÀ ESPLORA MAPPA & LEGENDA */
            <>
              {/* Tappe / Metro */}
              <div className="px-4 pt-3 pb-2 border-b border-slate-800" role="tablist" aria-label="Contenuto del pannello">
                <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    role="tab"
                    aria-selected={sidebarTab === 'places'}
                    onClick={() => setSidebarTab('places')}
                    className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      sidebarTab === 'places' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" /> Tappe
                  </button>
                  <button
                    role="tab"
                    aria-selected={sidebarTab === 'metro'}
                    onClick={() => setSidebarTab('metro')}
                    className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      sidebarTab === 'metro' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <TrainFront className="w-3.5 h-3.5" /> Metro & AREX
                    {metroNetwork && (
                      <span className="text-[10px] font-mono tabular-nums text-slate-500">
                        {metroVisible.size}/{metroNetwork.lines.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {sidebarTab === 'metro' ? (
                metroPanelEl
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          activeCategory === 'alloggio'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                            : 'bg-blue-950/40 text-blue-300 border border-blue-500/30 hover:bg-blue-900/50'
                        }`}
                      >
                        🏠 Alloggi ({MAP_LOCATIONS.filter((l) => l.category === 'alloggio').length})
                      </button>

                      <button
                        onClick={() => setActiveCategory('cultura')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          activeCategory === 'cultura'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        🏯 Cultura
                      </button>
                      <button
                        onClick={() => setActiveCategory('nightlife')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          activeCategory === 'nightlife'
                            ? 'bg-pink-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        🍸 Nightlife
                      </button>
                      <button
                        onClick={() => setActiveCategory('food')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          activeCategory === 'food'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        🍜 Food & Mercati
                      </button>
                      <button
                        onClick={() => setActiveCategory('natura')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          activeCategory === 'natura'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        🌲 Parchi & Hike
                      </button>
                      <button
                        onClick={() => setActiveCategory('gita')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
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
                        <option value="3">4 Mar · Palazzi in Hanbok, Bukchon & Sinchon</option>
                        <option value="4">5 Mar · Seongsu-dong, Seoul Forest & Club</option>
                        <option value="5">6 Mar · Itaewon (Relax & Serata Cosmopolita)</option>
                        <option value="6">7 Mar · Gwangjang, DDP & Saluto a Pietro (Noraebang)</option>
                        <option value="7">8 Mar · Rientro Pietro a Milano, Namsan & Myeongdong</option>
                        <option value="8">9 Mar · Museo Nazionale & Kondae (Konkuk)</option>
                        <option value="9">10 Mar · Gita Incheon (Chinatown & Wolmido)</option>
                        <option value="10">11 Mar · COEX (Starfield Library), Bongeunsa & Gangnam</option>
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
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono max-w-[125px] truncate text-right">
                              {loc.district}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 pl-6">
                            {loc.description}
                          </p>

                          {isValorant && (
                            <div className="mt-1 pl-6 text-[10px] text-red-400 font-bold flex items-center gap-1">
                              <span>⚠️ Sede TBD: Riot Games deve ancora annunciare l&apos;arena</span>
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
            </>
          )}
        </div>
        )}

        {/* Map Canvas */}
        <div
          className={
            isMobile
              ? 'absolute inset-0 isolate'
              : 'isolate order-1 lg:order-none lg:flex-1 h-[62vh] min-h-[360px] max-h-[560px] lg:h-full lg:max-h-none relative'
          }
        >
          <div ref={mapContainerRef} className="w-full h-full" />

          {!isMobile && (
          <>

          {/* Interruttore rapido delle linee metro (solo in modalità Esplora) */}
          {metroNetwork && mapMode === 'explore' && (
            <button
              onClick={toggleAllMetro}
              aria-pressed={metroVisible.size > 0}
              className={`absolute top-4 right-4 z-[400] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-md shadow-xl transition-colors whitespace-nowrap ${
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

          {/* Badge informativo in alto sulla mappa in modalità Calcola Percorso Metro */}
          {mapMode === 'route' && currentMetroRoute && (
            <div className="absolute top-4 left-4 right-4 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="bg-slate-900/95 border border-slate-700 rounded-xl px-3.5 py-2 backdrop-blur-md text-xs shadow-xl flex items-center gap-2.5 pointer-events-auto">
                <Route className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {originLabel(currentMetroRoute.origin)}{' '}
                    → {currentMetroRoute.destination.italianName}
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono tabular-nums">
                    {currentMetroRoute.reachable
                      ? `~${currentMetroRoute.estimatedTotalMinutes} min · ${currentMetroRoute.totalStops} fermate · ${
                          currentMetroRoute.totalTransfers === 0
                            ? 'Diretto senza cambi'
                            : `${currentMetroRoute.totalTransfers} ${
                                currentMetroRoute.totalTransfers === 1 ? 'cambio' : 'cambi'
                              }`
                        }`
                      : currentMetroRoute.originOutOfMetroCoverage
                      ? 'Posizione GPS fuori dalla copertura della metro di Seul'
                      : 'Nessuna tratta metro disponibile'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Floating Day / Selected Line badge (in modalità Esplora) */}
          {mapMode === 'explore' && (
            <div className="absolute top-4 left-4 z-[400] flex flex-wrap gap-2 max-w-[calc(100%-11rem)]">
              {selectedLineDef && (
                <div
                  className="bg-slate-900/95 border rounded-xl pl-2 pr-1 py-1 backdrop-blur-md text-xs shadow-xl flex items-center gap-2"
                  style={{ borderColor: `${selectedLineDef.color}aa` }}
                >
                  <LineBadge line={selectedLineDef} size="sm" />
                  <span className="font-semibold text-white">{selectedLineDef.it}</span>
                  <span className="text-[10px] text-slate-400 font-mono tabular-nums">
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
                        const matchedDay = ITINERARY_DAYS.find((d) => d.id === activeDay);
                        return matchedDay ? ` · ${matchedDay.title}` : '';
                      })()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                      · {filteredLocations.length} tappe
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
          )}

          {/* Selected location detail banner on bottom overlay (in modalità Esplora) */}
          {mapMode === 'explore' && currentSelectedLoc && (
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
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide">
                    {currentSelectedLoc.district} · {currentSelectedLoc.city}
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {currentSelectedLoc.italianName}
                    {currentSelectedLoc.koreanName ? (
                      <span className="text-xs font-normal text-slate-400 ml-1.5">
                        ({currentSelectedLoc.koreanName})
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                    {currentSelectedLoc.description}
                  </p>
                  {currentSelectedLoc.mustTry && (
                    <div className="text-xs text-amber-300 mt-1.5 font-medium">
                      💡 Specialità: {currentSelectedLoc.mustTry}
                    </div>
                  )}
                  {(currentSelectedLoc.city === 'Seul' ||
                    currentSelectedLoc.city === 'Dintorni / Gite') && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDestinationId(currentSelectedLoc.id);
                          setMapMode('route');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Calcola Percorso Metro fin qui</span>
                      </button>
                      {currentSelectedLoc.category === 'alloggio' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOriginId(currentSelectedLoc.id);
                            setMapMode('route');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Home className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Imposta come partenza</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <a
                    href={getNaverMapSearchUrl(currentSelectedLoc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    title={currentSelectedLoc.koreanName ? `Cerca "${currentSelectedLoc.koreanName}" su Naver Map` : 'Cerca su Naver Map'}
                  >
                    <span>Naver Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${currentSelectedLoc.lat},${currentSelectedLoc.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* VERSIONE PER TELEFONO: ricerca, chip, pulsanti e foglio trascinabile sopra la mappa a tutto schermo */}
        {isMobile && (
          <>
            <MobileMapOverlay
              shellH={shellH}
              topInset={topInset}
              onTopInset={handleTopInset}
              snap={sheetSnap}
              onSnap={setSheetSnap}
              mapMode={mapMode}
              onExitRoute={() => setMapMode('explore')}
              onStartRoute={startRouteFromUi}
              searchQuery={searchQuery}
              onSearchQuery={setSearchQuery}
              activeCategory={activeCategory}
              onCategory={(c) => setActiveCategory((prev) => (prev === c ? 'all' : c))}
              activeDay={activeDay}
              onDay={toggleDayChip}
              onResetFilters={resetFilters}
              places={filteredLocations}
              selected={currentSelectedLoc}
              onPickPlace={handleSelectLocation}
              onClosePlace={closePlace}
              onRouteTo={(loc) => {
                setSelectedDestinationId(loc.id);
                setMapMode('route');
              }}
              onRouteFrom={(loc) => {
                setSelectedOriginId(loc.id);
                setMapMode('route');
              }}
              sheetTab={sidebarTab}
              onSheetTab={setSidebarTab}
              metroReady={Boolean(metroNetwork)}
              metroVisibleCount={metroVisible.size}
              metroLineCount={metroNetwork?.lines.length ?? 0}
              onToggleAllMetro={toggleAllMetro}
              selectedLine={selectedLineDef}
              selectedLineStations={selectedLineDef ? lineStationKeys(selectedLineDef).length : 0}
              onClearLine={() => setSelectedLine(null)}
              onShowLineStations={() => {
                setSidebarTab('metro');
                setSheetSnap('mid');
              }}
              mapTheme={mapTheme}
              onMapTheme={setMapTheme}
              showGoogleLines={showGoogleLines}
              onToggleGoogleLines={() => setShowGoogleLines((v) => !v)}
              onOpenRealData={() => setIsRealDataOpen(true)}
              geoState={geoState}
              onLocate={handleLocate}
              notice={mapNotice}
              accommodations={accommodations}
              origins={originCandidates}
              destinations={koreanDestinations}
              originId={activeOriginLocation.id}
              destinationId={selectedDestinationId}
              onOrigin={handleOriginChange}
              onDestination={setSelectedDestinationId}
              route={currentMetroRoute}
              onFitRoute={() => {
                prepareMapView();
                metroLayerRef.current?.fitActiveRoute();
                metroLayerRef.current?.replayRouteAnimation();
              }}
              metroPanel={metroPanelEl}
              routePanel={routePanelEl}
            />

            {isRealDataOpen && (
              <div id="map-data-overlay" className="absolute inset-0 z-[600] overflow-y-auto overscroll-contain bg-slate-950 p-3 space-y-3">
                {realDataDrawer}
                {sourcesSection}
              </div>
            )}
          </>
        )}
      </div>

      {/* SEZIONE FONTI UFFICIALI E VERIFICATE A FONDO MAPPA */}
      {!isMobile && sourcesSection}
    </div>
  );
};
