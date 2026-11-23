import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch, type DocumentData, type Timestamp } from 'firebase/firestore';
import { firebase } from '../firebase/client';
import { MILESTONES, type Milestone } from '../utils/capsule';
import { TRAVELER_SLOT_IDS, type TravelerSlotId } from '../shared/travelerProfile';

/**
 * capsule/{traguardo}-{uid}: la risposta di una persona a un traguardo della capsula del tempo
 * (una foto in miniatura e/o una riga, oppure "salta"). Le regole sono in firestore.rules (sezione "Capsula del tempo").
 * Non si modifica: per cambiare risposta si cancella e si riscrive.
 */
const CAPSULE = 'capsule';
const COMMENTS = 'capsuleComments';
/** capsuleImages/{stesso id}: la foto a qualità piena. Si legge solo quando serve (nel feed la miniatura, poi questa). */
const IMAGES = 'capsuleImages';

export const CAPSULE_TEXT_MAX = 280;
export const CAPSULE_COMMENT_MAX = 400;

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

export interface CapsuleComment {
  id: string;
  capsuleId: string;
  authorId: string;
  text: string;
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

export function watchCapsuleComments(onData: (list: CapsuleComment[]) => void, onError: (msg: string) => void): () => void {
  const { db } = firebase();
  return onSnapshot(
    query(collection(db, COMMENTS), orderBy('createdAt', 'desc'), limit(500)),
    (snap) =>
      onData(
        snap.docs.flatMap((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          if (typeof data.capsuleId !== 'string' || typeof data.authorId !== 'string' || typeof data.text !== 'string') return [];
          return [{
            id: d.id,
            capsuleId: data.capsuleId,
            authorId: data.authorId,
            text: data.text.slice(0, CAPSULE_COMMENT_MAX),
            createdAt: millis(data.createdAt)
          }];
        }).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      ),
    (err) => onError(friendlyCapsuleError(err))
  );
}

export async function addCapsuleComment(capsuleId: string, authorId: string, text: string): Promise<void> {
  const clean = text.trim().slice(0, CAPSULE_COMMENT_MAX);
  if (!clean) throw new Error('Scrivi un commento prima di inviarlo.');
  const { db } = firebase();
  await setDoc(doc(collection(db, COMMENTS)), {
    capsuleId,
    authorId,
    text: clean,
    createdAt: serverTimestamp()
  });
}

export async function removeCapsuleComment(commentId: string): Promise<void> {
  await deleteDoc(doc(firebase().db, COMMENTS, commentId));
}

export type CapsuleInput = { text: string; thumb?: string; full?: string } | { skipped: true };

export async function saveCapsule(uid: string, slot: TravelerSlotId, milestone: Milestone, input: CapsuleInput): Promise<void> {
  const { db } = firebase();
  const base = { milestone, uid, slot, createdAt: serverTimestamp() };
  const data =
    'skipped' in input
      ? { ...base, text: '', skipped: true }
      : { ...base, text: input.text.trim().slice(0, CAPSULE_TEXT_MAX), skipped: false, ...(input.thumb ? { thumb: input.thumb } : {}) };
  const id = `${milestone}-${uid}`;
  // Miniatura e foto piena si scrivono insieme: o ci sono tutte e due o nessuna
  if (!('skipped' in input) && input.full) {
    const batch = writeBatch(db);
    batch.set(doc(db, CAPSULE, id), data);
    batch.set(doc(db, IMAGES, id), { uid, data: input.full });
    await batch.commit();
    return;
  }
  await setDoc(doc(db, CAPSULE, id), data);
}

const fullCache = new Map<string, Promise<string>>();

/** La foto a qualità piena di una risposta, o stringa vuota se non c'è (risposte salvate prima, solo miniatura) */
export function loadCapsuleImage(id: string): Promise<string> {
  let hit = fullCache.get(id);
  if (!hit) {
    // Dentro la promessa: se Firebase non è pronto l'errore resta una foto non caricata, non una schermata rotta
    hit = Promise.resolve().then(() => getDoc(doc(firebase().db, IMAGES, id))).then((snap) => (snap.exists() && typeof snap.get('data') === 'string' ? (snap.get('data') as string) : ''));
    hit.catch(() => fullCache.delete(id));
    fullCache.set(id, hit);
  }
  return hit;
}

export async function removeCapsule(milestone: Milestone, uid: string): Promise<void> {
  const { db } = firebase();
  const id = `${milestone}-${uid}`;
  // I commenti appartengono alla risposta: eliminarli prima evita che ricompaiano se la persona ripubblica nello stesso traguardo.
  const commentSnap = await getDocs(query(collection(db, COMMENTS), where('capsuleId', '==', id)));
  for (let offset = 0; offset < commentSnap.docs.length; offset += 450) {
    const batch = writeBatch(db);
    for (const comment of commentSnap.docs.slice(offset, offset + 450)) batch.delete(comment.ref);
    await batch.commit();
  }
  const imageRef = doc(db, IMAGES, id);
  const imageSnap = await getDoc(imageRef);
  const batch = writeBatch(db);
  batch.delete(doc(db, CAPSULE, id));
  if (imageSnap.exists()) batch.delete(imageRef);
  await batch.commit();
  fullCache.delete(id);
}
