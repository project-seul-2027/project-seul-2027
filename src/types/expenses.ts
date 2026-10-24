import { TRAVELER_SLOT_IDS, type TravelerSlotId } from '../shared/travelerProfile';

/**
 * Spese di gruppo: chi ha pagato, come si divide, chi ha già restituito la propria quota.
 *
 * Tutti gli importi di calcolo sono in centesimi di euro (interi), così non ci sono errori di arrotondamento.
 * Le persone sono i 4 posti del gruppo (t1…t4): esistono anche per chi non si è ancora registrato.
 */

export type ExpenseCurrency = 'EUR' | 'KRW' | 'CNY';
export type ExpenseCategory = 'food' | 'transport' | 'lodging' | 'activity' | 'shopping' | 'other';
export type SplitMode = 'equal' | 'exact';

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; emoji: string }[] = [
  { id: 'food', label: 'Cibo', emoji: '🍜' },
  { id: 'transport', label: 'Trasporti', emoji: '🚇' },
  { id: 'lodging', label: 'Alloggio', emoji: '🏨' },
  { id: 'activity', label: 'Attività', emoji: '🎟️' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'other', label: 'Altro', emoji: '📦' }
];

export const CURRENCY_SYMBOL: Record<ExpenseCurrency, string> = { EUR: '€', KRW: '₩', CNY: '¥' };
/** Cifre decimali usate per ogni valuta (il won non ha centesimi) */
export const CURRENCY_DECIMALS: Record<ExpenseCurrency, number> = { EUR: 2, KRW: 0, CNY: 2 };

export const TITLE_MAX_LENGTH = 80;
export const NOTE_MAX_LENGTH = 300;
/** 100.000 € in centesimi: limite di sicurezza (anche nelle regole Firestore) */
export const MAX_AMOUNT_CENTS = 10_000_000;

export interface RepaidMark {
  /** Millisecondi; null finché il server non ha confermato l'orario */
  at: number | null;
  /** uid di chi l'ha segnata */
  by: string;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  /** AAAA-MM-GG */
  date: string;
  currency: ExpenseCurrency;
  /** Importo nella valuta originale (es. 35000 per 35.000 ₩) */
  originalAmount: number;
  /** Unità di valuta per 1 € al momento della spesa (1 per l'euro) */
  rate: number;
  amountCents: number;
  paidBy: TravelerSlotId;
  /** Quota di ciascuno in centesimi di euro (somma = amountCents). Comprende anche la quota di chi ha pagato */
  shares: Partial<Record<TravelerSlotId, number>>;
  splitMode: SplitMode;
  /** Quote già restituite a chi ha pagato */
  repaid: Partial<Record<TravelerSlotId, RepaidMark>>;
  note: string;
  createdBy: string;
  createdAt: number | null;
  updatedAt: number | null;
  /** Modifica fatta su questo dispositivo e non ancora salvata nel cloud */
  pending: boolean;
}

/** Dati che l'utente compila nel modulo */
export interface ExpenseInput {
  title: string;
  category: ExpenseCategory;
  date: string;
  currency: ExpenseCurrency;
  originalAmount: number;
  rate: number;
  paidBy: TravelerSlotId;
  splitMode: SplitMode;
  /** Modalità "uguale": chi partecipa */
  participants: TravelerSlotId[];
  /** Modalità "esatto": importo di ciascuno nella valuta della spesa */
  exactAmounts: Partial<Record<TravelerSlotId, number>>;
  note: string;
}

export const SLOTS: readonly TravelerSlotId[] = TRAVELER_SLOT_IDS;

