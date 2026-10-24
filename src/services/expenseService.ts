import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore';
import { firebase } from '../firebase/client';
import type { TravelerSlotId } from '../shared/travelerProfile';
import {
  EXPENSE_CATEGORIES,
  NOTE_MAX_LENGTH,
  SLOTS,
  TITLE_MAX_LENGTH,
  isSlot,
  sharesFromInput,
  toEurCents,
  type Expense,
  type ExpenseCategory,
  type ExpenseCurrency,
  type ExpenseInput,
  type PairBalance
} from '../types/expenses';

/**
 * Spese di gruppo su Firestore: un documento per spesa in `expenses/{id}`, letto da tutti i partecipanti.
 * La cache locale di Firestore (firebase/client.ts) le rende visibili e modificabili anche senza rete:
 * le modifiche partono appena torna la connessione.
 */

const COLLECTION = 'expenses';

export function friendlyExpenseError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') {
    return 'Operazione non consentita. Se la sezione Spese è nuova, vanno pubblicate le regole aggiornate in Firebase (Firestore → Regole).';
  }
  if (code === 'unavailable') return 'Nessuna connessione: la modifica verrà salvata appena torna la rete.';
  return (err as Error)?.message || 'Errore sconosciuto.';
}

const millis = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : null;

const CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id);

function parseExpense(id: string, d: DocumentData, pending: boolean): Expense | null {
  if (!isSlot(d.paidBy) || typeof d.amountCents !== 'number' || d.amountCents <= 0) return null;
  const shares: Expense['shares'] = {};
  const repaid: Expense['repaid'] = {};
  for (const s of SLOTS) {
    const v = d.shares?.[s];
    if (typeof v === 'number' && v > 0) shares[s] = v;
    const r = d.repaid?.[s];
    if (r && typeof r === 'object') repaid[s] = { at: millis(r.at), by: String(r.by ?? '') };
  }
  const currency: ExpenseCurrency = d.currency === 'KRW' || d.currency === 'CNY' ? d.currency : 'EUR';
  return {
    id,
    title: String(d.title ?? '').slice(0, TITLE_MAX_LENGTH),
    category: (CATEGORY_IDS as string[]).includes(d.category) ? (d.category as ExpenseCategory) : 'other',
    date: typeof d.date === 'string' ? d.date : '',
    currency,
    originalAmount: typeof d.originalAmount === 'number' ? d.originalAmount : d.amountCents / 100,
    rate: typeof d.rate === 'number' && d.rate > 0 ? d.rate : 1,
    amountCents: d.amountCents,
    paidBy: d.paidBy,
    shares,
    splitMode: d.splitMode === 'exact' ? 'exact' : 'equal',
    repaid,
    note: String(d.note ?? '').slice(0, NOTE_MAX_LENGTH),
    createdBy: String(d.createdBy ?? ''),
    createdAt: millis(d.createdAt),
    updatedAt: millis(d.updatedAt),
    pending
  };
}

/** Più recenti prima (per data della spesa, poi per inserimento) */
function byNewest(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.createdAt ?? Number.MAX_SAFE_INTEGER) - (a.createdAt ?? Number.MAX_SAFE_INTEGER);
}

export interface ExpensesSnapshot {
  expenses: Expense[];
  /** I dati vengono solo dalla copia sul dispositivo (nessuna conferma dal cloud ancora) */
  fromCache: boolean;
}

export function watchExpenses(onData: (snap: ExpensesSnapshot) => void, onError: (message: string) => void): () => void {
  const { db } = firebase();
  return onSnapshot(
    collection(db, COLLECTION),
    { includeMetadataChanges: true },
    (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => {
        const e = parseExpense(d.id, d.data({ serverTimestamps: 'estimate' }), d.metadata.hasPendingWrites);
        if (e) list.push(e);
      });
      onData({ expenses: list.sort(byNewest), fromCache: snap.metadata.fromCache });
    },
    (err) => onError(friendlyExpenseError(err))
  );
}

function payload(input: ExpenseInput) {
  return {
    title: input.title.trim().slice(0, TITLE_MAX_LENGTH),
    category: input.category,
    date: input.date,
    currency: input.currency,
    originalAmount: input.originalAmount,
    rate: input.currency === 'EUR' ? 1 : input.rate,
    amountCents: toEurCents(input.originalAmount, input.currency === 'EUR' ? 1 : input.rate),
    paidBy: input.paidBy,
    shares: sharesFromInput({ ...input, rate: input.currency === 'EUR' ? 1 : input.rate }),
    splitMode: input.splitMode,
    note: input.note.trim().slice(0, NOTE_MAX_LENGTH)
  };
}

/**
 * Le scritture non si attendono fino in fondo: offline la promessa resterebbe in sospeso finché non torna la rete,
 * mentre la spesa compare subito nella lista (Firestore aggiorna la copia locale all'istante).
 * Si restituisce comunque la promessa per segnalare un eventuale rifiuto (es. regole).
 */
export function addExpense(input: ExpenseInput, uid: string): { id: string; done: Promise<void> } {
  const { db } = firebase();
  const ref = doc(collection(db, COLLECTION));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...payload(input),
    repaid: {},
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: ref.id, done: batch.commit() };
}

/**
 * Modifica completa (solo chi l'ha creata o chi ha pagato). Le quote già restituite restano tali se la persona
 * deve ancora qualcosa allo stesso pagatore; se cambia chi ha pagato, si riparte da zero.
 */
export function updateExpense(previous: Expense, input: ExpenseInput): Promise<void> {
  const { db } = firebase();
  const data = payload(input);
  // update (non set): creatore e data di creazione restano quelli salvati, al nanosecondo, come chiedono le regole
  const changes: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.paidBy !== previous.paidBy) {
    changes.repaid = {};
  } else {
    for (const s of SLOTS) {
      if (previous.repaid[s] && (s === data.paidBy || !((data.shares[s] ?? 0) > 0))) changes[`repaid.${s}`] = deleteField();
    }
  }
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, previous.id), changes);
  return batch.commit();
}

export function deleteExpense(id: string): Promise<void> {
  const { db } = firebase();
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTION, id));
  return batch.commit();
}

/** Segna (o toglie) la restituzione della quota di una persona in una spesa */
export function setRepaid(expenseId: string, slot: TravelerSlotId, repaid: boolean, uid: string): Promise<void> {
  const { db } = firebase();
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, expenseId), {
    [`repaid.${slot}`]: repaid ? { at: serverTimestamp(), by: uid } : deleteField(),
    updatedAt: serverTimestamp()
  });
  return batch.commit();
}

/** Chiude tutte le quote aperte tra due persone (in entrambe le direzioni) con un'unica scrittura */
export function settlePair(balance: PairBalance, uid: string): Promise<void> {
  const { db } = firebase();
  const batch = writeBatch(db);
  for (const d of balance.debts) {
    batch.update(doc(db, COLLECTION, d.expenseId), {
      [`repaid.${d.from}`]: { at: serverTimestamp(), by: uid },
      updatedAt: serverTimestamp()
    });
  }
  return batch.commit();
}
