import type { MapLocation } from '../data/tripData';
import type { LatLng, MetroNetwork } from '../data/seoulMetro';
import type { SharedPlace } from '../shared/places';
import { placeToLocation } from '../components/places/placeLocation';
import { romanize } from '../utils/romanize';
import { distanceMeters } from './geo';

/**
 * Ricerca unica della mappa, offline: tappe dell'itinerario, luoghi salvati dal gruppo e stazioni della metro.
 * Si cerca senza accenti né maiuscole, anche per quartiere, categoria, nome coreano e sua lettura latina.
 */
export type SearchKind = 'stop' | 'place' | 'station';

export interface SearchItem {
  kind: SearchKind;
  loc: MapLocation;
  /** Testo in cui cercare, già normalizzato */
  haystack: string;
  /** Parole del nome, per dare più peso a chi inizia con quello che si scrive */
  nameWords: string[];
}

export const STATION_ID_PREFIX = 'station:';

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Una stazione della metro come posto sulla mappa: id "station:<chiave>", categoria logistica. */
export function stationToLocation(network: MetroNetwork, key: string): MapLocation | null {
  const st = network.stations[key];
  if (!st) return null;
  const pos = Object.values(st.at)[0];
  if (!pos) return null;
  const lines = network.lines.filter((l) => l.chains.some((c) => c.stations.includes(key)));
  return {
    id: `${STATION_ID_PREFIX}${key}`,
    name: st.en,
    italianName: st.en,
    koreanName: st.ko,
    district: lines.map((l) => l.it).join(' · ') || 'Metro',
    city: 'Seul',
    category: 'logistica',
    lat: pos[0],
    lng: pos[1],
    dayNumbers: [],
    description: `Stazione della metro: ${lines.map((l) => l.it).join(', ')}.`
  };
}

const KIND_LABEL: Record<SearchKind, string> = { stop: 'Tappa', place: 'Luogo salvato', station: 'Stazione' };
export const kindLabel = (k: SearchKind) => KIND_LABEL[k];

export function buildSearchIndex(stops: MapLocation[], places: SharedPlace[], network: MetroNetwork | null): SearchItem[] {
  const items: SearchItem[] = [];
  const push = (kind: SearchKind, loc: MapLocation, extra = '') => {
    const name = [loc.italianName, loc.name, loc.koreanName ?? '', loc.koreanName ? romanize(loc.koreanName) : ''].join(' ');
    items.push({
      kind,
      loc,
      haystack: fold([name, loc.district, loc.city, loc.category, extra].join(' ')),
      nameWords: fold(name).split(' ').filter(Boolean)
    });
  };
  for (const s of stops) push('stop', s, s.accommodationCode ? `alloggio ${s.accommodationCode}` : '');
  for (const p of places) push('place', placeToLocation(p), p.address ?? '');
  if (network) {
    for (const key of Object.keys(network.stations)) {
      const loc = stationToLocation(network, key);
      if (loc) push('station', loc, 'metro stazione');
    }
  }
  return items;
}

export interface SearchResult {
  item: SearchItem;
  /** Metri da dove sei, se la posizione è nota */
  meters: number | null;
}

/** Risultati in ordine: nome che inizia con il testo, poi nome che lo contiene, poi il resto; a pari punti, il più vicino. */
export function searchLocal(items: SearchItem[], query: string, here: LatLng | null, limit = 12): SearchResult[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const terms = q.split(' ');
  const scored: { r: SearchResult; score: number }[] = [];
  for (const item of items) {
    if (!terms.every((t) => item.haystack.includes(t))) continue;
    let score = 1;
    if (item.nameWords.some((w) => w.startsWith(terms[0]))) score = 3;
    else if (item.nameWords.join(' ').includes(q)) score = 2;
    if (item.kind === 'station') score -= 0.5;
    const meters = here ? distanceMeters(here, [item.loc.lat, item.loc.lng]) : null;
    scored.push({ r: { item, meters }, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.r.meters ?? 1e12) - (b.r.meters ?? 1e12) ||
      a.r.item.loc.italianName.localeCompare(b.r.item.loc.italianName)
  );
  return scored.slice(0, limit).map((s) => s.r);
}

/* ── Ricerche recenti, solo su questo telefono ── */
const RECENT_KEY = 'seul2027.map.recent';
const RECENT_MAX = 8;

export function recentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(text: string): void {
  const t = text.trim();
  if (t.length < 2) return;
  try {
    const list = [t, ...recentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* senza storage non si ricordano */
  }
}

/* ── Link esterni ── */
export const kakaoMapUrl = (loc: { italianName: string; koreanName?: string; lat: number; lng: number }) =>
  `https://map.kakao.com/link/map/${encodeURIComponent((loc.koreanName ?? loc.italianName).split('/')[0].trim())},${loc.lat},${loc.lng}`;
export const kakaoSearchUrl = (q: string) => `https://map.kakao.com/link/search/${encodeURIComponent(q)}`;
export const naverSearchUrl = (q: string) => `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
export const googleMapUrl = (loc: { lat: number; lng: number }) => `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
