import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { categoryIconSvg } from './categoryIcons';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Footprints,
  Calendar,
  ChevronDown,
  Crosshair,
  ExternalLink,
  Home,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  Navigation,
  Search,
  Sun,
  TrainFront,
  X
} from 'lucide-react';
import { ITINERARY_DAYS, getNaverMapSearchUrl, type MapLocation } from '../../data/tripData';
import type { MetroLine } from '../../data/seoulMetro';
import type { MetroRouteResult } from '../../data/metroRouter';
import { CATEGORY_LABEL, CATEGORY_STYLE, mobileCategoryColor } from './categoryStyle';
import { LineBadge } from './MetroPanel';
import type { LiveGeoState } from './MetroRoutePanel';
import type { LatLng } from '../../data/seoulMetro';
import { WalkSteps, WalkTop, type WalkState } from '../../map/WalkPanel';
import { distanceMeters, formatMeters, formatMinutes, walkMinutes } from '../../map/geo';
import { kakaoMapUrl } from '../../map/searchIndex';

/* ─────────────────────────────────────────────────────────────────────────────
 * Mappa per telefono: mappa a tutto schermo con barra di ricerca e chip in alto,
 * pulsanti flottanti e un foglio trascinabile in basso (stile Google Maps).
 * ───────────────────────────────────────────────────────────────────────────── */

export type SheetSnap = 'peek' | 'mid' | 'full';

/** Altezza del foglio chiuso: maniglia + intestazione */
export const PEEK_PX = 156;

/** Altezze (px) del foglio nelle tre posizioni, in base allo spazio disponibile */
export function sheetHeight(snap: SheetSnap, shellH: number, topInset: number): number {
  // telefono in orizzontale: lo spazio è poco, il foglio chiuso si riduce alla sola maniglia con le schede
  const peek = isShortShell(shellH) ? 76 : PEEK_PX;
  const full = Math.max(peek + 70, shellH - topInset - 8);
  const mid = Math.min(full - 30, Math.max(peek + 70, Math.round(shellH * 0.5)));
  return snap === 'peek' ? peek : snap === 'mid' ? mid : full;
}

export const isShortShell = (shellH: number) => shellH > 0 && shellH < 380;

const MOBILE_QUERY = '(max-width: 1023px)';

