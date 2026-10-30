/**
 * Promemoria del viaggio e creazione del file calendario (.ics).
 * Il file contiene gli allarmi: una volta importato, il telefono suona anche senza connessione
 * e senza aprire il sito. Gli orari sono scritti con il fuso del luogo e convertiti in UTC.
 */
import type { TravelerSlotId } from '../shared/travelerProfile';
import { LEAVER_SLOT } from '../shared/tripPresence';

export type ReminderAudience = 'all' | 'leaver' | 'stayers';

export interface TripReminder {
  id: string;
  /** Data e ora con il fuso del luogo, es. 2027-03-01T07:30:00+01:00 */
  at: string;
  durationMin: number;
  title: string;
  notes: string;
  audience: ReminderAudience;
  /** Minuti di anticipo degli allarmi (0 = all'ora esatta) */
  alarms: number[];
  /** Prima della partenza o durante il viaggio */
  phase: 'prima' | 'viaggio';
}

/** Chi riparte il 10 marzo: nel piano attuale è il partecipante 1 (Pietro). */
export const LEAVER_ID: TravelerSlotId = LEAVER_SLOT;

export const REMINDER_AUDIENCE_LABEL: Record<ReminderAudience, string> = {
  all: 'Tutti',
  leaver: 'Chi riparte il 10',
  stayers: 'Chi resta fino al 19'
};

export const TRIP_REMINDERS: TripReminder[] = [
  { id: 'doc-check', at: '2027-02-08T20:00:00+01:00', durationMin: 15, phase: 'prima', audience: 'all', alarms: [0],
    title: 'Seul: controlla passaporto e documenti',
    notes: 'Il passaporto deve valere almeno 6 mesi dopo il rientro. Verifica anche i requisiti d’ingresso (K-ETA) e che l’assicurazione di viaggio sia attiva.' },
  { id: 'valorant', at: '2027-02-20T18:00:00+01:00', durationMin: 15, phase: 'prima', audience: 'all', alarms: [0],
    title: 'Seul: controlla sede e orari del Valorant Masters',
    notes: 'Il torneo va dal 20 febbraio al 3 marzo. Sede, orari della finale e biglietti non erano ancora annunciati: aggiorna il piano del 3 marzo.' },
  { id: 'checkin-online', at: '2027-02-28T12:30:00+01:00', durationMin: 15, phase: 'prima', audience: 'all', alarms: [0],
    title: 'Seul: check-in online Air China',
    notes: 'Di solito si apre circa 24 ore prima. Scarica le carte d’imbarco di tutti i tratti (Milano-Pechino e Pechino-Incheon).' },
  { id: 'valigia', at: '2027-02-28T20:00:00+01:00', durationMin: 30, phase: 'prima', audience: 'all', alarms: [0],
    title: 'Seul: ultimo controllo valigia',
    notes: 'Power bank nel bagaglio a mano, passaporto, carica telefono, eSIM scaricata, valigia sotto i 23 kg.' },
  { id: 'sveglia-mxp', at: '2027-03-01T07:30:00+01:00', durationMin: 30, phase: 'viaggio', audience: 'all', alarms: [0, 30],
    title: 'Seul: parti per Malpensa',
    notes: 'Ritrovo al Terminal 1, banchi Air China, entro le 10:00. Malpensa Express da Milano Centrale: circa 50 minuti.' },
  { id: 'ritrovo-mxp', at: '2027-03-01T10:00:00+01:00', durationMin: 45, phase: 'viaggio', audience: 'all', alarms: [30, 0],
    title: 'Seul: ritrovo a Malpensa T1',
    notes: 'Check-in e bagagli tutti insieme. Chiedi le carte d’imbarco di tutti i tratti.' },
  { id: 'volo-1', at: '2027-03-01T12:30:00+01:00', durationMin: 600, phase: 'viaggio', audience: 'all', alarms: [60],
    title: 'Seul: decollo da Malpensa (Air China)',
    notes: 'Arrivo a Pechino alle 05:35 del 2 marzo (ora cinese). Poi “International Transfer”.' },
  { id: 'volo-2', at: '2027-03-02T08:40:00+08:00', durationMin: 120, phase: 'viaggio', audience: 'all', alarms: [90, 40],
    title: 'Seul: decollo da Pechino per Incheon',
    notes: 'Imbarco circa 40 minuti prima. Arrivo a Incheon alle 11:40 (ora coreana, +1 ora).' },
  { id: 'checkin-alloggio', at: '2027-03-02T16:00:00+09:00', durationMin: 30, phase: 'viaggio', audience: 'all', alarms: [30],
    title: 'Seul: check-in all’alloggio',
    notes: 'Dalle 16:00. Se arrivate prima, chiedi all’host il check-in anticipato o il deposito bagagli.' },
  { id: 'valorant-day', at: '2027-03-03T10:00:00+09:00', durationMin: 60, phase: 'viaggio', audience: 'all', alarms: [60],
    title: 'Seul: giornata Valorant Masters',
    notes: 'Sede e orari da confermare: apri l’app per vedere gli ultimi aggiornamenti.' },
  { id: 'whiteday', at: '2027-03-14T18:00:00+09:00', durationMin: 120, phase: 'viaggio', audience: 'all', alarms: [60],
    title: 'Seul: White Day sul fiume Han',
    notes: 'Serata al Parco Yeouido sul fiume Han.' },
  { id: 'conti-pietro', at: '2027-03-09T19:00:00+09:00', durationMin: 15, phase: 'viaggio', audience: 'all', alarms: [0],
    title: 'Seul: chiudete i conti con chi riparte domani',
    notes: 'Apri Spese → Saldi: chi riparte il 10 marzo deve saldare o farsi rimborsare prima di partire. Dopo il pagamento tocca “Salda”.' },
  { id: 'saluti', at: '2027-03-09T21:00:00+09:00', durationMin: 15, phase: 'viaggio', audience: 'leaver', alarms: [0],
    title: 'Seul: prepara la partenza di domani',
    notes: 'Valigia pronta, passaporto, carta d’imbarco. Sveglia domani alle 4:45, uscita alle 5:45-6:00.' },
  { id: 'sveglia-ritorno-1', at: '2027-03-10T04:45:00+09:00', durationMin: 15, phase: 'viaggio', audience: 'leaver', alarms: [0, 10],
    title: 'Seul: sveglia, si parte per Incheon',
    notes: 'Esci tra le 5:45 e le 6:00. Volo alle 11:10: a Incheon circa 3 ore prima.' },
  { id: 'dmz', at: '2027-03-14T20:30:00+09:00', durationMin: 15, phase: 'viaggio', audience: 'stayers', alarms: [0],
    title: 'Seul: domani tour DMZ, porta il passaporto',
    notes: 'Il passaporto è obbligatorio ai controlli. Controlla il punto e l’ora di ritrovo del tour.' },
  { id: 'ultimo-giorno', at: '2027-03-18T09:00:00+09:00', durationMin: 30, phase: 'viaggio', audience: 'stayers', alarms: [0],
    title: 'Seul: ultimo giorno pieno',
    notes: 'Valigie sotto i 23 kg, modulo d’ingresso per la Cina, prenotazione di Tiananmen, tax refund.' },
  { id: 'arrival-card', at: '2027-03-18T15:20:00+09:00', durationMin: 30, phase: 'viaggio', audience: 'stayers', alarms: [0],
    title: 'Seul: compila l’Arrival Card della Cina',
    notes: 'Da s.nia.gov.cn (sezione Arrival Card), si compila dalle 15:20 ora di Seul fino alla mattina del 19. È gratis: diffida dei siti che chiedono soldi. Salva il QR code.' },
  { id: 'tiananmen-prenota', at: '2027-03-18T16:00:00+09:00', durationMin: 30, phase: 'viaggio', audience: 'stayers', alarms: [0],
    title: 'Seul: prenota Piazza Tiananmen',
    notes: 'La prenotazione online va fatta almeno 24 ore prima e richiede il numero di passaporto. Fai screenshot di biglietto e mappe offline.' },
  { id: 'sveglia-19', at: '2027-03-19T06:30:00+09:00', durationMin: 60, phase: 'viaggio', audience: 'stayers', alarms: [0, 10],
    title: 'Seul: sveglia, ultime cose in valigia',
    notes: 'Check-out alle 7:30, AREX alle 8:30, check-in Air China alle 10:10. Decollo CA124 alle 13:10.' },
  { id: 'volo-ca124', at: '2027-03-19T13:10:00+09:00', durationMin: 120, phase: 'viaggio', audience: 'stayers', alarms: [180, 60],
    title: 'Seul: decollo CA124 per Pechino',
    notes: 'Atterraggio alle 14:20 (ora cinese). Segui “Transit 240h”, non “International Transfer”.' },
  { id: 'pechino-via', at: '2027-03-19T21:15:00+08:00', durationMin: 30, phase: 'viaggio', audience: 'stayers', alarms: [30, 0],
    title: 'Seul: TASSATIVO, parti per l’aeroporto di Pechino',
    notes: 'Il volo CA949 per Milano decolla alle 02:15 del 20 marzo. Non si negozia.' },
  { id: 'volo-ca949', at: '2027-03-20T02:15:00+08:00', durationMin: 735, phase: 'viaggio', audience: 'stayers', alarms: [120],
    title: 'Seul: decollo CA949 per Milano Malpensa',
    notes: 'Atterraggio previsto alle 06:30. Poi Malpensa Express verso le 9:00-9:30.' }
];