export function isSlot(v: unknown): v is TravelerSlotId {
  return typeof v === 'string' && (SLOTS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Importi
// ---------------------------------------------------------------------------

/** Converte un importo nella valuta originale in centesimi di euro */
export function toEurCents(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((amount / rate) * 100);
}

/** Divide in parti uguali; i centesimi che avanzano vanno ai primi (in ordine di posto), così la somma torna sempre */
export function splitEqually(totalCents: number, people: TravelerSlotId[]): Partial<Record<TravelerSlotId, number>> {
  const ordered = SLOTS.filter((s) => people.includes(s));
  const out: Partial<Record<TravelerSlotId, number>> = {};
  if (ordered.length === 0 || totalCents <= 0) return out;
  const base = Math.floor(totalCents / ordered.length);
  let rest = totalCents - base * ordered.length;
  for (const s of ordered) {
    out[s] = base + (rest > 0 ? 1 : 0);
    if (rest > 0) rest -= 1;
  }
  return out;
}

/**
 * Importi esatti (nella valuta della spesa) → centesimi di euro con somma uguale al totale:
 * la differenza dovuta all'arrotondamento va alla quota più grande.
 */
export function splitExact(
  totalCents: number,
  amounts: Partial<Record<TravelerSlotId, number>>,
  rate: number
): Partial<Record<TravelerSlotId, number>> {
  const out: Partial<Record<TravelerSlotId, number>> = {};
  let sum = 0;
  let biggest: TravelerSlotId | null = null;
  for (const s of SLOTS) {
    const v = amounts[s];
    if (!v || v <= 0) continue;
    const c = toEurCents(v, rate);
    if (c <= 0) continue;
    out[s] = c;
    sum += c;
    if (!biggest || c > (out[biggest] ?? 0)) biggest = s;
  }
  if (biggest && sum !== totalCents) out[biggest] = (out[biggest] ?? 0) + (totalCents - sum);
  return out;
}

/** Errore da mostrare nel modulo, oppure null se i dati sono validi */
export function validateInput(input: ExpenseInput): string | null {
  const title = input.title.trim();
  if (!title) return 'Scrivi una descrizione (es. "Cena BBQ a Hongdae").';
  if (title.length > TITLE_MAX_LENGTH) return `La descrizione può avere al massimo ${TITLE_MAX_LENGTH} caratteri.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Scegli la data della spesa.';
  if (!(input.originalAmount > 0)) return "Inserisci l'importo.";
  if (!(input.rate > 0)) return 'Il cambio non è valido.';
  const total = toEurCents(input.originalAmount, input.rate);
  if (total <= 0) return "L'importo è troppo piccolo.";
  if (total > MAX_AMOUNT_CENTS) return "L'importo è troppo grande.";
  if (!isSlot(input.paidBy)) return 'Scegli chi ha pagato.';
  if (input.note.length > NOTE_MAX_LENGTH) return `La nota può avere al massimo ${NOTE_MAX_LENGTH} caratteri.`;
  if (input.splitMode === 'equal') {
    if (input.participants.length === 0) return 'Scegli almeno una persona tra cui dividere.';
  } else {
    const dec = CURRENCY_DECIMALS[input.currency];
    const factor = 10 ** dec;
    const sum = SLOTS.reduce((acc, s) => acc + Math.round((input.exactAmounts[s] ?? 0) * factor), 0);
    const target = Math.round(input.originalAmount * factor);
    if (sum === 0) return 'Inserisci la quota di almeno una persona.';
    if (sum !== target) {
      const diff = (target - sum) / factor;
      return diff > 0
        ? `Mancano ${formatOriginal(diff, input.currency)} da assegnare.`
        : `Le quote superano il totale di ${formatOriginal(-diff, input.currency)}.`;
    }
  }
  return null;
}

/** Quote in centesimi di euro dal modulo */
export function sharesFromInput(input: ExpenseInput): Partial<Record<TravelerSlotId, number>> {
  const total = toEurCents(input.originalAmount, input.rate);
  return input.splitMode === 'equal'
    ? splitEqually(total, input.participants)
    : splitExact(total, input.exactAmounts, input.rate);
}

// ---------------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------------

const eurFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

export function formatEur(cents: number): string {
  return eurFmt.format(cents / 100);
}

export function formatOriginal(amount: number, currency: ExpenseCurrency): string {
  const dec = CURRENCY_DECIMALS[currency];
  const n = new Intl.NumberFormat('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(amount);
  return currency === 'EUR' ? `${n} €` : `${CURRENCY_SYMBOL[currency]}${n}`;
}

export function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Saldi
// ---------------------------------------------------------------------------

/** Una quota da restituire: chi la deve, a chi, quanto, se è già stata restituita */
export interface Debt {
  expenseId: string;
  from: TravelerSlotId;
  to: TravelerSlotId;
  cents: number;
  repaid: boolean;
}

export function debtsOf(expense: Expense): Debt[] {
  const out: Debt[] = [];
  for (const s of SLOTS) {
    const cents = expense.shares[s] ?? 0;
    if (s === expense.paidBy || cents <= 0) continue;
    out.push({ expenseId: expense.id, from: s, to: expense.paidBy, cents, repaid: !!expense.repaid[s] });
  }
  return out;
}

export interface PersonSummary {
  slot: TravelerSlotId;
  /** Quanto ha pagato di tasca propria (per tutti) */
  paid: number;
  /** Quanto ha consumato (somma delle sue quote) */
  share: number;
  /** Quote che deve ancora restituire */
  owes: number;
  /** Quote che ha già restituito */
  repaidOut: number;
  /** Quote che gli altri gli devono ancora */
  toReceive: number;
  /** Quote che gli altri gli hanno già restituito */
  received: number;
  /** Saldo aperto: positivo = deve ricevere, negativo = deve dare */
  net: number;
}

export function summarize(expenses: Expense[]): Record<TravelerSlotId, PersonSummary> {
  const out = Object.fromEntries(
    SLOTS.map((s) => [s, { slot: s, paid: 0, share: 0, owes: 0, repaidOut: 0, toReceive: 0, received: 0, net: 0 }])
  ) as Record<TravelerSlotId, PersonSummary>;
  for (const e of expenses) {
    out[e.paidBy].paid += e.amountCents;
    for (const s of SLOTS) out[s].share += e.shares[s] ?? 0;
    for (const d of debtsOf(e)) {
      if (d.repaid) {
        out[d.from].repaidOut += d.cents;
        out[d.to].received += d.cents;
      } else {
        out[d.from].owes += d.cents;
        out[d.to].toReceive += d.cents;
      }
    }
  }
  for (const s of SLOTS) out[s].net = out[s].toReceive - out[s].owes;
  return out;
}

/** Debito netto aperto tra due persone: chi deve dare a chi, e con quali spese */
export interface PairBalance {
  from: TravelerSlotId;
  to: TravelerSlotId;
  /** Importo netto da dare (> 0) */
  cents: number;
  /** Quote aperte di "from" verso "to" e di "to" verso "from" (si chiudono tutte saldando) */
  debts: Debt[];
}

/**
 * Saldi per coppia, al netto: se A deve 30 € a B e B deve 10 € ad A, A dà 20 € a B.
 * Si tiene per coppia (e non con il minimo numero di passaggi tra tutti) perché saldare deve poter chiudere
 * le quote delle singole spese tra le due persone, così lo storico resta chiaro.
 */
export function pairBalances(expenses: Expense[]): PairBalance[] {
  const out: PairBalance[] = [];
  const open = expenses.flatMap(debtsOf).filter((d) => !d.repaid);
  for (let i = 0; i < SLOTS.length; i++) {
    for (let j = i + 1; j < SLOTS.length; j++) {
      const a = SLOTS[i];
      const b = SLOTS[j];
      const debts = open.filter((d) => (d.from === a && d.to === b) || (d.from === b && d.to === a));
      if (debts.length === 0) continue;
      const aToB = debts.filter((d) => d.from === a).reduce((acc, d) => acc + d.cents, 0);
      const bToA = debts.filter((d) => d.from === b).reduce((acc, d) => acc + d.cents, 0);
      const diff = aToB - bToA;
      // anche a saldo zero le quote incrociate restano aperte: si mostrano per poterle chiudere
      out.push(diff >= 0 ? { from: a, to: b, cents: diff, debts } : { from: b, to: a, cents: -diff, debts });
    }
  }
  return out.sort((x, y) => y.cents - x.cents);
}

/** Stato della persona in una spesa, per le etichette della lista */
export type MyExpenseStatus =
  | { kind: 'owe'; cents: number }
  | { kind: 'repaid'; cents: number }
  | { kind: 'lent'; cents: number; open: number }
  | { kind: 'paidOwn' }
  | { kind: 'none' };

export function myStatus(e: Expense, me: TravelerSlotId | null): MyExpenseStatus {
  if (!me) return { kind: 'none' };
  if (e.paidBy === me) {
    const debts = debtsOf(e);
    if (debts.length === 0) return { kind: 'paidOwn' };
    const lent = debts.reduce((acc, d) => acc + d.cents, 0);
    const open = debts.filter((d) => !d.repaid).reduce((acc, d) => acc + d.cents, 0);
    return { kind: 'lent', cents: lent, open };
  }
  const share = e.shares[me] ?? 0;
  if (share <= 0) return { kind: 'none' };
  return e.repaid[me] ? { kind: 'repaid', cents: share } : { kind: 'owe', cents: share };
}

/** Chi può modificare o eliminare la spesa (stessa regola di firestore.rules) */
export function canEdit(e: Expense, uid: string, me: TravelerSlotId | null): boolean {
  return e.createdBy === uid || (!!me && e.paidBy === me);
}

/** Chi può segnare restituita la quota di "slot": chi la deve o chi l'ha anticipata */
export function canMarkRepaid(e: Expense, slot: TravelerSlotId, me: TravelerSlotId | null): boolean {
  return !!me && (me === slot || me === e.paidBy);
}