/** Vero sotto i 1024 px: la stessa soglia della barra di navigazione in basso */
export function useIsMobileMap(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

const CHIP_CATEGORIES = [
  { id: 'alloggio', label: 'Alloggi', emoji: '' },
  { id: 'cultura', label: 'Cultura', emoji: '' },
  { id: 'food', label: 'Cibo', emoji: '' },
  { id: 'nightlife', label: 'Vita notturna', emoji: '' },
  { id: 'natura', label: 'Parchi', emoji: '' },
  { id: 'gita', label: 'Gite', emoji: '' }
];

const DEST_GROUP_ORDER = ['alloggio', 'luogo', 'cultura', 'food', 'nightlife', 'natura', 'gita', 'logistica'];
const ORIGIN_GROUP_ORDER = DEST_GROUP_ORDER.filter((c) => c !== 'alloggio');

const dayShort = (id: number): string => {
  const d = ITINERARY_DAYS.find((x) => x.id === id);
  if (!d) return `Giorno ${id + 1}`;
  const [n, m = ''] = d.dateStr.split(' ');
  return `${n} ${m.slice(0, 3)}`;
};

// Chip a testo (come le schede): nessuna cornice, voce attiva sottolineata in ciano
const chipBase =
  'h-11 text-[14.5px] whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 text-[#eaf0f6] [text-shadow:0_1px_6px_#0a1119] transition-colors active:opacity-70';
const chipOff = '';
const chipOn = 'font-semibold shadow-[inset_0_-2px_0_#52d9e6]';

const fabClass =
  'w-12 h-12 rounded-2xl bg-[#152231] shadow-[0_2px_10px_rgba(0,0,0,0.35)] flex items-center justify-center text-[#eaf0f6] active:opacity-70 pointer-events-auto';

const pillPrimary =
  'h-11 px-4 rounded-xl bg-[#52d9e6] text-[#04242a] text-[15px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:opacity-80';
const pillSecondary =
  'h-11 px-4 rounded-xl bg-[rgba(96,150,214,0.13)] text-[#eaf0f6] text-[15px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:opacity-80';

const dotColor = mobileCategoryColor;

export interface MobileMapOverlayProps {
  shellH: number;
  topInset: number;
  onTopInset: (px: number) => void;
  snap: SheetSnap;
  onSnap: (s: SheetSnap) => void;

  mapMode: 'explore' | 'route' | 'walk';
  onExitRoute: () => void;
  onStartRoute: () => void;

  /** Barra di ricerca unica (MapSearch) e, quando è aperta, il suo pannello: sostituiscono il vecchio campo */
  searchSlot: React.ReactNode;
  searchOpen: boolean;
  /** Dove sei, se il GPS è attivo: per distanze e minuti a piedi */
  here: LatLng | null;
  onWalkTo: (loc: MapLocation) => void;
  /** Presente solo per i posti non ancora nostri (stazioni, risultati, punti sulla mappa) */
  onSavePlace?: (loc: MapLocation) => void;
  nearbyPanel: React.ReactNode;
  walk: WalkState | null;
  onExitWalk: () => void;
  onEnableGps: () => void;
  onToggleFollow: () => void;

  searchQuery: string;
  onSearchQuery: (q: string) => void;
  activeCategory: string;
  onCategory: (c: string) => void;
  activeDay: number | 'all';
  onDay: (d: number | 'all') => void;
  onResetFilters: () => void;
  /** Luoghi aggiunti dal gruppo: cosa mostrare sulla mappa */
  placesFilter: 'all' | 'stops' | 'added' | 'todo';
  onPlacesFilter: (f: 'all' | 'stops' | 'added' | 'todo') => void;
  addedCount: number;

  places: MapLocation[];
  selected: MapLocation | null;
  onPickPlace: (loc: MapLocation) => void;
  onClosePlace: () => void;
  onRouteTo: (loc: MapLocation) => void;
  onRouteFrom: (loc: MapLocation) => void;

  sheetTab: 'nearby' | 'places' | 'metro';
  onSheetTab: (t: 'nearby' | 'places' | 'metro') => void;
  metroReady: boolean;
  /** Sfondo offline (OpenFreeMap) al posto di Google */
  offlineBg?: boolean;
  metroVisibleCount: number;
  metroLineCount: number;
  onToggleAllMetro: () => void;
  selectedLine: MetroLine | undefined;
  selectedLineStations: number;
  onClearLine: () => void;
  onShowLineStations: () => void;

  mapTheme: 'dark' | 'light';
  onMapTheme: (t: 'dark' | 'light') => void;
  showGoogleLines: boolean;
  onToggleGoogleLines: () => void;
  onOpenRealData: () => void;

  geoState: LiveGeoState;
  onLocate: () => void;
  notice: string | null;

  accommodations: MapLocation[];
  origins: MapLocation[];
  destinations: MapLocation[];
  avoidArex: boolean;
  onToggleAvoidArex: () => void;
  originId: string;
  destinationId: string;
  onOrigin: (id: string) => void;
  onDestination: (id: string) => void;
  route: MetroRouteResult | null;
  onFitRoute: () => void;

  metroPanel: React.ReactNode;
  routePanel: React.ReactNode;
}

/** Campo a tendina nativo (sul telefono si apre il selettore del sistema) */
const SelectField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}> = ({ value, onChange, label, children }) => (
  <div className="relative">
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 appearance-none rounded-xl bg-[rgba(96,150,214,0.13)] pl-3 pr-9 text-[15px] text-[#eaf0f6] focus:outline-none focus:shadow-[inset_0_0_0_1.5px_#52d9e6] truncate"
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#97a5b9] pointer-events-none" />
  </div>
);

const PlaceRow: React.FC<{ loc: MapLocation; onPick: () => void }> = ({ loc, onPick }) => {
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full block px-5 py-3 text-left border-t border-[rgba(234,240,246,.11)] first:border-t-0 active:bg-[rgba(234,240,246,.05)]"
    >
      <span className="block min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-[Outfit] text-[18px] font-medium tracking-[-0.01em] text-[#eaf0f6] truncate">{loc.italianName}</span>
          <span className="text-[13px] text-[#97a5b9] shrink-0 max-w-[40%] truncate">{loc.district}</span>
        </span>
        <span className="block text-[14px] text-[#97a5b9] mt-0.5">
          <span className="font-semibold" style={{ color: dotColor(loc.category) }}>
            {CATEGORY_LABEL[loc.category] ?? loc.category}
          </span>
          {loc.city !== 'Seul' ? ` · ${loc.city}` : ''}
        </span>
        <span className="block text-[14px] text-[#97a5b9] line-clamp-2 mt-1">{loc.description}</span>
        {loc.mustTry && <span className="block text-[13px] text-[#fbbf24] mt-1">{loc.mustTry}</span>}
        {loc.id === 'valorant_masters_arena' && (
          <span className="block text-[13px] text-[#fbbf24] font-semibold mt-1">Sede non ancora annunciata</span>
        )}
      </span>
    </button>
  );
};

