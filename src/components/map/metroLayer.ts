import L from 'leaflet';
import {
  readableTextOn,
  stationSearchName,
  type LatLng,
  type MetroLine,
  type MetroNetwork
} from '../../data/seoulMetro';

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

/**
 * Linee metro disegnate sopra la mappa (canvas): si possono mostrare/nascondere una per una,
 * evidenziare passandoci sopra e selezionare con un click. Le stazioni compaiono in base allo zoom.
 */
export class MetroLayer {
  private readonly renderer: L.Canvas;
  private readonly lines = new Map<string, LineLayers>();
  private readonly stationLayer = L.layerGroup();
  private readonly linesByStation = new Map<string, string[]>();
  private visible = new Set<string>();
  private selected: string | null = null;
  private hovered: string | null = null;
  private theme: MetroTheme = 'dark';

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
    map.on('zoomend', this.handleZoom);
    map.on('click', this.handleMapClick);
    map.on('popupopen', this.handlePopupOpen);
  }

  // ───────────────────────── API pubblica ─────────────────────────

  setVisible(ids: Iterable<string>) {
    this.visible = new Set(ids);
    this.redraw();
  }

  setSelected(id: string | null) {
    this.selected = id && this.lines.has(id) ? id : null;
    this.redraw();
  }

  setTheme(theme: MetroTheme) {
    this.theme = theme;
    this.map.getContainer().classList.toggle('metro-dark', theme === 'dark');
    this.restyleAll();
    this.renderStations();
  }

  /** Inquadra tutta la linea. */
  fitLine(id: string) {
    const line = this.lines.get(id);
    if (line) this.map.fitBounds(line.bounds, { padding: [36, 36], maxZoom: 14 });
  }

  /** Centra la mappa su una stazione e apre la sua scheda. */
  focusStation(key: string, lineId?: string) {
    const st = this.data.stations[key];
    if (!st) return;
    const pos = (lineId && st.at[lineId]) || Object.values(st.at)[0];
    const zoom = Math.max(this.map.getZoom(), 15);
    this.map.once('moveend', () => this.openStationPopup(key, pos));
    this.map.setView(pos, zoom, { animate: true });
  }

  destroy() {
    this.map.off('zoomend', this.handleZoom);
    this.map.off('click', this.handleMapClick);
    this.map.off('popupopen', this.handlePopupOpen);
    for (const l of this.lines.values()) {
      l.casing.remove();
      l.stroke.remove();
    }
    this.stationLayer.remove();
    this.renderer.remove();
    this.map.getContainer().classList.remove('metro-dark');
  }

  // ───────────────────────── disegno ─────────────────────────

  /**
   * Riaggiunge i livelli nell'ordine giusto: prima tutti i bordi, poi i colori (così gli incroci
   * restano puliti), la linea selezionata sopra le altre e le stazioni sopra a tutto.
   */
  private redraw() {
    for (const l of this.lines.values()) {
      l.casing.remove();
      l.stroke.remove();
    }
    const ordered = [...this.lines.values()]
      .filter((l) => this.visible.has(l.def.id) && l.def.id !== this.selected)
      .sort(
        (a, b) =>
          GROUP_ORDER[a.def.group] - GROUP_ORDER[b.def.group] ||
          // linee 9 → 1: la 1 finisce in cima dove i binari si sovrappongono
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
