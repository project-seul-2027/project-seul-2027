import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore';
import { firebase } from '../firebase/client';
import { TRAVELER_SLOT_IDS, type TravelerSlotId } from '../shared/travelerProfile';
import type { LiveDoc, LiveStatus, Meetup, MeetupAnswer, MeetupInput, SharedPosition } from '../shared/groupLive';

/**
 * Gruppo in tempo reale su Firestore:
 * - live/{uid}: stato ("a casa") e posizione condivisa a tempo, scritti solo dal titolare;
 * - meetups/{id}: punti di ritrovo, ognuno risponde solo per sé.
 * Le regole sono in firestore.rules (sezione "Gruppo in tempo reale").
 */

const LIVE = 'live';
const MEETUPS = 'meetups';

const millis = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : typeof v === 'number' ? v : null;

const isSlot = (v: unknown): v is TravelerSlotId => (TRAVELER_SLOT_IDS as readonly unknown[]).includes(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseShare(s: unknown): SharedPosition | null {
  const o = s as Record<string, unknown> | null;
  if (!o || !num(o.lat) || !num(o.lng) || !num(o.at) || !num(o.until)) return null;
  return { lat: o.lat, lng: o.lng, acc: num(o.acc) ? o.acc : 0, at: o.at, until: o.until };
}

function parseLive(id: string, d: DocumentData): LiveDoc | null {
  if (!isSlot(d.slot)) return null;
  return {
    uid: id,
    slot: d.slot,
    status: d.status === 'home' || d.status === 'out' ? d.status : null,
    statusAt: num(d.statusAt) ? d.statusAt : null,
    place: typeof d.place === 'string' ? d.place.slice(0, 80) : '',
    share: parseShare(d.share),
    lost: num(d.lost) ? d.lost : null,
    updatedAt: millis(d.updatedAt)
  };
}

function parseMeetup(id: string, d: DocumentData): Meetup | null {
  if (!num(d.lat) || !num(d.lng) || !num(d.at) || typeof d.label !== 'string') return null;
  const answers: Meetup['answers'] = {};
  for (const s of TRAVELER_SLOT_IDS) {
    const a = d.answers?.[s];
    if (a === 'ok' || a === 'late' || a === 'no') answers[s] = a;
  }
  return {
    id,
    label: d.label.slice(0, 80),
    placeId: typeof d.placeId === 'string' ? d.placeId : null,
    lat: d.lat,
    lng: d.lng,
    at: d.at,
    note: typeof d.note === 'string' ? d.note.slice(0, 200) : '',
    createdBy: String(d.createdBy ?? ''),
    createdAt: millis(d.createdAt),
    answers,
    fixed: d.fixed === true
  };
}

export function friendlyGroupError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') {
    return 'Operazione non consentita: vanno pubblicate in Firebase le regole aggiornate (sezione "Gruppo in tempo reale").';
  }
  if (code === 'unavailable') return 'Nessuna connessione: riprovo appena torna la rete.';
  return (err as Error)?.message || 'Errore sconosciuto.';
}

export function watchLive(onData: (docs: LiveDoc[]) => void, onError: (msg: string) => void): () => void {
  const { db } = firebase();
  return onSnapshot(
    collection(db, LIVE),
    (snap) => onData(snap.docs.map((d) => parseLive(d.id, d.data())).filter((x): x is LiveDoc => !!x)),
    (err) => onError(friendlyGroupError(err))
  );
}

export function watchMeetups(onData: (list: Meetup[]) => void, onError: (msg: string) => void): () => void {
  const { db } = firebase();
  return onSnapshot(
    collection(db, MEETUPS),
    (snap) => onData(snap.docs.map((d) => parseMeetup(d.id, d.data())).filter((x): x is Meetup => !!x)),
    (err) => onError(friendlyGroupError(err))
  );
}

export interface MyLiveState {
  status: LiveStatus | null;
  statusAt: number | null;
  place: string;
  share: SharedPosition | null;
  lost: number | null;
}

/** Scrive tutto il proprio documento (le regole accettano solo questi campi) */
export async function writeMyLive(uid: string, slot: TravelerSlotId, state: MyLiveState): Promise<void> {
  const { db } = firebase();
  await setDoc(doc(db, LIVE, uid), {
    uid,
    slot,
    status: state.status,
    statusAt: state.statusAt,
    place: state.place.slice(0, 80),
    share: state.share
      ? {
          // circa 10 metri: basta per trovarsi, non serve di più
          lat: Math.round(state.share.lat * 10_000) / 10_000,
          lng: Math.round(state.share.lng * 10_000) / 10_000,
          acc: Math.round(state.share.acc),
          at: state.share.at,
          until: state.share.until
        }
      : null,
    lost: state.lost,
    updatedAt: serverTimestamp()
  });
}

export async function createMeetup(uid: string, mySlot: TravelerSlotId, input: MeetupInput): Promise<void> {
  const { db } = firebase();
  const ref = doc(collection(db, MEETUPS));
  await setDoc(ref, {
    label: input.label.trim().slice(0, 80),
    placeId: input.placeId,
    lat: input.lat,
    lng: input.lng,
    at: input.at,
    note: input.note.trim().slice(0, 200),
    createdBy: uid,
    createdAt: serverTimestamp(),
    answers: { [mySlot]: 'ok' },
    fixed: input.fixed === true
  });
}

export async function answerMeetup(id: string, slot: TravelerSlotId, answer: MeetupAnswer): Promise<void> {
  const { db } = firebase();
  await updateDoc(doc(db, MEETUPS, id), { [`answers.${slot}`]: answer });
}

export async function deleteMeetup(id: string): Promise<void> {
  const { db } = firebase();
  await deleteDoc(doc(db, MEETUPS, id));
}