export const MobileMapOverlay: React.FC<MobileMapOverlayProps> = (p) => {
  const topRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [layersOpen, setLayersOpen] = useState(false);

  // Altezza del blocco in alto (ricerca + chip, oppure percorso): serve al foglio e alle inquadrature
  const { onTopInset } = p;
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const report = () => onTopInset(Math.ceil(el.getBoundingClientRect().height));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onTopInset]);

  // Cambiando modalità si chiude il menu dei livelli
  useEffect(() => setLayersOpen(false), [p.mapMode]);

  const h = sheetHeight(p.snap, p.shellH, p.topInset);
  const heights = {
    peek: sheetHeight('peek', p.shellH, p.topInset),
    mid: sheetHeight('mid', p.shellH, p.topInset),
    full: sheetHeight('full', p.shellH, p.topInset)
  };
  const SHEET_TRANSITION = 'height 260ms cubic-bezier(0.2, 0.8, 0.2, 1)';
  const DOCK_TRANSITION = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms';

  /* ── Trascinamento del foglio: sulla maniglia e sull'intestazione ── */
  // I movimenti si ascoltano su window: col mouse il puntatore esce subito dal foglio e andrebbe perso
  const applyHeight = (px: number) => {
    if (sheetRef.current) sheetRef.current.style.height = `${px}px`;
    if (dockRef.current) dockRef.current.style.transform = `translateY(${-px}px)`;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || (e.target as HTMLElement).closest('[data-no-drag]')) return;
    const onHandle = Boolean((e.target as HTMLElement).closest('[data-handle]'));
    const startY = e.clientY;
    const startH = sheetRef.current?.getBoundingClientRect().height ?? h;
    let lastY = startY;
    let lastT = performance.now();
    let v = 0; // px/ms, positivo = verso l'alto
    let active = false;

    const move = (ev: PointerEvent) => {
      const dy = startY - ev.clientY;
      if (!active) {
        if (Math.abs(dy) < 6) return;
        active = true;
        if (sheetRef.current) sheetRef.current.style.transition = 'none';
        if (dockRef.current) dockRef.current.style.transition = 'none';
      }
      const now = performance.now();
      v = (lastY - ev.clientY) / Math.max(1, now - lastT);
      lastY = ev.clientY;
      lastT = now;
      applyHeight(Math.max(heights.peek - 24, Math.min(heights.full, startH + dy)));
    };

    const finish = (cancelled: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (!active) {
        // un semplice tocco sulla maniglia: apre di un passo
        if (!cancelled && onHandle) p.onSnap(p.snap === 'peek' ? 'mid' : p.snap === 'mid' ? 'full' : 'mid');
        return;
      }
      const cur = sheetRef.current?.getBoundingClientRect().height ?? h;
      const projected = cur + v * 180;
      const order: SheetSnap[] = ['peek', 'mid', 'full'];
      let best: SheetSnap = 'peek';
      for (const sn of order) if (Math.abs(heights[sn] - projected) < Math.abs(heights[best] - projected)) best = sn;
      if (sheetRef.current) sheetRef.current.style.transition = SHEET_TRANSITION;
      if (dockRef.current) dockRef.current.style.transition = DOCK_TRANSITION;
      applyHeight(heights[best]);
      p.onSnap(best);
    };
    const up = () => finish(false);
    const cancel = () => finish(true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const searching = p.searchQuery.trim() !== '';
  const inRoute = p.mapMode === 'route';
  const inWalk = p.mapMode === 'walk' && p.walk !== null;
  const dockHidden = p.snap === 'full';
  // I pulsanti seguono il foglio, ma spariscono se non c'è più spazio sotto il pulsante dei livelli
  const fabStackH = inRoute ? 190 : 206;
  // in Esplora i pulsanti ci sono sempre a foglio chiuso; in Percorso solo se resta spazio sotto il pulsante dei livelli
  const fabsFit = !inRoute && p.snap === 'peek' ? true : p.shellH - p.topInset - (inRoute ? 60 : 8) - h >= fabStackH;

  /* ── Intestazione del foglio ── */
  let header: React.ReactNode;
  let body: React.ReactNode;

  if (inWalk && p.walk) {
    header = (
      <div className="px-5 pb-3">
        <p className="font-[Outfit] text-[17px] font-medium text-[#eaf0f6]">Svolte</p>
        <p className="text-[13px] text-[#97a5b9]">
          {p.walk.route && !p.walk.route.estimated ? 'Percorso su strada da OpenStreetMap' : 'Linea diretta, tempo stimato'}
        </p>
      </div>
    );
    body = <WalkSteps w={p.walk} />;
  } else if (inRoute) {
    const r = p.route;
    header = (
      <div className="px-5 pb-3 min-h-[84px]">
        {!r ? (
          <div className="text-[15px] text-[#97a5b9] pt-2">Calcolo del percorso metro…</div>
        ) : r.reachable ? (
          <>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="font-[Outfit] text-[28px] font-medium leading-none text-[#eaf0f6] tabular-nums">~{r.estimatedTotalMinutes} min</span>
              <span className="text-[14px] text-[#97a5b9]">
                {r.totalStops} {r.totalStops === 1 ? 'fermata' : 'fermate'} ·{' '}
                {r.totalTransfers === 0 ? 'diretto' : `${r.totalTransfers} ${r.totalTransfers === 1 ? 'cambio' : 'cambi'}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {r.segments.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-[#97a5b9] text-xs">→</span>}
                  <LineBadge line={s.line} />
                </React.Fragment>
              ))}
              <span className="text-[13px] text-[#97a5b9] ml-1">{r.totalWalkMeters} m a piedi</span>
            </div>
          </>
        ) : (
          <div className="text-[15px] text-[#fbbf24] pt-2 leading-snug">
            {r.originOutOfMetroCoverage
              ? 'La tua posizione è fuori dalla metro di Seul: apri il foglio per simulare una posizione a Seul.'
              : 'Nessuna tratta metro disponibile per questa tappa.'}
          </div>
        )}
      </div>
    );
    body = <div className="ms-skin flex flex-col flex-1 min-h-0">{p.routePanel}</div>;
  } else if (p.selected) {
    const loc = p.selected;
    const canRoute = loc.city === 'Seul' || loc.city === 'Dintorni / Gite';
    const days = ITINERARY_DAYS.filter((d) => loc.dayNumbers.includes(d.id));
    const meters = p.here ? distanceMeters(p.here, [loc.lat, loc.lng]) : null;
    header = (
      <div className="pb-3">
        <div className="px-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-[Outfit] text-[21px] font-medium leading-tight tracking-[-0.01em] text-[#eaf0f6]">{loc.italianName}</h2>
            <p className="text-[14px] text-[#97a5b9] mt-0.5">
              <span className="font-semibold" style={{ color: mobileCategoryColor(loc.category) }}>
                {CATEGORY_LABEL[loc.category] ?? loc.category}
              </span>{' '}
              · {loc.district} · {loc.city}
            </p>
            {meters !== null && (
              <p className="text-[14px] text-[#eaf0f6] mt-1 tabular-nums" data-testid="place-distance">
                {formatMeters(meters)} · circa {formatMinutes(walkMinutes(meters * 1.25))} a piedi
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={p.onClosePlace}
            aria-label="Chiudi dettagli tappa"
            className="w-11 h-11 -mr-3 -mt-1 text-[#97a5b9] flex items-center justify-center shrink-0 active:opacity-70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div data-no-drag className="flex gap-2 overflow-x-auto scrollbar-none px-5 mt-3 touch-pan-x">
          {canRoute && (
            <button type="button" onClick={() => p.onWalkTo(loc)} className={pillPrimary} data-testid="place-walk">
              <Footprints className="w-4 h-4" /> Vai a piedi
            </button>
          )}
          {canRoute && (
            <button type="button" onClick={() => p.onRouteTo(loc)} className={pillSecondary} data-testid="place-metro">
              <TrainFront className="w-4 h-4 text-cyan-400" /> Metro
            </button>
          )}
          {p.onSavePlace && (
            <button type="button" onClick={() => p.onSavePlace?.(loc)} className={pillSecondary} data-testid="place-save">
              <Bookmark className="w-4 h-4 text-cyan-400" /> Salva
            </button>
          )}
          {canRoute && (
            <button type="button" onClick={() => p.onRouteFrom(loc)} className={pillSecondary}>
              {loc.category === 'alloggio' ? (
                <Home className="w-4 h-4 text-cyan-400" />
              ) : (
                <MapPin className="w-4 h-4 text-cyan-400" />
              )}{' '}
              Partenza
            </button>
          )}
          <a href={getNaverMapSearchUrl(loc)} target="_blank" rel="noopener noreferrer" className={pillSecondary}>
            Naver <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a href={kakaoMapUrl(loc)} target="_blank" rel="noopener noreferrer" className={pillSecondary}>
            Kakao <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className={pillSecondary}
          >
            Google <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    );
    body = (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 space-y-4">
        {loc.id === 'valorant_masters_arena' && (
          <p className="text-[14px] text-[#fbbf24] font-semibold">
            Sede non ancora annunciata: Riot Games deve ancora comunicare l&apos;arena.
          </p>
        )}
        {(loc.koreanName || loc.name !== loc.italianName) && (
          <div className="text-[14px] text-[#97a5b9]">
            {loc.koreanName && <span className="mr-2">{loc.koreanName}</span>}
            {loc.name !== loc.italianName && <span>{loc.name}</span>}
          </div>
        )}
        <p className="text-[15px] text-[#eaf0f6] leading-relaxed">{loc.description}</p>
        {loc.mustTry && (
          <p className="text-[15px] text-[#eaf0f6]">
            <span className="font-semibold text-[#fbbf24]">Da provare</span> · {loc.mustTry}
          </p>
        )}
        {loc.tips && (
          <p className="text-[14px] text-[#97a5b9] leading-relaxed">
            <span className="font-semibold text-[#52d9e6]">Consiglio</span> · {loc.tips}
          </p>
        )}
        {days.length > 0 && days.length <= 8 && (
          <div>
            <h3 className="font-[Outfit] text-[17px] font-medium text-[#eaf0f6] mb-1">Nel programma</h3>
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  p.onDay(d.id);
                  p.onClosePlace();
                }}
                className="w-full text-left min-h-[52px] py-2 border-t border-[rgba(234,240,246,.11)] flex items-baseline gap-3 active:opacity-70"
              >
                <span className="text-[14px] font-semibold text-[#52d9e6] shrink-0">{dayShort(d.id)}</span>
                <span className="text-[15px] text-[#eaf0f6] truncate">{d.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  } else {
    header = (
      <div className="px-5">
        <div role="tablist" aria-label="Contenuto del pannello" className="flex gap-6 border-b border-[rgba(234,240,246,.11)]" data-no-drag>
          <button
            role="tab"
            aria-selected={p.sheetTab === 'nearby'}
            onClick={() => p.onSheetTab('nearby')}
            data-testid="sheet-tab-nearby"
            className={`h-11 text-[15px] ${
              p.sheetTab === 'nearby' ? 'text-[#eaf0f6] font-semibold shadow-[inset_0_-2px_0_#52d9e6]' : 'text-[#97a5b9]'
            }`}
          >
            Vicino
          </button>
          <button
            role="tab"
            aria-selected={p.sheetTab === 'places'}
            onClick={() => p.onSheetTab('places')}
            className={`h-11 text-[15px] ${
              p.sheetTab === 'places' ? 'text-[#eaf0f6] font-semibold shadow-[inset_0_-2px_0_#52d9e6]' : 'text-[#97a5b9]'
            }`}
          >
            Tappe <span className="font-normal text-[#97a5b9] ml-1">{p.places.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={p.sheetTab === 'metro'}
            onClick={() => p.onSheetTab('metro')}
            className={`h-11 text-[15px] ${
              p.sheetTab === 'metro' ? 'text-[#eaf0f6] font-semibold shadow-[inset_0_-2px_0_#52d9e6]' : 'text-[#97a5b9]'
            }`}
          >
            Metro
            {p.metroReady && (
              <span className="font-normal text-[#97a5b9] ml-1">
                {p.metroVisibleCount}/{p.metroLineCount}
              </span>
            )}
          </button>
        </div>
      </div>
    );
    body =
      p.sheetTab === 'metro' ? (
        <div className="ms-skin flex flex-col flex-1 min-h-0">{p.metroPanel}</div>
      ) : p.sheetTab === 'nearby' ? (
        <div className="flex flex-col flex-1 min-h-0">{p.nearbyPanel}</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {p.places.map((loc) => (
            <PlaceRow key={loc.id} loc={loc} onPick={() => p.onPickPlace(loc)} />
          ))}
          {p.places.length === 0 && (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">
                {searching ? `Nessuna tappa per “${p.searchQuery.trim()}”.` : 'Nessuna tappa corrisponde ai filtri.'}
              </p>
              <button type="button" onClick={p.onResetFilters} className={pillSecondary}>
                Reimposta filtri
              </button>
            </div>
          )}
        </div>
      );
  }

  const gpsActive = p.geoState.status === 'active';

  return (
    <>
      {/* ── In alto: ricerca e chip (Esplora) oppure partenza e arrivo (Percorso) ── */}
      <div ref={topRef} className="absolute top-0 inset-x-0 z-[450] px-3 pt-3 pointer-events-none">
        {inWalk && p.walk ? (
          <WalkTop w={p.walk} onExit={p.onExitWalk} onEnableGps={p.onEnableGps} onToggleFollow={p.onToggleFollow} />
        ) : !inRoute ? (
          <div className="space-y-2">
            {p.searchSlot}

            {!isShortShell(p.shellH) && !p.searchOpen && (
            <div data-chips className="pointer-events-auto flex gap-5 overflow-x-auto scrollbar-none px-4 rounded-xl bg-[#0a1119]/90 touch-pan-x">
              <button
                type="button"
                onClick={p.onStartRoute}
                className={`${chipBase} font-semibold !text-[#52d9e6]`}
              >
                Percorso
              </button>
              <button
                type="button"
                onClick={p.onToggleAllMetro}
                aria-pressed={p.metroVisibleCount > 0}
                disabled={!p.metroReady}
                className={`${chipBase} ${p.metroVisibleCount > 0 ? chipOn : chipOff} disabled:opacity-60`}
              >
                Metro
              </button>
              {p.addedCount > 0 && (
                <>
                  <button type="button" onClick={() => p.onPlacesFilter(p.placesFilter === 'added' ? 'all' : 'added')} aria-pressed={p.placesFilter === 'added'} className={`${chipBase} ${p.placesFilter === 'added' ? chipOn : chipOff}`} data-testid="map-filter-added">
                    <span aria-hidden="true"></span> Aggiunti ({p.addedCount})
                  </button>
                  <button type="button" onClick={() => p.onPlacesFilter(p.placesFilter === 'todo' ? 'all' : 'todo')} aria-pressed={p.placesFilter === 'todo'} className={`${chipBase} ${p.placesFilter === 'todo' ? chipOn : chipOff}`} data-testid="map-filter-todo">
                    <span aria-hidden="true"></span> Da visitare
                  </button>
                  <button type="button" onClick={() => p.onPlacesFilter(p.placesFilter === 'stops' ? 'all' : 'stops')} aria-pressed={p.placesFilter === 'stops'} className={`${chipBase} ${p.placesFilter === 'stops' ? chipOn : chipOff}`} data-testid="map-filter-stops">
                    Solo tappe
                  </button>
                </>
              )}
              {CHIP_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => p.onCategory(c.id)}
                  aria-pressed={p.activeCategory === c.id}
                  className={`${chipBase} ${p.activeCategory === c.id ? chipOn : chipOff}`}
                >
                  <i aria-hidden="true" className="inline-block w-2 h-2 rounded-full" style={{ background: dotColor(c.id) }} />
                  {c.label}
                </button>
              ))}
              <label className={`${chipBase} relative ${p.activeDay !== 'all' ? chipOn : chipOff}`}>
                {p.activeDay === 'all' ? 'Giorno' : dayShort(p.activeDay)}
                <ChevronDown className="w-3 h-3 opacity-70" />
                <select
                  aria-label="Filtra per giorno del viaggio"
                  value={p.activeDay}
                  onChange={(e) => p.onDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0"
                >
                  <option value="all">Tutti i giorni</option>
                  {ITINERARY_DAYS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {dayShort(d.id)} · {d.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            )}
          </div>
        ) : (
          <div className="pointer-events-auto rounded-xl bg-[#152231] shadow-[0_2px_10px_rgba(0,0,0,0.35)] p-2 flex items-stretch gap-2">
            <button
              type="button"
              onClick={p.onExitRoute}
              aria-label="Esci dal percorso"
              className="w-11 h-11 shrink-0 flex items-center justify-center text-[#eaf0f6] active:opacity-70"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center py-4 gap-1 shrink-0" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-[#52d9e6]" />
              <span className="flex-1 border-l border-dotted border-[rgba(234,240,246,.24)]" />
              <span className="w-2.5 h-2.5 rounded-full border-2 border-[#f472b6]" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <SelectField label="Punto di partenza" value={p.originId} onChange={p.onOrigin}>
                <option value="gps_origin">{gpsActive ? 'La mia posizione' : 'La mia posizione (attiva il GPS)'}</option>
                {p.accommodations.map((a) => (
                  <option key={a.id} value={a.id}>
                    Alloggio {a.accommodationCode} · {a.district}
                  </option>
                ))}
                {ORIGIN_GROUP_ORDER.map((cat) => {
                  const list = p.origins.filter((o) => o.category === cat);
                  if (list.length === 0) return null;
                  return (
                    <optgroup key={cat} label={CATEGORY_LABEL[cat] ?? cat}>
                      {list.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.italianName}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </SelectField>
              <SelectField label="Destinazione" value={p.destinationId} onChange={p.onDestination}>
                {DEST_GROUP_ORDER.map((cat) => {
                  const list = p.destinations.filter((d) => d.category === cat);
                  if (list.length === 0) return null;
                  return (
                    <optgroup key={cat} label={CATEGORY_LABEL[cat] ?? cat}>
                      {list.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.italianName}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </SelectField>
              <button
                type="button"
                onClick={p.onToggleAvoidArex}
                aria-pressed={p.avoidArex}
                data-testid="avoid-arex"
                className="flex items-center gap-2 min-h-[44px] px-1 text-[14px] font-semibold text-[#eaf0f6] active:opacity-70"
              >
                <span
                  aria-hidden="true"
                  className={`relative shrink-0 inline-flex h-4 w-7 rounded-full transition-colors ${p.avoidArex ? 'bg-[#52d9e6]' : 'bg-[rgba(234,240,246,.24)]'}`}
                >
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${p.avoidArex ? 'left-[0.875rem]' : 'left-0.5'}`} />
                </span>
                Senza AREX
                <span className="font-normal text-[13px] text-[#97a5b9]">solo metro e piedi</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sotto i chip: linea selezionata / avvisi a sinistra, livelli a destra ── */}
      <div
        className="absolute inset-x-0 z-[450] px-3 flex items-start justify-between gap-2 pointer-events-none"
        style={{ top: p.topInset + 4 }}
      >
        <div className="flex flex-col items-start gap-2 min-w-0">
          {!inRoute && p.selectedLine && (
            <div
              className="pointer-events-auto bg-slate-900/95 border rounded-full pl-2 pr-1 py-1 backdrop-blur-md text-xs shadow-xl flex items-center gap-2 max-w-full"
              style={{ borderColor: `${p.selectedLine.color}aa` }}
            >
              <LineBadge line={p.selectedLine} size="sm" />
              <span className="font-semibold text-white truncate">{p.selectedLine.it}</span>
              <button
                type="button"
                onClick={p.onShowLineStations}
                className="px-2 py-1 rounded-full text-cyan-300 bg-slate-800 shrink-0 text-[11px] font-semibold"
              >
                {p.selectedLineStations} staz.
              </button>
              <button
                type="button"
                onClick={p.onClearLine}
                aria-label="Deseleziona linea"
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {p.notice && (
            <div
              role="status"
              className="pointer-events-auto bg-slate-900/95 border border-amber-500/40 text-amber-200 rounded-2xl px-3 py-2 text-xs shadow-xl backdrop-blur-md max-w-[17rem] leading-snug"
            >
              {p.notice}
            </div>
          )}
        </div>
      </div>

      {layersOpen && (
        <>
          <button
            type="button"
            aria-label="Chiudi menu livelli"
            className="absolute inset-0 z-[510] cursor-default bg-black/40"
            onClick={() => setLayersOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Livelli della mappa"
            className="absolute inset-x-0 bottom-0 z-[520] rounded-t-2xl bg-[#0a1119] px-5 pb-5 pt-2 shadow-[0_-6px_24px_rgba(0,0,0,0.4)]"
          >
            <div className="w-9 h-1 rounded-full bg-[rgba(234,240,246,.24)] mx-auto mb-1" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 className="font-[Outfit] text-[21px] font-medium tracking-[-0.01em] text-[#eaf0f6]">Mappa</h2>
              <button
                type="button"
                onClick={() => setLayersOpen(false)}
                aria-label="Chiudi"
                className="w-11 h-11 -mr-3 flex items-center justify-center text-[#97a5b9] active:opacity-70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div role="group" aria-label="Stile mappa" className="flex gap-6 border-b border-[rgba(234,240,246,.11)]">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => p.onMapTheme(t)}
                  aria-pressed={p.mapTheme === t}
                  className={`h-11 text-[15px] ${
                    p.mapTheme === t ? 'text-[#eaf0f6] font-semibold shadow-[inset_0_-2px_0_#52d9e6]' : 'text-[#97a5b9]'
                  }`}
                >
                  {t === 'dark' ? 'Notte' : 'Chiara'}
                </button>
              ))}
            </div>

            <div className="mt-1">
              {!inRoute && (
                <ToggleRow
                  label="Linee metro"
                  hint={p.metroReady ? `${p.metroVisibleCount} di ${p.metroLineCount} visibili` : 'Caricamento…'}
                  on={p.metroVisibleCount > 0}
                  disabled={!p.metroReady}
                  onToggle={p.onToggleAllMetro}
                />
              )}
              <ToggleRow
                label="Trasporti di Google"
                hint="Linee e stazioni della mappa originale"
                on={p.showGoogleLines}
                onToggle={p.onToggleGoogleLines}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setLayersOpen(false);
                p.onOpenRealData();
              }}
              className="mt-1 h-11 text-[15px] font-semibold text-[#52d9e6] active:opacity-70"
            >
              Dati reali Metro Seul
            </button>
          </div>
        </>
      )}

      {/* ── In basso a destra: posizione e percorso (seguono il foglio) ── */}
      <div
        ref={dockRef}
        className="absolute bottom-0 inset-x-0 z-[450] px-3 pb-3 flex items-end justify-between gap-3 pointer-events-none"
        style={{
          transform: `translateY(${-h}px)`,
          transition: DOCK_TRANSITION,
          opacity: dockHidden || p.searchOpen ? 0 : 1,
          visibility: dockHidden || p.searchOpen ? 'hidden' : 'visible'
        }}
      >
        <div className="text-[10px] leading-tight text-slate-300 bg-slate-950/75 rounded-md px-1.5 py-1 backdrop-blur-sm max-w-[55%] pointer-events-auto">
          {p.offlineBg ? 'Mappa © OpenFreeMap © OpenMapTiles, dati OpenStreetMap' : 'Mappa © Google'}{p.metroReady ? ' · Linee metro © OpenStreetMap' : ''}
        </div>
        <div
          className="flex flex-col gap-2.5 shrink-0 transition-opacity duration-150"
          style={{ opacity: fabsFit ? 1 : 0, visibility: fabsFit ? 'visible' : 'hidden' }}
        >
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            aria-label="Livelli e stile della mappa"
            aria-expanded={layersOpen}
            className={`${fabClass} ${layersOpen ? '!bg-[#52d9e6] !text-[#04242a]' : ''}`}
          >
            <Layers className="w-5 h-5" />
          </button>
          {inRoute ? (
            <button type="button" onClick={p.onFitRoute} aria-label="Inquadra tutta la tratta" className={fabClass}>
              <Crosshair className="w-5 h-5 text-cyan-400" />
            </button>
          ) : null}
          {!isShortShell(p.shellH) && (
          <button
            type="button"
            onClick={p.onLocate}
            aria-label="Centra sulla mia posizione"
            className={`${fabClass} ${gpsActive ? 'border-cyan-400/70' : ''}`}
          >
            <LocateFixed className={`w-5 h-5 ${gpsActive ? 'text-cyan-400' : 'text-slate-300'}`} />
          </button>
          )}
          {!inRoute && !inWalk && (
            <button
              type="button"
              onClick={p.onStartRoute}
              aria-label="Calcola un percorso in metro"
              className="w-14 h-14 rounded-2xl bg-[#52d9e6] text-[#04242a] flex items-center justify-center active:opacity-80 pointer-events-auto"
            >
              <Navigation className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* ── Foglio trascinabile ── */}
      <div
        ref={sheetRef}
        role="region"
        aria-label={inWalk ? 'Navigazione a piedi' : inRoute ? 'Percorso metro' : p.selected ? p.selected.italianName : 'Vicino a me, tappe e metro'}
        className="absolute bottom-0 inset-x-0 z-[500] rounded-t-2xl bg-[#0a1119] shadow-[0_-6px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
        style={{ height: h, transition: SHEET_TRANSITION, visibility: p.searchOpen ? 'hidden' : 'visible' }}
      >
        <div
          className="shrink-0 select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
        >
          <div data-handle className="h-6 flex items-center justify-center cursor-grab" aria-hidden="true">
            <span className="w-9 h-1 rounded-full bg-[rgba(234,240,246,.24)]" />
          </div>
          {header}
        </div>
        <div className="flex flex-col flex-1 min-h-0">{body}</div>
      </div>
    </>
  );
};

const ToggleRow: React.FC<{
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}> = ({ label, hint, on, onToggle, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    disabled={disabled}
    onClick={onToggle}
    className="w-full flex items-center justify-between gap-3 py-3 min-h-[56px] text-left border-b border-[rgba(234,240,246,.11)] disabled:opacity-60"
  >
    <span className="min-w-0">
      <span className="block text-[15px] font-medium text-[#eaf0f6]">{label}</span>
      <span className="block text-[13px] text-[#97a5b9] truncate">{hint}</span>
    </span>
    <span
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${on ? 'bg-[#52d9e6]' : 'bg-[rgba(234,240,246,.24)]'}`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </span>
  </button>
);
