/**
 * Avvisi del viaggio: cosa va ricordato e quando. Puro calcolo, senza interfaccia: lo usano sia l'app
 * (notifiche sul telefono mentre è aperta) sia lo script del server (scripts/trip-push.mts).
 */
import { TIMED_DAYS } from './tripClock';
import { TRIP_REMINDERS, reminderApplies } from './tripReminders';
import type { TravelerSlotId } from '../shared/travelerProfile';

export type AlertCategory = 'schedule' | 'bookings' | 'group' | 'updates';

export const ALERT_CATEGORIES: { id: AlertCategory; label: string; hint: string }[] = [
  { id: 'schedule', label: 'Programma', hint: '30 minuti prima dei momenti importanti della giornata' },
  { id: 'bookings', label: 'Prenotazioni e voli', hint: 'Check-in, voli, treni e scadenze' },
  { id: 'group', label: 'Gruppo', hint: 'Nuovi ritrovi, punto fisso e “ho perso il gruppo”' },
  { id: 'updates', label: 'Aggiornamenti', hint: 'Nuove versioni dell’app e avvisi mandati a mano' }
];

export interface TripAlert {
  id: string;
  category: AlertCategory;
  /** Quando va mandato (ms) */
  fireAt: number;
  /** Quando succede la cosa (ms) */
  eventAt: number;
  title: string;
  what: string;
  audience: 'all' | 'leaver' | 'stayers';
}

const MIN = 60_000;
const SCHEDULE_LEAD_MIN = 30;

const shorten = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
};

/** I momenti importanti del programma (con orario preciso) e i promemoria già scritti nel piano */
export function buildAllAlerts(): TripAlert[] {
  const out: TripAlert[] = [];
  for (const d of TIMED_DAYS) {
    d.items.forEach((it, i) => {
      if (it.approximate || !it.item.isHighlight) return;
      out.push({
        id: `sch-${d.day.id}-${i}`,
        category: 'schedule',
        fireAt: it.ts - SCHEDULE_LEAD_MIN * MIN,
        eventAt: it.ts,
        title: 'In programma',
        what: shorten(it.item.activity, 120),
        audience: 'all'
      });
    });
  }
  for (const r of TRIP_REMINDERS) {
    const at = Date.parse(r.at);
    for (const a of r.alarms) {
      out.push({
        id: `rem-${r.id}-${a}`,
        category: 'bookings',
        fireAt: at - a * MIN,
        eventAt: at,
        title: r.title.replace(/^Seul:\s*/i, ''),
        what: shorten(r.notes, 120),
        audience: r.audience
      });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

export const ALL_ALERTS = buildAllAlerts();

/** Quelli da mandare adesso: scattati da poco e con l'evento non ancora passato */
export function dueAlerts(now: number, lookbackMs = 15 * MIN, list: TripAlert[] = ALL_ALERTS): TripAlert[] {
  return list.filter((a) => a.fireAt <= now && a.fireAt > now - lookbackMs && a.eventAt > now - 10 * MIN);
}

export function alertApplies(a: TripAlert, slot: TravelerSlotId | undefined): boolean {
  return reminderApplies({ audience: a.audience } as Parameters<typeof reminderApplies>[0], slot);
}

/** "tra 25 minuti", "adesso", "tra 2 ore" */
export function relativeIt(ms: number): string {
  const min = Math.round(ms / MIN);
  if (min <= 0) return 'adesso';
  if (min === 1) return 'tra 1 minuto';
  if (min < 90) return `tra ${min} minuti`;
  const h = Math.round(min / 60);
  return h < 36 ? `tra ${h} ore` : `tra ${Math.round(h / 24)} giorni`;
}

/** Testo da mostrare, calcolato al momento dell'invio (così "tra 30 minuti" è sempre vero) */
export function alertMessage(a: TripAlert, now: number): { title: string; body: string } {
  const rel = relativeIt(a.eventAt - now);
  return a.category === 'schedule'
    ? { title: `In programma ${rel}`, body: a.what }
    : { title: a.title, body: `${rel.charAt(0).toUpperCase()}${rel.slice(1)} · ${a.what}` };
}

/** Di notte (23:00-07:00 a Seul) il programma non disturba; voli e prenotazioni sì, perché non si possono perdere */
export function isQuietHour(ms: number): boolean {
  const h = new Date(ms + 9 * 3_600_000).getUTCHours();
  return h >= 23 || h < 7;
}

/** Stima grossolana del viaggio da un punto all'altro in città (a piedi o con i mezzi), in minuti */
export function estimateTravelMinutes(distanceM: number): number {
  if (distanceM < 1200) return Math.max(2, Math.round(distanceM / 75));
  // mezzi: ~20 km/h in media + 10 minuti tra attesa, cambi e camminata
  return Math.round((distanceM / 1000) * 3 + 10);
}
