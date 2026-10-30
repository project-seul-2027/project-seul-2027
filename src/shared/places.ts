/**
 * Luoghi condivisi: posti scoperti durante il viaggio (non nell'itinerario ufficiale).
 * Tipi, etichette e funzioni comuni a servizio, schermata e mappa.
 */
import type { TravelerSlotId } from './travelerProfile';

export type PlaceCategory = 'food' | 'shop' | 'sight' | 'night' | 'other';
export type PlacePriority = 'must' | 'nice' | 'low';
export type PlaceVote = 'up' | 'down';

export interface SharedPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  priority: PlacePriority;
  lat: number;
  lng: number;
  /** Link incollato (Naver, Google Maps, Instagram…) oppure vuoto */
  link: string;
  note: string;
  addedBy: string;
  addedBySlot: TravelerSlotId;
  createdAt: number | null;
  votes: Partial<Record<TravelerSlotId, PlaceVote>>;
  /** Già andati */
  visited: boolean;
}

export interface PlaceInput {
  name: string;
  category: PlaceCategory;
  priority: PlacePriority;
  lat: number;
  lng: number;
  link: string;
  note: string;
}

export const PLACE_CATEGORIES: { id: PlaceCategory; label: string; emoji: string; color: string }[] = [
  { id: 'food', label: 'Cibo', emoji: '🍜', color: '#f97316' },
  { id: 'shop', label: 'Negozi', emoji: '🛍️', color: '#ec4899' },
  { id: 'sight', label: 'Da vedere', emoji: '🏯', color: '#22c55e' },
  { id: 'night', label: 'Locali', emoji: '🍻', color: '#a855f7' },
  { id: 'other', label: 'Altro', emoji: '📍', color: '#94a3b8' }
];

export const PLACE_PRIORITIES: { id: PlacePriority; label: string; rank: number }[] = [
  { id: 'must', label: 'Da visitare', rank: 0 },
  { id: 'nice', label: 'Interessante', rank: 1 },
  { id: 'low', label: 'Non prioritario', rank: 2 }
];

export const categoryOf = (c: PlaceCategory) => PLACE_CATEGORIES.find((x) => x.id === c) ?? PLACE_CATEGORIES[4];
export const priorityOf = (p: PlacePriority) => PLACE_PRIORITIES.find((x) => x.id === p) ?? PLACE_PRIORITIES[1];

/** Punteggio dei voti: i "sì" meno i "no" */
export function placeScore(p: SharedPlace): number {
  let s = 0;
  for (const v of Object.values(p.votes)) s += v === 'up' ? 1 : v === 'down' ? -1 : 0;
  return s;
}

/** Prima quelli da visitare e votati, in fondo i già visitati */
export function sortPlaces(list: SharedPlace[]): SharedPlace[] {
  return [...list].sort((a, b) => {
    if (a.visited !== b.visited) return a.visited ? 1 : -1;
    const pr = priorityOf(a.priority).rank - priorityOf(b.priority).rank;
    if (pr) return pr;
    const sc = placeScore(b) - placeScore(a);
    if (sc) return sc;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

/* ---------- Link incollati ---------- */

export interface ParsedLink {
  url: string;
  /** Titolo/nome ricavato dal testo condiviso, se c'è */
  name: string;
  lat: number | null;
  lng: number | null;
}

const inKorea = (lat: number, lng: number) => lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
const inWorld = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Prova a leggere le coordinate da un link o da un testo condiviso (Google Maps, Naver, "37.55, 126.92").
 * I link brevi (maps.app.goo.gl, naver.me, instagram.com) non contengono coordinate: restituiscono solo l'indirizzo.
 */
export function parseSharedText(text: string, title = ''): ParsedLink {
  const raw = `${title}\n${text}`.trim();
  const url = /https?:\/\/[^\s<>"']+/.exec(raw)?.[0].replace(/[).,;]+$/, '') ?? '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* testo non codificato */
  }
  const tries: RegExp[] = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination|center|sll)=(-?\d{1,3}\.\d+)[, ](-?\d{1,3}\.\d+)/,
    /[?&]lat=(-?\d{1,3}\.\d+)&(?:lng|lon)=(-?\d{1,3}\.\d+)/,
    /(?:^|[^\d.])(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})(?![\d.])/
  ];
  let lat: number | null = null;
  let lng: number | null = null;
  for (const re of tries) {
    const m = re.exec(decoded);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (inKorea(a, b)) [lat, lng] = [a, b];
    else if (inKorea(b, a)) [lat, lng] = [b, a];
    else if (inWorld(a, b) && re === tries[0]) [lat, lng] = [a, b];
    if (lat !== null) break;
  }
  // Il nome: prima riga del testo che non sia un link o delle coordinate
  const lines = raw.split(/\n+/).map((l) => l.replace(/https?:\/\/\S+/g, '').trim()).filter((l) => l && !/^-?\d+\.\d+\s*,/.test(l));
  const name = (title.trim() && !/^https?:/.test(title.trim()) ? title.trim() : lines[0] ?? '').slice(0, 80);
  return { url, name, lat, lng };
}

export const isShortLink = (url: string) => /(?:maps\.app\.goo\.gl|goo\.gl|naver\.me|instagram\.com|instagr\.am)/i.test(url);

/** Indicazioni a piedi/mezzi fino al luogo */
export const directionsUrl = (p: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=transit`;
