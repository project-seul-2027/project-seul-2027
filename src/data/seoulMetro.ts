/**
 * Rete metro e treni urbani di Seul (linee 1–9, AREX, Gyeongui-Jungang, Suin-Bundang, Shinbundang…).
 *
 * I tracciati vengono dai binari reali di OpenStreetMap (relazioni route=subway/train/light_rail),
 * semplificati con tolleranza di 3 m: le linee seguono la geometria vera, non uno schema.
 * Il file JSON (≈190 KB, ≈60 KB compresso) si carica solo quando si apre la mappa.
 * Dati © OpenStreetMap contributors, licenza ODbL: l'attribuzione va mostrata sulla mappa.
 */

export type LatLng = [number, number];

export type MetroGroup = 'metro' | 'rail' | 'light' | 'other';

export interface MetroChain {
  /** true per gli anelli (linea 2, anello di Eungam della linea 6) */
  loop: boolean;
  /** Tracciato [lat, lng] lungo il binario */
  path: LatLng[];
  /** Stazioni in ordine di percorrenza (chiavi di `MetroNetwork.stations`) */
  stations: string[];
  /** Indice in `path` del punto più vicino a ogni stazione */
  at: number[];
}

export interface MetroLine {
  id: string;
  /** Nome coreano ufficiale (es. 2호선) */
  ko: string;
  /** Nome in italiano mostrato nel sito */
  it: string;
  /** Nome inglese ufficiale (come sui cartelli in stazione) */
  en: string;
  /** Testo del bollino colorato */
  short: string;
  /** Colore ufficiale della linea */
  color: string;
  group: MetroGroup;
  defaultVisible: boolean;
  /** Una linea è formata da uno o più rami */
  chains: MetroChain[];
}

export interface MetroStation {
  ko: string;
  en: string;
  /** Posizione della banchina per ogni linea che serve la stazione */
  at: Record<string, LatLng>;
}

export interface MetroNetwork {
  source: string;
  attribution: string;
  generated: string;
  lines: MetroLine[];
  stations: Record<string, MetroStation>;
}

export const METRO_GROUPS: { id: MetroGroup; label: string; hint: string }[] = [
  { id: 'metro', label: 'Metropolitana di Seul', hint: 'Linee 1–9' },
  { id: 'rail', label: 'Aeroporto e treni urbani', hint: 'AREX, Korail, GTX' },
  { id: 'light', label: 'Metro leggere di Seul', hint: 'Ui-Sinseol, Sillim' },
  { id: 'other', label: 'Altre città', hint: 'Incheon, Gimpo, Uijeongbu, Yongin' }
];

let cache: Promise<MetroNetwork> | null = null;

/** Carica (una sola volta) la rete metro. */
export function loadSeoulMetro(): Promise<MetroNetwork> {
  cache ??= import('./seoulMetro.json')
    .then((m) => m.default as unknown as MetroNetwork)
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLng = (b[1] - a[1]) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Lunghezza della linea in km (somma dei rami). */
export function lineLengthKm(line: MetroLine): number {
  let m = 0;
  for (const c of line.chains) for (let i = 1; i < c.path.length; i++) m += haversine(c.path[i - 1], c.path[i]);
  return m / 1000;
}

/** Stazioni distinte della linea (una stazione condivisa tra due rami conta una volta). */
export function lineStationKeys(line: MetroLine): string[] {
  return [...new Set(line.chains.flatMap((c) => c.stations))];
}

/** Nome della stazione da cercare su Naver Map / Kakao Map (es. "홍대입구역"). */
export function stationSearchName(key: string): string {
  const base = key.split('@')[0];
  return base.endsWith('역') ? base : `${base}역`;
}

/** Colore del testo leggibile sopra il colore della linea (giallo, oliva, verde chiaro → testo scuro). */
export function readableTextOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Bianco come sui cartelli ufficiali, finché resta leggibile (contrasto ≥ 2.4 per testo in grassetto)
  return 1.05 / (luminance + 0.05) >= 2.4 ? '#ffffff' : '#0b1220';
}

/** Testo normalizzato per la ricerca (minuscolo, senza accenti, spazi e punteggiatura). */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s.'’·()\-]/g, '');
}