export function reminderApplies(r: TripReminder, travelerId: TravelerSlotId | undefined): boolean {
  if (r.audience === 'all') return true;
  const isLeaver = travelerId === LEAVER_ID;
  return r.audience === 'leaver' ? isLeaver : !isLeaver;
}

/* ---------- Formato .ics ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const toUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Righe lunghe al massimo 75 byte, con continuazione che inizia con uno spazio. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = ch;
      bytes = b;
    } else {
      cur += ch;
      bytes += b;
    }
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(reminders: TripReminder[], now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Seul 2027//Viaggio di gruppo//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Seul 2027',
    'X-WR-TIMEZONE:UTC'
  ];
  for (const r of reminders) {
    const start = new Date(r.at);
    const end = new Date(start.getTime() + r.durationMin * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@seul2027.app`,
      `DTSTAMP:${toUtc(now)}`,
      `DTSTART:${toUtc(start)}`,
      `DTEND:${toUtc(end)}`,
      `SUMMARY:${escapeText(r.title)}`,
      `DESCRIPTION:${escapeText(r.notes)}`
    );
    for (const m of r.alarms) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(r.title)}`,
        `TRIGGER:${m === 0 ? 'PT0S' : `-PT${m}M`}`,
        'END:VALARM'
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Scarica il file; su telefono che supporta la condivisione di file la apre il foglio di sistema. */
export async function saveIcsFile(ics: string, filename = 'Seul-2027-promemoria.ics'): Promise<'shared' | 'downloaded'> {
  const file = new File([ics], filename, { type: 'text/calendar' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'Promemoria Seul 2027' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
