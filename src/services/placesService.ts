import { collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type DocumentData, type Timestamp } from 'firebase/firestore';
import { firebase } from '../firebase/client';
import { TRAVELER_SLOT_IDS, type TravelerSlotId } from '../shared/travelerProfile';
import { PLACE_CATEGORIES, PLACE_PRIORITIES, type PlaceInput, type PlaceVote, type SharedPlace } from '../shared/places';

/**
 * places/{id}: luoghi scoperti durante il viaggio, visibili a tutto il gruppo.
 * Le regole sono in firestore.rules (sezione "Luoghi condivisi").
 */
const PLACES = 'places';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const millis = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : typeof v === 'number' ? v : null;
const isSlot = (v: unknown): v is TravelerSlotId => (TRAVELER_SLOT_IDS as readonly unknown[]).includes(v);

function parsePlace(id: string, d: DocumentData): SharedPlace | null {
  if (!num(d.lat) || !num(d.lng) || typeof d.name !== 'string' || !isSlot(d.addedBySlot)) return null;
  const votes: SharedPlace['votes'] = {};
  for (const s of TRAVELER_SLOT_IDS) {
    const v = d.votes?.[s];
    if (v === 'up' || v === 'down') votes[s] = v;
  }
  return {
    id,
    name: d.name.slice(0, 80),
    category: PLACE_CATEGORIES.some((c) => c.id === d.category) ? d.category : 'other',
    priority: PLACE_PRIORITIES.some((p) => p.id === d.priority) ? d.priority : 'nice',
    lat: d.lat,
    lng: d.lng,
    link: typeof d.link === 'string' ? d.link.slice(0, 500) : '',
    note: typeof d.note === 'string' ? d.note.slice(0, 300) : '',
    addedBy: String(d.addedBy ?? ''),
    addedBySlot: d.addedBySlot,
    createdAt: millis(d.createdAt),
    votes,
    visited: d.visited === true
  };
}

export function friendlyPlacesError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') return 'Operazione non consentita: vanno pubblicate in Firebase le regole aggiornate (sezione "Luoghi condivisi").';
  if (code === 'unavailable') return 'Nessuna connessione: il luogo si salverà appena torna la rete.';
  return (err as Error)?.message || 'Errore sconosciuto.';
}

export function watchPlaces(onData: (list: SharedPlace[]) => void, onError: (msg: string) => void): () => void {
  const { db } = firebase();
  return onSnapshot(
    collection(db, PLACES),
    (snap) => onData(snap.docs.map((d) => parsePlace(d.id, d.data())).filter((x): x is SharedPlace => !!x)),
    (err) => onError(friendlyPlacesError(err))
  );
}

const clean = (i: PlaceInput) => ({
  name: i.name.trim().slice(0, 80),
  category: i.category,
  priority: i.priority,
  lat: i.lat,
  lng: i.lng,
  link: i.link.trim().slice(0, 500),
  note: i.note.trim().slice(0, 300)
});

export async function addPlace(uid: string, slot: TravelerSlotId, input: PlaceInput): Promise<void> {
  const { db } = firebase();
  await setDoc(doc(collection(db, PLACES)), {
    ...clean(input),
    addedBy: uid,
    addedBySlot: slot,
    createdAt: serverTimestamp(),
    votes: {},
    visited: false
  });
}

export async function editPlace(id: string, input: PlaceInput): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, PLACES, id), clean(input));
}

export async function votePlace(id: string, slot: TravelerSlotId, vote: PlaceVote | null): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, PLACES, id), { [`votes.${slot}`]: vote === null ? deleteField() : vote });
}

export async function setVisited(id: string, visited: boolean): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, PLACES, id), { visited });
}

export async function deletePlace(id: string): Promise<void> {
  const { db } = firebase();
  await deleteDoc(doc(db, PLACES, id));
}
