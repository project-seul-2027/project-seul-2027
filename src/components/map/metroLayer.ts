import L from 'leaflet';
import {
  readableTextOn,
  stationSearchName,
  type LatLng,
  type MetroLine,
  type MetroNetwork
} from '../../data/seoulMetro';
import { type MetroRouteResult } from '../../data/metroRouter';
import { originLabel } from './categoryStyle';

export type MetroTheme = 'dark' | 'light';

interface MetroLayerOptions {
  /** Click su una linea (o su un bollino nel popup di una stazione). null = deseleziona. */
  onSelectLine: (id: string | null) => void;
}

interface LineLayers {
  def: MetroLine;
  casing: L.Polyline;
  stroke: L.Polyline;
  bounds: L.LatLngBounds;
}

/** Pannello Leaflet sopra le tile e sotto i segnaposto delle tappe (markerPane = 600). */
const PANE = 'metroPane';

/** Ordine di disegno: prima le linee secondarie, in cima le linee 1–9. */
const GROUP_ORDER: Record<MetroLine['group'], number> = { other: 0, light: 1, rail: 2, metro: 3 };

const lineWeight = (z: number) => (z <= 10 ? 2 : z <= 11 ? 2.5 : z <= 12 ? 3 : z <= 13 ? 4 : z <= 14 ? 5 : 6);
const stationRadius = (z: number) => (z <= 11 ? 2.5 : z <= 12 ? 3 : z <= 13 ? 3.5 : z <= 14 ? 4 : 5);

/** Da questo zoom si vedono tutte le stazioni delle linee visibili */
const ALL_STATIONS_ZOOM = 13;
/** Da questo zoom si vedono le stazioni di interscambio */
const INTERCHANGE_ZOOM = 11;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function lineBadgeHtml(line: MetroLine, extra = ''): string {
  return `<span class="metro-badge" style="background:${line.color};color:${readableTextOn(line.color)}" ${extra}>${escapeHtml(line.short)}</span>`;
}

interface PrecomputedPath {
  pts: LatLng[];
  cumLength: number[];
  totalLength: number;
}

function precomputePath(pts: LatLng[]): PrecomputedPath {
  const cumLength: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dLat = pts[i][0] - pts[i - 1][0];
    const dLng = pts[i][1] - pts[i - 1][1];
    const step = Math.hypot(dLat, dLng);
    total += step;
    cumLength.push(total);
  }
  return { pts, cumLength, totalLength: total };
}

/**
 * Restituisce la porzione di polilinea [lat, lng][] dal punto iniziale fino alla frazione `t` (0..1),
 * interpolando linearmente il vertice di punta per un disegno fluido a 60fps.
 */
function slicePrecomputedPath(pre: PrecomputedPath, t: number): { coords: LatLng[]; tip: LatLng } {
  const { pts, cumLength, totalLength } = pre;
  if (pts.length === 0) return { coords: [], tip: [0, 0] };
  if (pts.length === 1 || totalLength <= 0 || t >= 1) {
    return { coords: pts, tip: pts[pts.length - 1] };
  }
  if (t <= 0) {
    return { coords: [pts[0]], tip: pts[0] };
  }

  const target = t * totalLength;
  const coords: LatLng[] = [pts[0]];

  for (let i = 1; i < pts.length; i++) {
    const prevDist = cumLength[i - 1];
    const currDist = cumLength[i];
    if (target >= currDist) {
      coords.push(pts[i]);
    } else {
      const segLen = currDist - prevDist;
      const localT = segLen > 0 ? (target - prevDist) / segLen : 0;
      const lat = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * localT;
      const lng = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * localT;
      const tip: LatLng = [lat, lng];
      coords.push(tip);
      return { coords, tip };
    }
  }

  return { coords: pts, tip: pts[pts.length - 1] };
}

function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

function buildRouteSignature(route: MetroRouteResult | null): string {
  if (!route || !route.reachable) return '';
  const segSig = route.segments
    .map((s) => `${s.line.id}:${s.fromStationKey}->${s.toStationKey}`)
    .join('|');
  return `${route.origin.id}|${route.destination.id}|${segSig}`;
}

