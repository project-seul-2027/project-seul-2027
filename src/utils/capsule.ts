/**
 * Capsula del tempo: sei traguardi prima della partenza (1 marzo 2027).
 * Ognuno si apre alle 18:00 italiane del giorno giusto e resta aperto 48 ore; a 46 ore chi non ha ancora risposto
 * riceve l'avviso che sta per chiudersi. Puro calcolo, senza interfaccia né Firebase: lo usano l'app e lo script del server.
 */

export const MILESTONES = [100, 50, 30, 14, 7, 1] as const;
export type Milestone = (typeof MILESTONES)[number];
export const REOPEN_100_AT = Date.UTC(2026, 10, 23, 17, 10);
export const REOPEN_100_END = Date.UTC(2026, 10, 24, 17, 30);

const HOUR = 3_600_000;
/** Quanto resta aperto un traguardo */
export const WINDOW_MS = 48 * HOUR;
/** Quando parte l'avviso di chiusura (a 46 ore dall'apertura = 2 ore alla fine) */
export const REMINDER_AFTER_MS = 46 * HOUR;
/** Recupera i controlli in ritardo, senza inviare promemoria dopo la chiusura. */
export const OPEN_LOOKBACK_MS = 24 * HOUR;
export const CLOSING_LOOKBACK_MS = WINDOW_MS - REMINDER_AFTER_MS;

/** Orario in Italia in cui si possono mandare avvisi: di notte si aspetta la mattina (l'avviso di apertura resta valido 24 ore) */
export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 8;
export function isQuietRome(ms: number): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms)));
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/** Le 18:00 in Italia sono le 17:00 UTC finché c'è l'ora solare (fino al 28 marzo 2027: tutti i traguardi ci rientrano) */
export const fireAt = (m: Milestone): number => Date.UTC(2027, 2, 1 - m, 17, 0, 0);
export const closesAt = (m: Milestone): number => fireAt(m) + WINDOW_MS;
export const reminderAt = (m: Milestone): number => fireAt(m) + REMINDER_AFTER_MS;

export type CapsuleState = 'upcoming' | 'open' | 'closed';
export const stateOf = (m: Milestone, now: number): CapsuleState =>
  m === 100 && now >= REOPEN_100_AT && now < REOPEN_100_END ? 'open'
    : now < fireAt(m) ? 'upcoming' : now < closesAt(m) ? 'open' : 'closed';
export const activeClosesAt = (m: Milestone, now: number): number =>
  m === 100 && now >= REOPEN_100_AT && now < REOPEN_100_END ? REOPEN_100_END : closesAt(m);

/** Il traguardo aperto adesso, se c'è (le finestre non si sovrappongono mai: tra due traguardi passano almeno 6 giorni) */
export const openMilestone = (now: number): Milestone | null => MILESTONES.find((m) => stateOf(m, now) === 'open') ?? null;

/** Quello da mostrare per primo: l'aperto, altrimenti il prossimo, altrimenti l'ultimo */
export function defaultMilestone(now: number): Milestone {
  return openMilestone(now) ?? MILESTONES.find((m) => stateOf(m, now) === 'upcoming') ?? MILESTONES[MILESTONES.length - 1];
}

/** Un promemoria utile, in una riga, per ogni traguardo: così un solo avviso vale per due cose */
const TIPS: Record<Milestone, string> = {
  100: 'Intanto: passaporto in ordine?',
  50: 'Controlla che il passaporto sia valido.',
  30: 'Ricontrolla voli e assicurazione.',
  14: 'È ora di iniziare la valigia.',
  7: 'Dai un’occhiata al meteo di Seul.',
  1: 'Ritrovo a Malpensa T1, domani alle 10:00.'
};

const romeClock = (ms: number): string =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

export interface CapsuleMessage {
  /** Chiave anti-doppione (documento pushLog) */
  key: string;
  title: string;
  body: string;
}

export function capsuleMessage(m: Milestone, kind: 'open' | 'closing'): CapsuleMessage {
  if (kind === 'closing') {
    return {
      key: `cap-${m}-closing`,
      // Niente "tra 2 ore": se l'avviso arriva in ritardo non sarebbe più vero; l'orario di chiusura è sempre giusto
      title: 'La capsula sta per chiudere',
      body: `Chiude alle ${romeClock(closesAt(m))}. Manca la tua risposta ${m === 1 ? 'dell’ultimo giorno' : `dei ${m} giorni`}: bastano una riga o una foto.`
    };
  }
  return {
    key: `cap-${m}-open`,
    title: m === 1 ? 'Domani si parte' : `${m} giorni a Seul`,
    body: `Cosa stai facendo adesso? Una foto o una riga: vedi quelle degli altri appena rispondi. ${TIPS[m]}`
  };
}
