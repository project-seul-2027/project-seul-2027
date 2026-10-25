import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
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
import { CATEGORY_LABEL, CATEGORY_STYLE } from './categoryStyle';
import { LineBadge } from './MetroPanel';
import type { LiveGeoState } from './MetroRoutePanel';

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
  { id: 'alloggio', label: 'Alloggi', emoji: '🏠' },
  { id: 'cultura', label: 'Cultura', emoji: '🏯' },
  { id: 'food', label: 'Food', emoji: '🍜' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🍸' },
  { id: 'natura', label: 'Parchi', emoji: '🌲' },
  { id: 'gita', label: 'Gite', emoji: '🚆' }
];

const DEST_GROUP_ORDER = ['alloggio', 'cultura', 'food', 'nightlife', 'natura', 'gita', 'logistica'];

const dayShort = (id: number): string => {
  const d = ITINERARY_DAYS.find((x) => x.id === id);
  if (!d) return `Giorno ${id + 1}`;
  const [n, m = ''] = d.dateStr.split(' ');
  return `${n} ${m.slice(0, 3)}`;
};

const chipBase =
  'h-9 px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap border shadow-lg backdrop-blur-md inline-flex items-center gap-1.5 shrink-0 transition-colors active:scale-95';
const chipOff = 'bg-slate-900/95 border-slate-700/80 text-slate-200';
const chipOn = 'bg-cyan-500 border-cyan-400 text-slate-950 font-semibold';

const fabClass =
  'w-12 h-12 rounded-full bg-slate-900/95 border border-slate-700/80 shadow-xl backdrop-blur-md flex items-center justify-center text-slate-200 active:scale-95 transition-transform pointer-events-auto';

const pillPrimary =
  'h-10 px-4 rounded-full bg-cyan-500 text-slate-950 text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-transform';
const pillSecondary =
  'h-10 px-4 rounded-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-transform';

export interface MobileMapOverlayProps {
  shellH: number;
  topInset: number;
  onTopInset: (px: number) => void;
  snap: SheetSnap;
  onSnap: (s: SheetSnap) => void;

  mapMode: 'explore' | 'route';
  onExitRoute: () => void;
  onStartRoute: () => void;

  searchQuery: string;
  onSearchQuery: (q: string) => void;
  activeCategory: string;
  onCategory: (c: string) => void;
  activeDay: number | 'all';
  onDay: (d: number | 'all') => void;
  onResetFilters: () => void;

  places: MapLocation[];
  selected: MapLocation | null;
  onPickPlace: (loc: MapLocation) => void;
  onClosePlace: () => void;
  onRouteTo: (loc: MapLocation) => void;
  onRouteFrom: (loc: MapLocation) => void;

  sheetTab: 'places' | 'metro';
  onSheetTab: (t: 'places' | 'metro') => void;
  metroReady: boolean;
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
  destinations: MapLocation[];
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
      className="w-full h-10 appearance-none rounded-xl bg-slate-950 border border-slate-700 pl-3 pr-9 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 truncate"
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
  </div>
);