/**
 * Linee metro disegnate sopra la mappa (canvas): si possono mostrare/nascondere una per una,
 * evidenziare passandoci sopra e selezionare con un click.
 * Supporta anche l'isolamento grafico e l'animazione progressiva (origine → destinazione)
 * di una singola tratta calcolata (modalità Percorso Metro).
 */
export class MetroLayer {
  private readonly renderer: L.Canvas;
  private readonly lines = new Map<string, LineLayers>();
  private readonly stationLayer = L.layerGroup();
  private readonly routeLayer = L.layerGroup();
  private readonly linesByStation = new Map<string, string[]>();
  private visible = new Set<string>();
  private selected: string | null = null;
  private hovered: string | null = null;
  private theme: MetroTheme = 'dark';
  private activeRoute: MetroRouteResult | null = null;
  private lastAnimatedRouteSig = '';
  private routeAnimFrameId: number | null = null;

  constructor(
    private readonly map: L.Map,
    private readonly data: MetroNetwork,
    private readonly opts: MetroLayerOptions
  ) {
    if (!map.getPane(PANE)) map.createPane(PANE).style.zIndex = '420';
    this.renderer = L.canvas({ pane: PANE, padding: 0.5, tolerance: 7 });

    for (const def of data.lines) {
      const latlngs = def.chains.map((c) => c.path);
      const common: L.PolylineOptions = {
        renderer: this.renderer,
        pane: PANE,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 0.5
      };
      const casing = L.polyline(latlngs, { ...common, interactive: false });
      const stroke = L.polyline(latlngs, { ...common, interactive: true, bubblingMouseEvents: false });

      stroke.bindTooltip(
        `<div class="metro-tip">${lineBadgeHtml(def)}<div><strong>${escapeHtml(def.it)}</strong><span>${escapeHtml(def.ko)} · ${escapeHtml(def.en)}</span><em>Clicca per selezionarla</em></div></div>`,
        { sticky: true, direction: 'top', offset: [0, -10], className: 'metro-tooltip', opacity: 1 }
      );
      stroke.on('mouseover', () => {
        this.hovered = def.id;
        this.styleLine(def.id);
      });
      stroke.on('mouseout', () => {
        if (this.hovered === def.id) this.hovered = null;
        this.styleLine(def.id);
      });
      stroke.on('click', () => this.opts.onSelectLine(this.selected === def.id ? null : def.id));

      this.lines.set(def.id, { def, casing, stroke, bounds: stroke.getBounds() });
    }

    for (const [key, st] of Object.entries(data.stations)) this.linesByStation.set(key, Object.keys(st.at));

    this.stationLayer.addTo(map);
    this.routeLayer.addTo(map);
    map.on('zoomend', this.handleZoom);
    map.on('click', this.handleMapClick);
    map.on('popupopen', this.handlePopupOpen);
  }

  // ───────────────────────── API pubblica ─────────────────────────

  setVisible(ids: Iterable<string>) {
    this.visible = new Set(ids);
    this.redraw(false);
  }

  setSelected(id: string | null) {
    this.selected = id && this.lines.has(id) ? id : null;
    this.redraw(false);
  }

  setTheme(theme: MetroTheme) {
    this.theme = theme;
    this.map.getContainer().classList.toggle('metro-dark', theme === 'dark');
    if (this.activeRoute) {
      this.renderActiveRoute(false);
    } else {
      this.restyleAll();
      this.renderStations();
    }
  }

  /**
   * Attiva o disattiva l'isolamento grafico di un percorso metro calcolato.
   * Quando `route` cambia tratta, avvia l'animazione fluida che disegna il percorso
   * dalla partenza alla destinazione.
   */
  setActiveRoute(route: MetroRouteResult | null, autoFit = true) {
    const newSig = buildRouteSignature(route);
    const shouldAnimate = Boolean(route && route.reachable && newSig !== this.lastAnimatedRouteSig);
    this.activeRoute = route;
    this.lastAnimatedRouteSig = newSig;

    this.redraw(shouldAnimate);
    if (route && autoFit) {
      this.fitActiveRoute();
    }
  }

