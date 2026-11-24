import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { TravelerSlotId } from '../shared/travelerProfile';

export type StopStatus = 'done' | 'skipped' | 'moved';

export interface AddedDayStop {
  id: string;
  placeId?: string;
  name: string;
  time: string;
  note: string;
  lat?: number;
  lng?: number;
  addedBySlot: TravelerSlotId;
}

export interface DayLiveDoc {
  dayId: number;
  /** Stato delle tappe: chiave "s_0", "s_1"... per schedule oppure "a_<id>" per tappe aggiunte */
  stopStates: Record<string, StopStatus>;
  /** Nota condivisa sul giorno (es. "spostato per pioggia", "prenotato alle 20:30") */
  note: string;
  noteBySlot?: TravelerSlotId;
  /** Luoghi promossi da PlacesView o tappe aggiunte al volo */
  addedStops: AddedDayStop[];
  updatedAt: number;
}

const STORAGE_KEY = 'seul2027:itineraryLive:v1';

type LiveMap = Record<number, DayLiveDoc>;

function readLocal(): LiveMap {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as LiveMap) : {};
  } catch {
    return {};
  }
}

function writeLocal(map: LiveMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* spazio esaurito */
  }
}

let state: LiveMap = readLocal();
let syncMode: 'cloud' | 'local' = 'local';
const listeners = new Set<() => void>();
let started = false;

function emit() {
  writeLocal(state);
  listeners.forEach((fn) => fn());
}

function ensureStarted() {
  if (started) return;
  started = true;
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    onSnapshot(
      collection(db, 'itineraryLive'),
      (snap) => {
        const next: LiveMap = { ...readLocal() };
        snap.docs.forEach((d) => {
          const data = d.data() as Partial<DayLiveDoc>;
          const dayId = typeof data.dayId === 'number' ? data.dayId : Number(d.id);
          if (!Number.isInteger(dayId) || dayId < 0 || dayId > 30) return;
          const localDoc = next[dayId];
          const remoteUpdated = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
          if (!localDoc || remoteUpdated >= (localDoc.updatedAt ?? 0)) {
            next[dayId] = {
              dayId,
              stopStates: data.stopStates && typeof data.stopStates === 'object' ? data.stopStates : {},
              note: typeof data.note === 'string' ? data.note : '',
              ...(data.noteBySlot ? { noteBySlot: data.noteBySlot } : {}),
              addedStops: Array.isArray(data.addedStops) ? data.addedStops : [],
              updatedAt: remoteUpdated
            };
          }
        });
        state = next;
        syncMode = 'cloud';
        emit();
      },
      () => {
        syncMode = 'local';
      }
    );
  } catch {
    syncMode = 'local';
  }
}

function emptyDay(dayId: number): DayLiveDoc {
  return { dayId, stopStates: {}, note: '', addedStops: [], updatedAt: 0 };
}

function sanitizeDayDoc(docData: DayLiveDoc): DayLiveDoc {
  const cleanStops = docData.addedStops.slice(0, 20).map((s) => ({
    id: s.id.slice(0, 60),
    ...(s.placeId ? { placeId: s.placeId.slice(0, 60) } : {}),
    name: s.name.trim().slice(0, 80),
    time: s.time.trim().slice(0, 30),
    note: s.note.trim().slice(0, 200),
    ...(typeof s.lat === 'number' && Number.isFinite(s.lat) ? { lat: s.lat } : {}),
    ...(typeof s.lng === 'number' && Number.isFinite(s.lng) ? { lng: s.lng } : {}),
    addedBySlot: s.addedBySlot
  }));
  const cleanStates: Record<string, StopStatus> = {};
  for (const [k, v] of Object.entries(docData.stopStates)) {
    if ((v === 'done' || v === 'skipped' || v === 'moved') && k.length <= 64) {
      cleanStates[k] = v;
    }
  }
  const out: DayLiveDoc = {
    dayId: docData.dayId,
    stopStates: cleanStates,
    note: docData.note.trim().slice(0, 300),
    ...(docData.noteBySlot ? { noteBySlot: docData.noteBySlot } : {}),
    addedStops: cleanStops,
    updatedAt: docData.updatedAt
  };
  return JSON.parse(JSON.stringify(out)) as DayLiveDoc;
}

async function persistDay(dayDoc: DayLiveDoc): Promise<void> {
  const clean = sanitizeDayDoc({ ...dayDoc, updatedAt: Date.now() });
  state = { ...state, [clean.dayId]: clean };
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await setDoc(doc(db, 'itineraryLive', String(clean.dayId)), clean);
    syncMode = 'cloud';
  } catch {
    syncMode = 'local';
  }
}

export async function cycleStopStatus(dayId: number, stopKey: string): Promise<void> {
  const cur = state[dayId] ?? emptyDay(dayId);
  const prev = cur.stopStates[stopKey];
  const order: Array<StopStatus | undefined> = [undefined, 'done', 'skipped', 'moved'];
  const next = order[(order.indexOf(prev) + 1) % order.length];
  const nextStates = { ...cur.stopStates };
  if (next) nextStates[stopKey] = next;
  else delete nextStates[stopKey];
  await persistDay({ ...cur, stopStates: nextStates });
}

export async function setStopStatus(dayId: number, stopKey: string, status: StopStatus | null): Promise<void> {
  const cur = state[dayId] ?? emptyDay(dayId);
  const nextStates = { ...cur.stopStates };
  if (status) nextStates[stopKey] = status;
  else delete nextStates[stopKey];
  await persistDay({ ...cur, stopStates: nextStates });
}

export async function saveDayNote(dayId: number, note: string, slot: TravelerSlotId): Promise<void> {
  const cur = state[dayId] ?? emptyDay(dayId);
  await persistDay({
    ...cur,
    note: note.trim().slice(0, 300),
    noteBySlot: note.trim() ? slot : undefined
  });
}

export async function addStopToDay(
  dayId: number,
  stop: Omit<AddedDayStop, 'id'>
): Promise<void> {
  const cur = state[dayId] ?? emptyDay(dayId);
  // Se proviene da un placeId già presente in quel giorno, aggiorna orario/nota invece di duplicare
  const existingIdx = stop.placeId ? cur.addedStops.findIndex((s) => s.placeId === stop.placeId) : -1;
  const entry: AddedDayStop = {
    ...stop,
    id: existingIdx >= 0 ? cur.addedStops[existingIdx].id : `add_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  };
  const nextAdded =
    existingIdx >= 0
      ? cur.addedStops.map((s, i) => (i === existingIdx ? entry : s))
      : [...cur.addedStops, entry];
  await persistDay({ ...cur, addedStops: nextAdded });
}

export async function removeAddedStop(dayId: number, stopId: string): Promise<void> {
  const cur = state[dayId] ?? emptyDay(dayId);
  const nextStates = { ...cur.stopStates };
  delete nextStates[`a_${stopId}`];
  await persistDay({
    ...cur,
    stopStates: nextStates,
    addedStops: cur.addedStops.filter((s) => s.id !== stopId)
  });
}

export function useItineraryLive(): { byDay: LiveMap; syncMode: 'cloud' | 'local'; daysForPlace: (placeId: string) => number[] } {
  ensureStarted();
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const daysForPlace = (placeId: string): number[] =>
    Object.values(state)
      .filter((d) => d.addedStops.some((s) => s.placeId === placeId))
      .map((d) => d.dayId)
      .sort((a, b) => a - b);

  return { byDay: state, syncMode, daysForPlace };
}
