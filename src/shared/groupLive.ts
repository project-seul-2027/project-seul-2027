/**
 * Gruppo in tempo reale: "Sono a casa", posizione condivisa a tempo e punti di ritrovo.
 * Tipi e regole comuni a servizio, schermate e mappa.
 */
import type { TravelerSlotId } from './travelerProfile';

export type LiveStatus = 'home' | 'out';

export interface SharedPosition {
  lat: number;
  lng: number;
  /** Precisione in metri */
  acc: number;
  /** Ultimo aggiornamento (ms) */
  at: number;
  /** Fino a quando è condivisa (ms) */
  until: number;
}

/** live/{uid}: un documento per persona */
export interface LiveDoc {
  uid: string;
  slot: TravelerSlotId;
  status: LiveStatus | null;
  statusAt: number | null;
  /** Nome dell'alloggio quando è "a casa" */
  place: string;
  share: SharedPosition | null;
  /** "Ho perso il gruppo": quando l'ho segnalato (ms), oppure null */
  lost: number | null;
  updatedAt: number | null;
}

export type MeetupAnswer = 'ok' | 'late' | 'no';

/** meetups/{id}: punto di ritrovo con ora e risposte */
export interface Meetup {
  id: string;
  label: string;
  /** Luogo della mappa (MAP_LOCATIONS), se scelto da lì */
  placeId: string | null;
  lat: number;
  lng: number;
  /** Ora del ritrovo (ms) */
  at: number;
  note: string;
  createdBy: string;
  createdAt: number | null;
  answers: Partial<Record<TravelerSlotId, MeetupAnswer>>;
  /** Punto fisso del giorno ("se ci perdiamo ci vediamo qui"): senza ora né risposte */
  fixed: boolean;
}

export interface MeetupInput {
  label: string;
  placeId: string | null;
  lat: number;
  lng: number;
  at: number;
  note: string;
  fixed?: boolean;
}

/** Oltre questo tempo "a casa" non vale più (il giorno dopo si riparte da capo) */
export const STATUS_TTL_MS = 12 * 3_600_000;
/** Una posizione senza aggiornamenti da più di così è "vecchia" */
export const STALE_POSITION_MS = 20 * 60_000;
/** Un ritrovo resta visibile fino a 2 ore dopo l'orario */
export const MEETUP_GRACE_MS = 2 * 3_600_000;

/** "Ho perso il gruppo" resta attivo al massimo 2 ore */
export const LOST_TTL_MS = 2 * 3_600_000;

export const ANSWER_LABEL: Record<MeetupAnswer, string> = { ok: 'Ci sono', late: 'In ritardo', no: 'Non vengo' };

export function activeShare(d: LiveDoc, now: number): SharedPosition | null {
  return d.share && d.share.until > now ? d.share : null;
}

export function isHome(d: LiveDoc, now: number): boolean {
  return d.status === 'home' && !!d.statusAt && now - d.statusAt < STATUS_TTL_MS;
}

export function isLost(d: LiveDoc, now: number): boolean {
  return !!d.lost && now - d.lost >= 0 && now - d.lost < LOST_TTL_MS;
}

/** Ritrovi con un'ora (i punti fissi hanno una scheda a parte) */
export function upcomingMeetups(list: Meetup[], now: number): Meetup[] {
  return list.filter((m) => !m.fixed && m.at + MEETUP_GRACE_MS > now).sort((a, b) => a.at - b.at);
}

/** Il punto fisso più recente ancora valido (vale fino a fine giornata di Seul) */
export function fixedPoint(list: Meetup[], now: number): Meetup | null {
  const live = list.filter((m) => m.fixed && m.at > now).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return live[0] ?? null;
}

/** Le 23:59 di Seul del giorno di `now` */
export function endOfSeoulDay(now: number): number {
  const kst = new Date(now + 9 * 3_600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 23 - 9, 59);
}

/** Fine della condivisione "fino a domattina": le 6:00 di Seul successive */
export function untilMorning(now: number): number {
  const kst = new Date(now + 9 * 3_600_000);
  const six = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 6 - 9, 0);
  return six > now ? Math.min(six, now + 12 * 3_600_000) : Math.min(six + 86_400_000, now + 12 * 3_600_000);
}

export function formatAgo(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  return `${h} h fa`;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} km`;
}

/** Ora di Seul "HH:MM" */
export function seoulClock(ms: number): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}