  /** Riproduce su richiesta l'animazione di disegno del percorso attivo dall'origine alla destinazione. */
  replayRouteAnimation() {
    if (!this.activeRoute || !this.activeRoute.reachable) return;
    this.renderActiveRoute(true);
  }

  /** Margini coperti da pannelli sopra la mappa (telefono): le inquadrature li evitano. */
  insets = { top: 0, bottom: 0 };

  private fitOptions(pad: number, extra: L.FitBoundsOptions = {}): L.FitBoundsOptions {
    return {
      paddingTopLeft: [pad, pad + this.insets.top],
      paddingBottomRight: [pad, pad + this.insets.bottom],
      ...extra
    };
  }

  /** Inquadra l'intero percorso attivo (alloggio/GPS, stazioni, tratta metro e tappa). */
  fitActiveRoute() {
    const route = this.activeRoute;
    if (!route) return;
    const pts: LatLng[] = [
      [route.origin.lat, route.origin.lng],
      [route.destination.lat, route.destination.lng]
    ];
    if (route.reachable) {
      for (const seg of route.segments) {
        pts.push(...seg.pathGeometry);
      }
      if (route.walkStart) pts.push(route.walkStart.toLatLng);
      if (route.walkEnd) pts.push(route.walkEnd.fromLatLng);
    }
    if (pts.length >= 2) {
      const bounds = L.latLngBounds(pts);
      this.map.fitBounds(bounds, this.fitOptions(48, { maxZoom: 15, animate: true }));
    }
  }

  /** Inquadra tutta la linea. */
  fitLine(id: string) {
    const line = this.lines.get(id);
    if (line) this.map.fitBounds(line.bounds, this.fitOptions(36, { maxZoom: 14 }));
  }

  /** Centra la mappa su una stazione e apre la sua scheda. */
  focusStation(key: string, lineId?: string) {
    const st = this.data.stations[key];
    if (!st) return;
    const pos = (lineId && st.at[lineId]) || Object.values(st.at)[0];
    const zoom = Math.max(this.map.getZoom(), 15);
    this.map.once('moveend', () => this.openStationPopup(key, pos));
    // Con pannelli sopra la mappa la stazione va al centro della parte visibile
    const dy = (this.insets.bottom - this.insets.top) / 2;
    const center = dy ? this.map.unproject(this.map.project(pos, zoom).add([0, dy]), zoom) : L.latLng(pos);
    this.map.setView(center, zoom, { animate: true });
  }

  private cancelRouteAnimation() {
    if (this.routeAnimFrameId !== null) {
      cancelAnimationFrame(this.routeAnimFrameId);
      this.routeAnimFrameId = null;
    }
  }

  destroy() {
    this.cancelRouteAnimation();
    this.map.off('zoomend', this.handleZoom);
    this.map.off('click', this.handleMapClick);
    this.map.off('popupopen', this.handlePopupOpen);
    for (const l of this.lines.values()) {
      l.casing.remove();
      l.stroke.remove();
    }
    this.stationLayer.remove();
    this.routeLayer.remove();
    this.renderer.remove();
    this.map.getContainer().classList.remove('metro-dark');
  }

  // ───────────────────────── disegno ─────────────────────────

