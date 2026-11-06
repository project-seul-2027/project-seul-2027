/**
 * Itinerario letto dall'ultimo PDF caricato dal Partecipante 1.
 * Il programma incluso nel sito (ITINERARY_DAYS) viene sostituito sul posto, così tutte le schede
 * che lo importano lo vedono cambiare; gli orari (tripClock) e i giorni delle tappe sulla mappa si ricalcolano.
 * L'ultimo itinerario ricevuto resta anche sul telefono, per aprirlo senza rete.
 */
import { useSyncExternalStore } from 'react';
import { ITINERARY_DAYS, recomputeLocationDays, type ItineraryDay } from '../data/tripData';
import { rebuildTimedDays } from './tripClock';

const CACHE_KEY = 'seul-itinerary-override-v1';

/** Programma incluso nel sito, com'era prima di qualunque PDF: serve per confrontare e per ripristinare. */
const PRISTINE: ItineraryDay[] = JSON.parse(JSON.stringify(ITINERARY_DAYS));
export const builtInItinerary = (): ItineraryDay[] => JSON.parse(JSON.stringify(PRISTINE));

export interface ItineraryOverrideDoc {
  /** Istante del PDF da cui deriva (stesso valore di appFiles/itineraryPdf.updatedAt) */
  pdfUpdatedAt: number;
  updatedAt: number;
  /** JSON dei giorni (ItineraryDay[]) */
  json: string;
  /** Esito per giorno, per il riepilogo */
  report: string;
}

let version = 0;
let activeStamp = 0;
const listeners = new Set<() => void>();

/** Controllo minimo: 20 giorni, con id in ordine e programma leggibile. */
export function isValidItinerary(v: unknown): v is ItineraryDay[] {
  if (!Array.isArray(v) || v.length !== PRISTINE.length) return false;
  return v.every(
    (d, i) =>
      d &&
      d.id === i &&
      typeof d.title === 'string' &&
      typeof d.dateStr === 'string' &&
      Array.isArray(d.locationIds) &&
      Array.isArray(d.schedule) &&
      d.schedule.every((s: any) => s && typeof s.time === 'string' && typeof s.activity === 'string')
  );
}

function replaceDays(days: ItineraryDay[]): void {
  ITINERARY_DAYS.splice(0, ITINERARY_DAYS.length, ...days);
  recomputeLocationDays();
  rebuildTimedDays();
  version += 1;
  listeners.forEach((l) => l());
}

/** Applica (o toglie, con null) l'itinerario da PDF. Ritorna false se i dati non sono validi. */
export function applyItineraryOverride(doc: ItineraryOverrideDoc | null): boolean {
  try {
    if (!doc) {
      if (activeStamp === 0) return true;
      replaceDays(builtInItinerary());
      activeStamp = 0;
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
        /* niente copia da togliere */
      }
      return true;
    }
    if (doc.updatedAt === activeStamp) return true;
    const days = JSON.parse(doc.json);
    if (!isValidItinerary(days)) return false;
    replaceDays(days);
    activeStamp = doc.updatedAt;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(doc));
    } catch {
      /* spazio finito: si userà la rete */
    }
    return true;
  } catch {
    return false;
  }
}

// Subito all'avvio: l'ultimo itinerario ricevuto, prima che arrivi la rete
try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) applyItineraryOverride(JSON.parse(raw));
} catch {
  /* nessuna copia salvata */
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
/** Cambia ogni volta che il programma viene sostituito: serve a ridisegnare le schede. */
export const useItineraryVersion = (): number => useSyncExternalStore(subscribe, () => version);
