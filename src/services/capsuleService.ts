import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type DocumentData, type Timestamp } from 'firebase/firestore';
import { firebase } from '../firebase/client';
import { MILESTONES, type Milestone } from '../utils/capsule';
import { TRAVELER_SLOT_IDS, type TravelerSlotId } from '../shared/travelerProfile';

/**
 * capsule/{traguardo}-{uid}: la risposta di una persona a un traguardo della capsula del tempo
 * (una foto in miniatura e/o una riga, oppure "salta"). Le regole sono in firestore.rules (sezione "Capsula del tempo").
 * Non si modifica: per cambiare risposta si cancella e si riscrive.
 */
const CAPSULE = 'capsule';

export const CAPSULE_TEXT_MAX = 280;

export interface CapsuleEntry {
  id: string;
  milestone: Milestone;
  uid: string;
  slot: TravelerSlotId;
  text: string;
  /** Miniatura JPEG come data URL, vuota se solo testo */
  thumb: string;
  skipped: boolean;
  createdAt: number | null;
}

const isMilestone = (v: unknown): v is Milestone => (MILESTONES as readonly unknown[]).includes(v);
const isSlot = (v: unknown): v is TravelerSlotId => (TRAVELER_SLOT_IDS as readonly unknown[]).includes(v);
const millis = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : typeof v === 'number' ? v : null;

function parseEntry(id: string, d: DocumentData): CapsuleEntry | null {
  if (!isMilestone(d.milestone) || typeof d.uid !== 'string' || !isSlot(d.slot)) return null;
  return {
    id,
    milestone: d.milestone,
    uid: d.uid,
    slot: d.slot,
    text: typeof d.text === 'string' ? d.text.slice(0, CAPSULE_TEXT_MAX) : '',
    thumb: typeof d.thumb === 'string' ? d.thumb : '',
    skipped: d.skipped === true,
    createdAt: millis(d.createdAt)
  };
}

export function friendlyCapsuleError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') return 'Operazione non consentita: vanno pubblicate in Firebase le regole aggiornate (sezione "Capsula del tempo").';
  if (code === 'unavailable') return 'Nessuna connessione: la risposta si salverà appena torna la rete.';
  return (err as Error)?.message || 'Errore sconosciuto.';
}

export function watchCapsule(onData: (list: CapsuleEntry[]) => void, onError: (msg: string) => void): () => void {
  const { db } = firebase();
  return onSnapshot(
    collection(db, CAPSULE),
    (snap) => onData(snap.docs.map((d) => parseEntry(d.id, d.data())).filter((x): x is CapsuleEntry => !!x)),
    (err) => onError(friendlyCapsuleError(err))
  );
}

export type CapsuleInput = { text: string; thumb?: string } | { skipped: true };

export async function saveCapsule(uid: string, slot: TravelerSlotId, milestone: Milestone, input: CapsuleInput): Promise<void> {
  const { db } = firebase();
  const base = { milestone, uid, slot, createdAt: serverTimestamp() };
  const data =
    'skipped' in input
      ? { ...base, text: '', skipped: true }
      : { ...base, text: input.text.trim().slice(0, CAPSULE_TEXT_MAX), skipped: false, ...(input.thumb ? { thumb: input.thumb } : {}) };
  await setDoc(doc(db, CAPSULE, `${milestone}-${uid}`), data);
}

export async function removeCapsule(milestone: Milestone, uid: string): Promise<void> {
  const { db } = firebase();
  await deleteDoc(doc(db, CAPSULE, `${milestone}-${uid}`));
}