  /**
   * Riaggiunge i livelli nell'ordine giusto: se c'è un percorso attivo in modalità Route,
   * isola solo la tratta del percorso; altrimenti disegna le linee visibili della mappa.
   */
  private redraw(animateRoute = false) {
    this.cancelRouteAnimation();
    for (const l of this.lines.values()) {
      l.casing.remove();
      l.stroke.remove();
    }
    this.stationLayer.clearLayers();
    this.routeLayer.clearLayers();

    if (this.activeRoute) {
      this.renderActiveRoute(animateRoute);
      return;
    }

    const ordered = [...this.lines.values()]
      .filter((l) => this.visible.has(l.def.id) && l.def.id !== this.selected)
      .sort(
        (a, b) =>
          GROUP_ORDER[a.def.group] - GROUP_ORDER[b.def.group] ||
          b.def.id.localeCompare(a.def.id, 'en', { numeric: true })
      );
    const sel = this.selected ? this.lines.get(this.selected) : undefined;
    for (const l of ordered) l.casing.addTo(this.map);
    for (const l of ordered) l.stroke.addTo(this.map);
    if (sel) {
      sel.casing.addTo(this.map);
      sel.stroke.addTo(this.map);
    }
    this.restyleAll();
    this.renderStations();
  }

  /**
   * Disegna in isolamento la tratta metro calcolata, i tratti a piedi e le fermate chiave.
   * Quando `animate = true`, traccia progressivamente la linea dall'origine alla destinazione.
   */
  private renderActiveRoute(animate = false) {
    this.cancelRouteAnimation();
    this.routeLayer.clearLayers();
    const route = this.activeRoute;
    if (!route || !route.reachable) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = animate && !prefersReducedMotion;

    const casingColor = this.theme === 'dark' ? '#020617' : '#ffffff';

    interface AnimatedLeg {
      pre: PrecomputedPath;
      casing: L.Polyline;
      stroke: L.Polyline;
      color: string;
      weight: number;
      stationReveals: { ratio: number; marker: L.CircleMarker; finalFillOpacity: number; finalOpacity: number }[];
    }

    const legs: AnimatedLeg[] = [];

    // 1. Tratto a piedi iniziale (Origine -> Stazione di salita)
    if (route.walkStart && route.walkStart.distanceMeters > 15) {
      const walkPts: LatLng[] = [route.walkStart.fromLatLng, route.walkStart.toLatLng];
      const pre = precomputePath(walkPts);
      const initialCoords = shouldAnimate ? [walkPts[0]] : walkPts;

      const walkStartCasing = L.polyline(initialCoords, {
        renderer: this.renderer,
        pane: PANE,
        color: casingColor,
        weight: 7,
        opacity: 0.85,
        interactive: false
      });
      const walkStartLine = L.polyline(initialCoords, {
        renderer: this.renderer,
        pane: PANE,
        color: '#38bdf8',
        weight: 4,
        dashArray: '6, 8',
        opacity: 1
      });
      walkStartLine.bindTooltip(
        `<div class="metro-tip"><div><strong>Tratto a piedi iniziale</strong><span>${escapeHtml(originLabel(route.origin))} → ${escapeHtml(route.walkStart.station.en)}</span><em>${route.walkStart.distanceMeters} m · ~${route.walkStart.walkMinutes} min a piedi</em></div></div>`,
        { sticky: true, direction: 'top', offset: [0, -8], className: 'metro-tooltip', opacity: 1 }
      );
      this.routeLayer.addLayer(walkStartCasing);
      this.routeLayer.addLayer(walkStartLine);

      legs.push({
        pre,
        casing: walkStartCasing,
        stroke: walkStartLine,
        color: '#38bdf8',
        weight: Math.max(0.12, pre.totalLength * 0.8),
        stationReveals: []
      });
    }

    // 2. Polilinee delle tratte metro attive (in ordine da partenza a destinazione)
    for (let sIdx = 0; sIdx < route.segments.length; sIdx++) {
      const seg = route.segments[sIdx];
      if (seg.pathGeometry.length < 2) continue;
      const pre = precomputePath(seg.pathGeometry);
      const initialCoords = shouldAnimate ? [seg.pathGeometry[0]] : seg.pathGeometry;

      const segCasing = L.polyline(initialCoords, {
        renderer: this.renderer,
        pane: PANE,
        color: casingColor,
        weight: 11,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.92,
        interactive: false
      });
      const segStroke = L.polyline(initialCoords, {
        renderer: this.renderer,
        pane: PANE,
        color: seg.line.color,
        weight: 6.5,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 1
      });
      segStroke.bindTooltip(
        `<div class="metro-tip">${lineBadgeHtml(seg.line)}<div><strong>${escapeHtml(seg.line.it)}: ${escapeHtml(seg.fromStation.en)} → ${escapeHtml(seg.toStation.en)}</strong><span>${escapeHtml(seg.directionSummary)}</span><em>${seg.stopCount} fermate · ~${seg.estimatedMinutes} min</em></div></div>`,
        { sticky: true, direction: 'top', offset: [0, -10], className: 'metro-tooltip', opacity: 1 }
      );
      this.routeLayer.addLayer(segCasing);
      this.routeLayer.addLayer(segStroke);

      const stationReveals: AnimatedLeg['stationReveals'] = [];
      const totalStopsInSeg = seg.intermediateStationKeys.length + 1;

      // Fermate intermedie lungo la tratta attiva
      seg.intermediateStationKeys.forEach((stKey, idx) => {
        const st = this.data.stations[stKey];
        if (!st) return;
        const pos = st.at[seg.line.id] ?? Object.values(st.at)[0];
        const dot = L.circleMarker(pos, {
          renderer: this.renderer,
          pane: PANE,
          radius: 4.5,
          color: seg.line.color,
          weight: 2,
          fillColor: '#ffffff',
          fillOpacity: shouldAnimate ? 0 : 1,
          opacity: shouldAnimate ? 0 : 1,
          bubblingMouseEvents: false
        });
        dot.bindTooltip(
          `<div class="metro-tip">${lineBadgeHtml(seg.line)}<div><strong>${escapeHtml(st.en)}</strong><span>${escapeHtml(st.ko)}역 · fermata intermedia</span></div></div>`,
          { direction: 'top', offset: [0, -6], className: 'metro-tooltip', opacity: 1 }
        );
        dot.on('click', () => this.openStationPopup(stKey, pos));
        this.routeLayer.addLayer(dot);
        stationReveals.push({
          ratio: (idx + 1) / totalStopsInSeg,
          marker: dot,
          finalFillOpacity: 1,
          finalOpacity: 1
        });
      });

      legs.push({
        pre,
        casing: segCasing,
        stroke: segStroke,
        color: seg.line.color,
        weight: Math.max(0.25, pre.totalLength),
        stationReveals
      });
    }

    // 3. Tratto a piedi finale (Stazione di discesa -> Destinazione)
    if (route.walkEnd && route.walkEnd.distanceMeters > 15 && route.segments.length > 0) {
      const walkEndPts: LatLng[] = [route.walkEnd.fromLatLng, route.walkEnd.toLatLng];
      const pre = precomputePath(walkEndPts);
      const initialCoords = shouldAnimate ? [walkEndPts[0]] : walkEndPts;

      const walkEndCasing = L.polyline(initialCoords, {
        renderer: this.renderer,
        pane: PANE,
        color: casingColor,
        weight: 7,
        opacity: 0.85,
        interactive: false
      });
      const walkEndLine = L.polyline(initialCoords, {
        renderer: this.renderer,
        pane: PANE,
        color: '#34d399',
        weight: 4,
        dashArray: '6, 8',
        opacity: 1
      });
      walkEndLine.bindTooltip(
        `<div class="metro-tip"><div><strong>Tratto a piedi finale</strong><span>${escapeHtml(route.walkEnd.station.en)} → ${escapeHtml(route.destination.italianName)}</span><em>${route.walkEnd.distanceMeters} m · ~${route.walkEnd.walkMinutes} min a piedi</em></div></div>`,
        { sticky: true, direction: 'top', offset: [0, -8], className: 'metro-tooltip', opacity: 1 }
      );
      this.routeLayer.addLayer(walkEndCasing);
      this.routeLayer.addLayer(walkEndLine);

      legs.push({
        pre,
        casing: walkEndCasing,
        stroke: walkEndLine,
        color: '#34d399',
        weight: Math.max(0.12, pre.totalLength * 0.8),
        stationReveals: []
      });
    }

    // 4. Nodi principali: Salita, Cambi e Discesa
    if (route.segments.length > 0) {
      const firstSeg = route.segments[0];
      const lastSeg = route.segments[route.segments.length - 1];

      const boardPos =
        firstSeg.fromStation.at[firstSeg.line.id] ?? Object.values(firstSeg.fromStation.at)[0];
      const boardMarker = L.circleMarker(boardPos, {
        renderer: this.renderer,
        pane: PANE,
        radius: 7.5,
        color: '#020617',
        weight: 2.5,
        fillColor: firstSeg.line.color,
        fillOpacity: 1,
        bubblingMouseEvents: false
      });
      boardMarker.bindTooltip(
        `Salita: ${escapeHtml(firstSeg.fromStation.en)} (${escapeHtml(firstSeg.line.short)})`,
        {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'metro-route-node-label',
          opacity: 1
        }
      );
      boardMarker.on('click', () => this.openStationPopup(firstSeg.fromStationKey, boardPos));
      this.routeLayer.addLayer(boardMarker);

      // Nodi di cambio linea
      for (const tr of route.transfers) {
        const trMarker = L.circleMarker(tr.latLng, {
          renderer: this.renderer,
          pane: PANE,
          radius: 8,
          color: '#f59e0b',
          weight: 3,
          fillColor: '#ffffff',
          fillOpacity: 1,
          bubblingMouseEvents: false
        });
        trMarker.bindTooltip(
          `Cambio: ${escapeHtml(tr.station.en)} (${escapeHtml(tr.fromLine.short)} → ${escapeHtml(tr.toLine.short)})`,
          {
            permanent: true,
            direction: 'right',
            offset: [10, 0],
            className: 'metro-route-node-label metro-route-transfer-label',
            opacity: 1
          }
        );
        trMarker.on('click', () => this.openStationPopup(tr.stationKey, tr.latLng));
        this.routeLayer.addLayer(trMarker);
      }

      const alightPos =
        lastSeg.toStation.at[lastSeg.line.id] ?? Object.values(lastSeg.toStation.at)[0];
      const alightMarker = L.circleMarker(alightPos, {
        renderer: this.renderer,
        pane: PANE,
        radius: 7.5,
        color: '#020617',
        weight: 2.5,
        fillColor: lastSeg.line.color,
        fillOpacity: 1,
        bubblingMouseEvents: false
      });
      alightMarker.bindTooltip(
        `Discesa: ${escapeHtml(lastSeg.toStation.en)} (${escapeHtml(lastSeg.line.short)})`,
        {
          permanent: true,
          direction: 'bottom',
          offset: [0, 10],
          className: 'metro-route-node-label',
          opacity: 1
        }
      );
      alightMarker.on('click', () => this.openStationPopup(lastSeg.toStationKey, alightPos));
      this.routeLayer.addLayer(alightMarker);
    }

    // 5. Esecuzione animazione fluida 60fps dall'origine alla destinazione
    if (shouldAnimate && legs.length > 0) {
      const totalWeight = legs.reduce((sum, l) => sum + l.weight, 0);
      let acc = 0;
      const legBounds = legs.map((leg) => {
        const start = acc / totalWeight;
        acc += leg.weight;
        const end = acc / totalWeight;
        return { leg, start, end };
      });

      const startPt = legs[0].pre.pts[0];
      const headHalo = L.circleMarker(startPt, {
        renderer: this.renderer,
        pane: PANE,
        radius: 13,
        color: legs[0].color,
        weight: 2,
        fillColor: legs[0].color,
        fillOpacity: 0.28,
        interactive: false
      });
      const headDot = L.circleMarker(startPt, {
        renderer: this.renderer,
        pane: PANE,
        radius: 6,
        color: '#ffffff',
        weight: 2.5,
        fillColor: legs[0].color,
        fillOpacity: 1,
        interactive: false
      });
      this.routeLayer.addLayer(headHalo);
      this.routeLayer.addLayer(headDot);

      // Durata proporzionale alla lunghezza del percorso (tra 950 ms e 1550 ms)
      const durationMs = Math.min(1550, Math.max(950, 850 + route.totalStops * 38));
      const startTime = performance.now();

      const stepFrame = (now: number) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, Math.max(0, elapsed / durationMs));
        const eased = easeOutQuart(rawProgress);

        let activeTip: LatLng = startPt;
        let activeColor = legs[0].color;

        for (const { leg, start, end } of legBounds) {
          const span = end - start;
          const legProgress =
            span <= 0 ? 1 : eased <= start ? 0 : eased >= end ? 1 : (eased - start) / span;

          if (legProgress <= 0) {
            const firstPt = [leg.pre.pts[0]];
            leg.casing.setLatLngs(firstPt);
            leg.stroke.setLatLngs(firstPt);
          } else if (legProgress >= 1) {
            leg.casing.setLatLngs(leg.pre.pts);
            leg.stroke.setLatLngs(leg.pre.pts);
            for (const rev of leg.stationReveals) {
              rev.marker.setStyle({
                opacity: rev.finalOpacity,
                fillOpacity: rev.finalFillOpacity
              });
            }
            activeTip = leg.pre.pts[leg.pre.pts.length - 1];
            activeColor = leg.color;
          } else {
            const { coords, tip } = slicePrecomputedPath(leg.pre, legProgress);
            leg.casing.setLatLngs(coords);
            leg.stroke.setLatLngs(coords);
            for (const rev of leg.stationReveals) {
              if (legProgress >= rev.ratio) {
                rev.marker.setStyle({
                  opacity: rev.finalOpacity,
                  fillOpacity: rev.finalFillOpacity
                });
              }
            }
            activeTip = tip;
            activeColor = leg.color;
          }
        }

        headHalo.setLatLng(activeTip);
        headHalo.setStyle({ color: activeColor, fillColor: activeColor });
        headDot.setLatLng(activeTip);
        headDot.setStyle({ fillColor: activeColor });

        if (rawProgress < 1) {
          this.routeAnimFrameId = requestAnimationFrame(stepFrame);
        } else {
          headHalo.remove();
          headDot.remove();
          this.routeAnimFrameId = null;
        }
      };

