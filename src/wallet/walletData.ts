/**
 * Wallet del viaggio: tipi di voce, modelli predefiniti e piccoli controlli.
 * Nessun numero di carta di pagamento viene salvato: solo le ultime 4 cifre, per riconoscerla.
 */
import { FLIGHTS_SCHEDULE, type FlightLeg } from '../data/tripData';

export type WalletKind = 'flight' | 'pass' | 'other';

export interface WalletFileMeta {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface WalletExtra {
  label: string;
  value: string;
}

export interface WalletItem {
  id: string;
  ownerId: string;
  kind: WalletKind;
  /** Modello scelto (es. "esim", "voucher") */
  preset?: string;
  /** Tratta del programma (solo voli) */
  legId?: string;
  title: string;
  subtitle?: string;
  /** Codice di prenotazione, numero tessera, codice voucher… */
  code?: string;
  /** Testo da trasformare in codice QR da mostrare alla cassa o al varco */
  qrText?: string;
  /** Validità (AAAA-MM-GG) */
  validFrom?: string;
  validTo?: string;
  /** Indirizzo che apre l'app o il sito del servizio */
  openUrl?: string;
  extra: WalletExtra[];
  note?: string;
  pinned?: boolean;
  files: WalletFileMeta[];
  createdAt: string;
  updatedAt: string;
}

export interface KindInfo {
  label: string;
  plural: string;
  /** Classi Tailwind per lo sfondo della scheda */
  gradient: string;
  accent: string;
  hint: string;
}

export const KINDS: Record<WalletKind, KindInfo> = {
  flight: { label: 'Volo', plural: 'Voli', gradient: 'from-sky-600 via-sky-700 to-indigo-800', accent: 'text-sky-300', hint: 'Carta d’imbarco, e-ticket, codice di prenotazione' },
  pass: { label: 'Abbonamento', plural: 'Abbonamenti', gradient: 'from-amber-500 via-orange-600 to-rose-700', accent: 'text-amber-200', hint: 'eSIM, pass turistici, voucher, prenotazioni' },
  other: { label: 'Altro', plural: 'Altro', gradient: 'from-slate-600 via-slate-700 to-slate-800', accent: 'text-slate-300', hint: 'Assicurazione, documenti, numeri utili' }
};

export interface Preset {
  id: string;
  kind: WalletKind;
  title: string;
  subtitle?: string;
  openUrl?: string;
  /** Spiegazione breve mostrata nel modulo */
  tip?: string;
}

export const PRESETS: Preset[] = [
  { id: 'climate', kind: 'pass', title: 'Climate Card', subtitle: 'Abbonamento metro e bus', openUrl: 'https://www.bus.go.kr/', tip: 'Abbonamento a tempo per metro, bus e Ttareungyi nella zona di Seul.' },
  { id: 'esim', kind: 'pass', title: 'eSIM', subtitle: 'Dati per la Corea', tip: 'Incolla il codice di attivazione o carica la schermata con il codice QR.' },
  { id: 'citypass', kind: 'pass', title: 'Pass turistico', subtitle: 'Discover Seoul Pass o simili' },
  { id: 'voucher', kind: 'pass', title: 'Voucher / prenotazione', subtitle: 'Biglietto d’ingresso, tour, ristorante' },
  { id: 'hotel', kind: 'pass', title: 'Prenotazione alloggio', subtitle: 'Conferma e codice' },
  { id: 'insurance', kind: 'other', title: 'Assicurazione di viaggio', subtitle: 'Numero polizza e telefono assistenza' },
  { id: 'other', kind: 'other', title: 'Altro documento' }
];

export const presetById = (id?: string) => PRESETS.find((p) => p.id === id);

/* ---------- Voli ---------- */

const AIRPORT_OFFSET_H: Record<string, number> = { MXP: 1, PEK: 8, ICN: 9 };
const MONTHS: Record<string, number> = { gennaio: 0, febbraio: 1, marzo: 2, aprile: 3 };

export function legDepartureMs(leg: FlightLeg): number {
  const m = leg.departureDate.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  const t = leg.departureTime.match(/(\d{1,2}):(\d{2})/);
  if (!m || !t) return NaN;
  const off = AIRPORT_OFFSET_H[leg.departureAirportCode] ?? 1;
  return Date.UTC(Number(m[3]), MONTHS[m[2].toLowerCase()] ?? 2, Number(m[1]), Number(t[1]) - off, Number(t[2]));
}

export const legTitle = (leg: FlightLeg) => `${leg.departureAirportCode} → ${leg.arrivalAirportCode}`;
export const legSubtitle = (leg: FlightLeg) =>
  `${leg.flightNumber.replace(/\s*\(indicativo\)/i, '')} · ${leg.departureDate.replace(/ 2027$/, '')} ${leg.departureTime}`;

export const FLIGHT_LEGS = FLIGHTS_SCHEDULE;

/* ---------- Controlli ---------- */

/** true se il testo contiene una sequenza di 13-19 cifre che supera il controllo di Luhn (un numero di carta). */
export function looksLikeCardNumber(text: string): boolean {
  const matches = text.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return matches.some((raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  });
}

/** Giorni da oggi a una data AAAA-MM-GG (negativo se passata). */
export function daysUntil(isoDate: string, now = Date.now()): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59).getTime();
  return Math.floor((end - now) / 86_400_000);
}

export function validityLabel(item: WalletItem, now = Date.now()): { text: string; tone: 'ok' | 'soon' | 'expired' } | null {
  if (!item.validTo) return null;
  const left = daysUntil(item.validTo, now);
  if (left < 0) return { text: 'Scaduto', tone: 'expired' };
  if (left === 0) return { text: 'Scade oggi', tone: 'soon' };
  if (left <= 3) return { text: `Scade tra ${left} g`, tone: 'soon' };
  const [y, m, d] = item.validTo.split('-');
  return { text: `Valido fino al ${d}/${m}/${y.slice(2)}`, tone: 'ok' };
}

/** Il campo più utile da mostrare sulla scheda. */
export function cardHeadline(item: WalletItem): string {
  if (item.code) return item.code;
  return '';
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