const PlaceRow: React.FC<{ loc: MapLocation; onPick: () => void }> = ({ loc, onPick }) => {
  const style = CATEGORY_STYLE[loc.category] ?? CATEGORY_STYLE.logistica;
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-800/70 active:bg-slate-800/60"
    >
      <span
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 bg-slate-950"
        style={{ border: `2px solid ${style.badge}`, boxShadow: `0 0 10px ${style.ring}` }}
      >
        {loc.id === 'valorant_masters_arena' ? '🎮' : style.letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-white truncate">{loc.italianName}</span>
          <span className="text-[11px] text-slate-500 shrink-0 max-w-[40%] truncate">{loc.district}</span>
        </span>
        <span className="block text-[11px] text-slate-400 mt-0.5">
          {CATEGORY_LABEL[loc.category] ?? loc.category}
          {loc.city !== 'Seul' ? ` · ${loc.city}` : ''}
        </span>
        <span className="block text-xs text-slate-400 line-clamp-2 mt-1">{loc.description}</span>
        {loc.mustTry && <span className="block text-[11px] text-amber-400 mt-1">⭐ {loc.mustTry}</span>}
        {loc.id === 'valorant_masters_arena' && (
          <span className="block text-[11px] text-red-400 font-semibold mt-1">⚠️ Sede non ancora annunciata</span>
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
  const dockHidden = p.snap === 'full';
  // I pulsanti seguono il foglio, ma spariscono se non c'è più spazio sotto il pulsante dei livelli
  const fabStackH = inRoute ? 130 : 146;
  // in Esplora i pulsanti ci sono sempre a foglio chiuso; in Percorso solo se resta spazio sotto il pulsante dei livelli
  const fabsFit = !inRoute && p.snap === 'peek' ? true : p.shellH - p.topInset - (inRoute ? 60 : 8) - h >= fabStackH;

  /* ── Intestazione del foglio ── */
  let header: React.ReactNode;
  let body: React.ReactNode;

  if (inRoute) {
    const r = p.route;
    header = (
      <div className="px-4 pb-3 min-h-[84px]">
        {!r ? (
          <div className="text-sm text-slate-300 pt-2">Calcolo del percorso metro…</div>
        ) : r.reachable ? (
          <>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">~{r.estimatedTotalMinutes} min</span>
              <span className="text-sm text-slate-300">
                {r.totalStops} {r.totalStops === 1 ? 'fermata' : 'fermate'} ·{' '}
                {r.totalTransfers === 0 ? 'diretto' : `${r.totalTransfers} ${r.totalTransfers === 1 ? 'cambio' : 'cambi'}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {r.segments.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-slate-600 text-xs">→</span>}
                  <LineBadge line={s.line} />
                </React.Fragment>
              ))}
              <span className="text-xs text-slate-400 ml-1">{r.totalWalkMeters} m a piedi</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-amber-300 pt-2 leading-snug">
            {r.originOutOfMetroCoverage
              ? 'La tua posizione è fuori dalla metro di Seul: apri il foglio per simulare una posizione a Seul.'
              : 'Nessuna tratta metro disponibile per questa tappa.'}
          </div>
        )}
      </div>
    );
    body = <div className="flex flex-col flex-1 min-h-0">{p.routePanel}</div>;
  } else if (p.selected) {
    const loc = p.selected;
    const style = CATEGORY_STYLE[loc.category] ?? CATEGORY_STYLE.logistica;
    const canRoute = loc.city === 'Seul' || loc.city === 'Dintorni / Gite';
    const days = ITINERARY_DAYS.filter((d) => loc.dayNumbers.includes(d.id));
    header = (
      <div className="pb-3">
        <div className="px-4 flex items-start gap-3">
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 bg-slate-950"
            style={{ border: `2px solid ${style.badge}`, boxShadow: `0 0 12px ${style.ring}` }}
          >
            {loc.id === 'valorant_masters_arena' ? '🎮' : style.letter}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white leading-tight">{loc.italianName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {CATEGORY_LABEL[loc.category] ?? loc.category} · {loc.district} · {loc.city}
            </p>
          </div>
          <button
            type="button"
            onClick={p.onClosePlace}
            aria-label="Chiudi dettagli tappa"
            className="w-9 h-9 -mr-1 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div data-no-drag className="flex gap-2 overflow-x-auto scrollbar-none px-4 mt-3 touch-pan-x">
          {canRoute && (
            <button type="button" onClick={() => p.onRouteTo(loc)} className={pillPrimary}>
              <Navigation className="w-4 h-4" /> Percorso
            </button>
          )}
          {loc.category === 'alloggio' && (
            <button type="button" onClick={() => p.onRouteFrom(loc)} className={pillSecondary}>
              <Home className="w-4 h-4 text-cyan-400" /> Partenza
            </button>
          )}
          <a href={getNaverMapSearchUrl(loc)} target="_blank" rel="noopener noreferrer" className={pillSecondary}>
            Naver Map <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className={pillSecondary}
          >
            Google Maps <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    );
    body = (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6 space-y-4">
        {loc.id === 'valorant_masters_arena' && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300 font-semibold">
            ⚠️ Sede non ancora annunciata: Riot Games deve ancora comunicare l&apos;arena.
          </div>
        )}
        {(loc.koreanName || loc.name !== loc.italianName) && (
          <div className="text-xs text-slate-400">
            {loc.koreanName && <span className="mr-2">{loc.koreanName}</span>}
            {loc.name !== loc.italianName && <span className="text-slate-500">{loc.name}</span>}
          </div>
        )}
        <p className="text-sm text-slate-200 leading-relaxed">{loc.description}</p>
        {loc.mustTry && (
          <div className="rounded-xl bg-amber-950/25 border border-amber-500/30 px-3 py-2 text-sm text-amber-200">
            💡 <span className="font-semibold">Da provare:</span> {loc.mustTry}
          </div>
        )}
        {loc.tips && (
          <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-cyan-300">Consiglio · </span>
            {loc.tips}
          </div>
        )}
        {days.length > 0 && days.length <= 8 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nel programma</div>
            <div className="flex flex-col gap-1.5">
              {days.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    p.onDay(d.id);
                    p.onClosePlace();
                  }}
                  className="text-left rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 flex items-center gap-2.5 active:bg-slate-800"
                >
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-mono text-cyan-300">{dayShort(d.id)}</span>
                    <span className="block text-xs text-slate-300 truncate">{d.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  } else {
    header = (
      <div className="px-4 pb-2">
        <div role="tablist" aria-label="Contenuto del pannello" className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800" data-no-drag>
          <button
            role="tab"
            aria-selected={p.sheetTab === 'places'}
            onClick={() => p.onSheetTab('places')}
            className={`h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              p.sheetTab === 'places' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Tappe
            <span className="text-[10px] font-mono tabular-nums text-slate-500">{p.places.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={p.sheetTab === 'metro'}
            onClick={() => p.onSheetTab('metro')}
            className={`h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              p.sheetTab === 'metro' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            <TrainFront className="w-3.5 h-3.5" /> Metro &amp; AREX
            {p.metroReady && (
              <span className="text-[10px] font-mono tabular-nums text-slate-500">
                {p.metroVisibleCount}/{p.metroLineCount}
              </span>
            )}
          </button>
        </div>
      </div>
    );
    body =
      p.sheetTab === 'metro' ? (
        <div className="flex flex-col flex-1 min-h-0">{p.metroPanel}</div>
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
        {!inRoute ? (
          <div className="space-y-2">
            <div className="pointer-events-auto h-12 rounded-full bg-slate-900/95 border border-slate-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 pl-4 pr-1.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                value={p.searchQuery}
                onChange={(e) => p.onSearchQuery(e.target.value)}
                onFocus={() => {
                  p.onSheetTab('places');
                  if (p.snap === 'peek') p.onSnap('mid');
                }}
                placeholder="Cerca tappe, quartieri, cibo…"
                aria-label="Cerca tra le tappe"
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => p.onSearchQuery('')}
                  aria-label="Cancella ricerca"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 active:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setLayersOpen((v) => !v)}
                aria-label="Livelli e stile della mappa"
                aria-expanded={layersOpen}
                className={`w-9 h-9 rounded-full border flex items-center justify-center active:scale-95 ${
                  layersOpen ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>

            {!isShortShell(p.shellH) && (
            <div data-chips className="pointer-events-auto flex gap-2 overflow-x-auto scrollbar-none -mx-3 px-3 pb-1 touch-pan-x">
              <button
                type="button"
                onClick={p.onStartRoute}
                className={`${chipBase} bg-cyan-950/90 border-cyan-400/60 text-cyan-200`}
              >
                <Navigation className="w-3.5 h-3.5" /> Percorso
              </button>
              <button
                type="button"
                onClick={p.onToggleAllMetro}
                aria-pressed={p.metroVisibleCount > 0}
                disabled={!p.metroReady}
                className={`${chipBase} ${p.metroVisibleCount > 0 ? chipOn : chipOff} disabled:opacity-60`}
              >
                <TrainFront className="w-3.5 h-3.5" /> Metro
              </button>
              {CHIP_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => p.onCategory(c.id)}
                  aria-pressed={p.activeCategory === c.id}
                  className={`${chipBase} ${p.activeCategory === c.id ? chipOn : chipOff}`}
                >
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </button>
              ))}
              <label className={`${chipBase} relative ${p.activeDay !== 'all' ? chipOn : chipOff}`}>
                <Calendar className="w-3.5 h-3.5" />
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
          <div className="pointer-events-auto rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-xl backdrop-blur-md p-2.5 flex items-stretch gap-2">
            <button
              type="button"
              onClick={p.onExitRoute}
              aria-label="Esci dal percorso"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-slate-200 active:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center py-3 gap-1 shrink-0" aria-hidden="true">
              <span className="w-3 h-3 rounded-full border-[3px] border-cyan-400" />
              <span className="flex-1 border-l-2 border-dotted border-slate-600" />
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <SelectField label="Punto di partenza" value={p.originId} onChange={p.onOrigin}>
                <option value="gps_origin">📍 {gpsActive ? 'La mia posizione' : 'La mia posizione (attiva il GPS)'}</option>
                {p.accommodations.map((a) => (
                  <option key={a.id} value={a.id}>
                    🏠 Alloggio {a.accommodationCode} · {a.district}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Destinazione" value={p.destinationId} onChange={p.onDestination}>
                {DEST_GROUP_ORDER.map((cat) => {
                  const list = p.destinations.filter((d) => d.category === cat);
                  if (list.length === 0) return null;
                  return (
                    <optgroup key={cat} label={`${CATEGORY_STYLE[cat]?.letter ?? ''} ${CATEGORY_LABEL[cat] ?? cat}`}>
                      {list.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.italianName}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </SelectField>
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
        {inRoute && (
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            aria-label="Livelli e stile della mappa"
            aria-expanded={layersOpen}
            className={`${fabClass} shrink-0 ${layersOpen ? 'border-cyan-400 text-cyan-300' : ''}`}
          >
            <Layers className="w-5 h-5" />
          </button>
        )}
      </div>

      {layersOpen && (
        <>
          <button
            type="button"
            aria-label="Chiudi menu livelli"
            className="absolute inset-0 z-[510] cursor-default"
            onClick={() => setLayersOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Livelli della mappa"
            className="absolute right-3 z-[520] w-[17.5rem] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3.5 space-y-3.5 animate-in fade-in duration-150"
            style={{ top: inRoute ? p.topInset + 4 + 52 : 68 }}
          >
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Stile mappa</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => p.onMapTheme('dark')}
                  aria-pressed={p.mapTheme === 'dark'}
                  className={`h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 ${
                    p.mapTheme === 'dark'
                      ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  <Moon className="w-4 h-4" /> Notte
                </button>
                <button
                  type="button"
                  onClick={() => p.onMapTheme('light')}
                  aria-pressed={p.mapTheme === 'light'}
                  className={`h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 ${
                    p.mapTheme === 'light'
                      ? 'bg-amber-400 border-amber-300 text-slate-950'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  <Sun className="w-4 h-4" /> Chiara
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Livelli</div>
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
              className="w-full h-11 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2 active:bg-slate-800"
            >
              <BookOpen className="w-4 h-4" /> Dati reali Metro Seul
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
          opacity: dockHidden ? 0 : 1,
          visibility: dockHidden ? 'hidden' : 'visible'
        }}
      >
        <div className="text-[10px] leading-tight text-slate-300 bg-slate-950/75 rounded-md px-1.5 py-1 backdrop-blur-sm max-w-[55%] pointer-events-auto">
          Mappa © Google{p.metroReady ? ' · Linee metro © OpenStreetMap' : ''}
        </div>
        <div
          className="flex flex-col gap-2.5 shrink-0 transition-opacity duration-150"
          style={{ opacity: fabsFit ? 1 : 0, visibility: fabsFit ? 'visible' : 'hidden' }}
        >
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
          {!inRoute && (
            <button
              type="button"
              onClick={p.onStartRoute}
              aria-label="Calcola un percorso in metro"
              className="w-14 h-14 rounded-full bg-cyan-500 text-slate-950 shadow-xl shadow-cyan-500/30 flex items-center justify-center active:scale-95 transition-transform pointer-events-auto"
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
        aria-label={inRoute ? 'Percorso metro' : p.selected ? p.selected.italianName : 'Tappe e metro'}
        className="absolute bottom-0 inset-x-0 z-[500] rounded-t-3xl bg-slate-900 border-t border-slate-700/80 shadow-[0_-14px_36px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
        style={{ height: h, transition: SHEET_TRANSITION }}
      >
        <div
          className="shrink-0 select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
        >
          <div data-handle className="h-6 flex items-center justify-center cursor-grab" aria-hidden="true">
            <span className="w-10 h-1.5 rounded-full bg-slate-600" />
          </div>
          {header}
        </div>
        <div className="flex flex-col flex-1 min-h-0 border-t border-slate-800/80">{body}</div>
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
    className="w-full flex items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
  >
    <span className="min-w-0">
      <span className="block text-sm font-medium text-slate-100">{label}</span>
      <span className="block text-[11px] text-slate-500 truncate">{hint}</span>
    </span>
    <span
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${on ? 'bg-cyan-500' : 'bg-slate-700'}`}
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