      this.routeAnimFrameId = requestAnimationFrame(stepFrame);
    }
  }

  private restyleAll() {
    for (const id of this.lines.keys()) this.styleLine(id);
  }

  private styleLine(id: string) {
    const l = this.lines.get(id);
    if (!l) return;
    const w = lineWeight(this.map.getZoom());
    const isSel = this.selected === id;
    const dimmed = this.selected !== null && !isSel;
    const hover = this.hovered === id && !isSel;
    const weight = isSel ? w + 2 : hover ? w + 1.5 : w;
    l.casing.setStyle({
      color: this.theme === 'dark' ? '#060a12' : '#ffffff',
      weight: weight + (isSel ? 5 : 3),
      opacity: dimmed ? 0.2 : 0.9
    });
    l.stroke.setStyle({ color: l.def.color, weight, opacity: dimmed ? (hover ? 0.7 : 0.28) : 1 });
  }

  private renderStations() {
    this.stationLayer.clearLayers();
    if (this.activeRoute) return;

    const z = this.map.getZoom();
    const r = stationRadius(z);
    const sel = this.selected;
    const darkMap = this.theme === 'dark';
    const showLabels = sel !== null && z >= ALL_STATIONS_ZOOM;

    for (const [key, st] of Object.entries(this.data.stations)) {
      const lineIds = this.linesByStation.get(key)!;
      let shown: string[];
      if (sel) {
        if (!lineIds.includes(sel)) continue;
        shown = [sel];
      } else {
        const visibleHere = lineIds.filter((id) => this.visible.has(id));
        if (visibleHere.length === 0) continue;
        if (z >= ALL_STATIONS_ZOOM) shown = visibleHere;
        else if (z >= INTERCHANGE_ZOOM && visibleHere.length >= 2) shown = visibleHere;
        else continue;
      }
      const interchange = sel ? lineIds.length >= 2 : shown.length >= 2;

      shown.forEach((lineId, i) => {
        const line = this.lines.get(lineId)!.def;
        const marker = L.circleMarker(st.at[lineId], {
          renderer: this.renderer,
          pane: PANE,
          radius: interchange ? r + 1.5 : r,
          color: interchange ? (darkMap ? '#0b1220' : '#1f2937') : line.color,
          weight: interchange ? 2.5 : 2,
          fillColor: '#ffffff',
          fillOpacity: 1,
          bubblingMouseEvents: false
        });
        if (showLabels && i === 0) {
          marker.bindTooltip(escapeHtml(st.en), {
            permanent: true,
            direction: 'right',
            offset: [r + 3, 0],
            className: 'metro-station-label',
            opacity: 1
          });
        } else {
          marker.bindTooltip(this.stationTipHtml(key), {
            direction: 'top',
            offset: [0, -r - 2],
            className: 'metro-tooltip',
            opacity: 1
          });
        }
        marker.on('click', () => this.openStationPopup(key, st.at[lineId]));
        this.stationLayer.addLayer(marker);
      });
    }
  }

  // ───────────────────────── stazioni ─────────────────────────

  private stationLines(key: string): MetroLine[] {
    return (this.linesByStation.get(key) ?? [])
      .map((id) => this.lines.get(id)!.def)
      .sort((a, b) => GROUP_ORDER[b.group] - GROUP_ORDER[a.group] || a.id.localeCompare(b.id, 'en', { numeric: true }));
  }

  private stationTipHtml(key: string): string {
    const st = this.data.stations[key];
    return `<div class="metro-tip"><div><strong>${escapeHtml(st.en)}</strong><span>${escapeHtml(st.ko)}</span><div class="metro-badges">${this.stationLines(key)
      .map((l) => lineBadgeHtml(l))
      .join('')}</div></div></div>`;
  }

  private openStationPopup(key: string, pos: LatLng) {
    const st = this.data.stations[key];
    const lines = this.stationLines(key);
    const naver = `https://map.naver.com/p/search/${encodeURIComponent(stationSearchName(key))}`;
    const google = `https://www.google.com/maps/search/?api=1&query=${pos[0]},${pos[1]}`;
    const html = `
      <div class="metro-popup">
        <div class="metro-popup-kicker">Stazione${lines.length > 1 ? ` · interscambio ${lines.length} linee` : ''}</div>
        <div class="metro-popup-title">${escapeHtml(st.en)}</div>
        <div class="metro-popup-ko">${escapeHtml(st.ko)}역</div>
        <div class="metro-popup-lines">
          ${lines
            .map(
              (l) =>
                `<button type="button" data-metro-line="${l.id}" title="Seleziona ${escapeHtml(l.it)}">${lineBadgeHtml(l)}<span>${escapeHtml(l.it)}</span></button>`
            )
            .join('')}
        </div>
        <div class="metro-popup-links">
          <a href="${naver}" target="_blank" rel="noopener noreferrer">Naver Map ↗</a>
          <span>·</span>
          <a href="${google}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
        </div>
      </div>`;
    L.popup({ offset: [0, -4], maxWidth: 280, className: 'metro-station-popup' }).setLatLng(pos).setContent(html).openOn(this.map);
  }

  // ───────────────────────── eventi ─────────────────────────

  private handleZoom = () => {
    if (this.activeRoute) return;
    this.restyleAll();
    this.renderStations();
  };

  /** Click sulla mappa fuori dalle linee: toglie la selezione. */
  private handleMapClick = () => {
    if (this.selected) this.opts.onSelectLine(null);
  };

  /** I bollini delle linee nel popup di una stazione selezionano quella linea. */
  private handlePopupOpen = (e: L.PopupEvent) => {
    const el = e.popup.getElement();
    if (!el) return;
    el.querySelectorAll<HTMLButtonElement>('[data-metro-line]').forEach((btn) => {
      btn.onclick = () => {
        this.opts.onSelectLine(btn.dataset.metroLine!);
        this.map.closePopup();
      };
    });
  };
}
