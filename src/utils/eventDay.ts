import type { ItineraryDay } from '../data/tripData';

/** Il luogo sulla mappa dell'evento: compare solo nel giorno della finale */
export const EVENT_LOCATION_ID = 'valorant_masters_arena';

const FINAL = /grand final|finale/;

const bodyOf = (d: ItineraryDay) =>
  [d.title, d.subtitle, d.description, ...(d.schedule ?? []).flatMap((s) => [s.summary ?? '', s.activity]), ...(d.bulletPoints ?? [])]
    .join(' ')
    .toLowerCase();

const count = (re: RegExp, text: string) => text.match(re)?.length ?? 0;

/**
 * Il giorno della finale del Valorant Masters: quello che nomina Valorant e la finale (più peso se lo dice il titolo).
 * Si ricava dal contenuto, così segue il programma anche quando il PDF caricato sposta la finale in un altro giorno.
 */
export function findFinalDayId(days: ItineraryDay[]): number | null {
  let best: { id: number; score: number } | null = null;
  for (const d of days) {
    const body = bodyOf(d);
    const title = d.title.toLowerCase();
    // Serve Valorant e la finale nel testo del giorno; basta Valorant nel titolo per i PDF che non scrivono "finale"
    if (!body.includes('valorant') || !(FINAL.test(body) || title.includes('valorant'))) continue;
    const score = (title.includes('valorant') ? 3 : 0) + (FINAL.test(title) ? 3 : 0) + count(/valorant/g, body) + count(/grand final|finale/g, body);
    if (!best || score > best.score) best = { id: d.id, score };
  }
  return best?.id ?? null;
}

/**
 * Segna come "evento speciale" solo il giorno della finale e lascia il luogo dell'evento solo a quel giorno:
 * colore, etichetta, avviso e pin sulla mappa si legano così a un unico giorno. Senza finale nel programma nessun giorno è segnato.
 */
export function markEventDay(days: ItineraryDay[]): ItineraryDay[] {
  const finalId = findFinalDayId(days);
  for (const d of days) {
    const isFinal = d.id === finalId;
    d.isSpecialEvent = isFinal || undefined;
    const others = d.locationIds.filter((id) => id !== EVENT_LOCATION_ID);
    d.locationIds = isFinal ? [EVENT_LOCATION_ID, ...others] : others;
  }
  return days;
}
