/**
 * Conto alla rovescia del viaggio: un solo calcolo, usato da telefono e desktop.
 * Il conto c'è fino all'atterraggio a Seul; durante il viaggio in Corea non c'è nessun conto,
 * né per il rientro. Gli istanti vengono dal programma (TIMED_DAYS).
 */
import { TIMED_DAYS, locateNow } from './tripClock';



const MEETUP_TS = Date.parse('2027-03-01T10:00:00+01:00');

function milestone(dayId: number, prefix: string, fallback: number): number {
  const hit = TIMED_DAYS[dayId]?.items.find((t) => t.item.time.startsWith(prefix));
  return hit ? hit.ts : fallback;
}

const fmt = (ts: number, tz: string) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(ts));

export interface LaunchState {
  kind: 'countdown' | 'departing' | 'trip';
  /** Traguardo del conto alla rovescia (solo kind = countdown) */
  target: number;
  eyebrow: string;
  caption: string;
  dayN: number;
  dayTotal: number;
  /** Titolo della giornata in corso (solo kind = trip) */
  title: string;
}

export function launchState(now: number): LaunchState {
  // Gli istanti vengono dal programma di adesso: se arriva un nuovo PDF cambiano con lui.
  const DEPART_TS = milestone(0, '12:30', Date.parse('2027-03-01T12:30:00+01:00'));
  const PEK_TS = milestone(1, '05:35', Date.parse('2027-03-02T05:35:00+08:00'));
  const ICN_TS = milestone(1, '11:40', Date.parse('2027-03-02T11:40:00+09:00'));
  const LAST = TIMED_DAYS[TIMED_DAYS.length - 1];
  const dayTotal = TIMED_DAYS.length;
  const base = { target: 0, dayN: 0, dayTotal, title: '' };

  if (now < MEETUP_TS) {
    return { ...base, kind: 'countdown', target: MEETUP_TS, eyebrow: 'Prossimo ritrovo · Malpensa T1', caption: 'Lunedì 1 marzo 2027, ore 10:00 italiane. Poi scalo a Pechino e Seul fino al 19 marzo.' };
  }
  if (now < DEPART_TS) {
    return { ...base, kind: 'departing', eyebrow: 'Ritrovo a Malpensa T1 · ore 10:00', caption: `Decollo alle ${fmt(DEPART_TS, 'Europe/Rome')}, ora italiana. Poi il conto va verso Pechino.` };
  }
  if (now < PEK_TS) {
    return { ...base, kind: 'countdown', target: PEK_TS, eyebrow: 'Verso Pechino · atterraggio', caption: `Atterraggio a Pechino alle ${fmt(PEK_TS, 'Asia/Shanghai')}, ora di Pechino. Poi lo scalo.` };
  }
  if (now < ICN_TS) {
    return { ...base, kind: 'countdown', target: ICN_TS, eyebrow: 'Verso Seul · arrivo a Incheon', caption: `Atterraggio a Incheon alle ${fmt(ICN_TS, 'Asia/Seoul')}, ora di Seul. Poi AREX fino all'alloggio.` };
  }

  const dayIndex = locateNow(now).dayIndex;
  const dayN = dayIndex + 1;
  return {
    ...base,
    kind: 'trip',
    dayN,
    title: TIMED_DAYS[dayIndex].day.title,
    eyebrow: `Giorno ${dayN} di ${dayTotal} · Corea del Sud`,
    caption: `Fino a ${LAST.day.dayOfWeek} ${LAST.day.dateStr.replace(' 2027', '')}.`,
  };
}

/** Scomposizione di una durata in giorni, ore, minuti, secondi */
export function splitDuration(ms: number) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days: Math.floor(total / 86_400),
    hh: pad(Math.floor((total % 86_400) / 3_600)),
    mm: pad(Math.floor((total % 3_600) / 60)),
    ss: pad(total % 60),
  };
}
