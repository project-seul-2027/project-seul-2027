/**
 * Chi è in viaggio in un certo giorno. Pietro (posto t1) riparte il 10 marzo all'alba:
 * dal 10 non partecipa più a spese, ritrovi e costi di gruppo.
 */
import type { TravelerSlotId } from './travelerProfile';
import { TRAVELER_SLOT_IDS } from './travelerProfile';

/** Posto di chi riparte prima */
export const LEAVER_SLOT: TravelerSlotId = 't1';
/** Ultimo giorno intero a Seul di chi riparte prima (AAAA-MM-GG) */
export const LEAVER_LAST_DAY = '2027-03-09';
/** Giorno della partenza anticipata, per gli avvisi */
export const LEAVER_DEPARTURE_DAY = '2027-03-10';

/** Posti presenti in una data (AAAA-MM-GG). Fuori dal viaggio: tutti. */
export function presentSlots(dateIso: string): TravelerSlotId[] {
  return TRAVELER_SLOT_IDS.filter((s) => !(s === LEAVER_SLOT && dateIso > LEAVER_LAST_DAY && dateIso <= '2027-03-21'));
}

/** Data di oggi a Seul (AAAA-MM-GG) per un istante */
export function seoulDateIso(ms: number): string {
  return new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** Istante "adesso", oppure quello simulato con ?sim=AAAA-MM-GGTHH:mm (ora di Seul) per l'anteprima */
export function nowOrSim(): number {
  try {
    const v = new URLSearchParams(window.location.search).get('sim');
    if (v) {
      const t = Date.parse(`${v}:00+09:00`);
      if (!Number.isNaN(t)) return t;
    }
  } catch {
    /* niente anteprima */
  }
  return Date.now();
}
