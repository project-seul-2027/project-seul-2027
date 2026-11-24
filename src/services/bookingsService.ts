import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { TravelerSlotId } from '../shared/travelerProfile';

export type BookingStatus = 'todo' | 'booked';

export interface TripBooking {
  id: string;
  title: string;
  /** Data di apertura vendite o scadenza prenotazione (YYYY-MM-DD) */
  dueDate: string;
  /** Giorno dell'itinerario collegato (0..19), se applicabile */
  tripDayId: number | null;
  /** Chi dei 4 se ne occupa */
  assigneeSlot: TravelerSlotId | null;
  status: BookingStatus;
  /** Codice prenotazione / nota rapida */
  reference: string;
  /** Link diretto per prenotare o verificare */
  url: string;
  createdBy: string;
  updatedAt: number;
}

const STORAGE_KEY = 'seul2027:bookings:v1';
const SEEDED_KEY = 'seul2027:bookings:seeded:v1';

/** Prenotazioni chiave reali del viaggio Seul + Pechino 2027 */
export const DEFAULT_BOOKINGS: Omit<TripBooking, 'createdBy' | 'updatedAt'>[] = [
  {
    id: 'bk_valorant',
    title: 'Biglietti finale Valorant Masters Seoul',
    dueDate: '2027-02-20',
    tripDayId: 6,
    assigneeSlot: null,
    status: 'todo',
    reference: 'Controllare annuncio Riot Games per arena e apertura vendite',
    url: ''
  },
  {
    id: 'bk_dmz',
    title: 'Tour guidato DMZ (per chi resta dopo il 10 mar)',
    dueDate: '2027-02-25',
    tripDayId: 14,
    assigneeSlot: null,
    status: 'todo',
    reference: 'Prenotare in anticipo · passaporto obbligatorio il giorno del tour',
    url: ''
  },
  {
    id: 'bk_tiananmen',
    title: 'Prenotazione accesso Piazza Tiananmen (Pechino)',
    dueDate: '2027-03-17',
    tripDayId: 18,
    assigneeSlot: null,
    status: 'todo',
    reference: 'Obbligatoria online con passaporto almeno 24h prima dello scalo',
    url: ''
  },
  {
    id: 'bk_china_arrival',
    title: 'Arrival Card online Cina (s.nia.gov.cn)',
    dueDate: '2027-03-18',
    tripDayId: 17,
    assigneeSlot: null,
    status: 'todo',
    reference: 'Compilabile dalle 15:20 (Seul) del 18 marzo, salvare screenshot QR',
    url: 'https://s.nia.gov.cn'
  },
  {
    id: 'bk_duck_qianmen',
    title: 'Cena anatra laccata a Qianmen (Quanjude / Siji Minfu)',
    dueDate: '2027-03-19',
    tripDayId: 18,
    assigneeSlot: null,
    status: 'todo',
    reference: 'Verificare prenotazione o coda rapida appena arrivati a Qianmen',
    url: ''
  }
];

function readLocal(): TripBooking[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(raw)) return raw as TripBooking[];
  } catch {
    /* niente */
  }
  if (!localStorage.getItem(SEEDED_KEY)) {
    const seeded: TripBooking[] = DEFAULT_BOOKINGS.map((b) => ({
      ...b,
      createdBy: 'seed',
      updatedAt: 1
    }));
    try {
      localStorage.setItem(SEEDED_KEY, '1');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      /* niente */
    }
    return seeded;
  }
  return [];
}

function writeLocal(items: TripBooking[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* niente */
  }
}

let itemsState: TripBooking[] = readLocal();
let syncMode: 'cloud' | 'local' = 'local';
const listeners = new Set<() => void>();
let started = false;

function sortBookings(list: TripBooking[]): TripBooking[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    const da = a.dueDate || '9999-99-99';
    const db = b.dueDate || '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    return a.title.localeCompare(b.title);
  });
}

function emit() {
  itemsState = sortBookings(itemsState);
  writeLocal(itemsState);
  listeners.forEach((fn) => fn());
}

function sanitizeBooking(b: TripBooking): TripBooking {
  const cleanUrl = b.url.trim().slice(0, 400);
  return {
    id: b.id.slice(0, 60),
    title: b.title.trim().slice(0, 100),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate.trim()) ? b.dueDate.trim() : '',
    tripDayId: typeof b.tripDayId === 'number' && b.tripDayId >= 0 && b.tripDayId <= 30 ? b.tripDayId : null,
    assigneeSlot: b.assigneeSlot ?? null,
    status: b.status === 'booked' ? 'booked' : 'todo',
    reference: b.reference.trim().slice(0, 240),
    url: /^https?:\/\//i.test(cleanUrl) ? cleanUrl : '',
    createdBy: b.createdBy.slice(0, 60),
    updatedAt: b.updatedAt
  };
}

function ensureStarted() {
  if (started) return;
  started = true;
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    onSnapshot(
      collection(db, 'bookings'),
      (snap) => {
        if (snap.empty && !snap.metadata.fromCache) {
          // Se la collezione sul cloud è vuota ma abbiamo le voci iniziali locali, le manteniamo visibili
          syncMode = 'cloud';
          return;
        }
        const byId = new Map<string, TripBooking>();
        for (const loc of itemsState) byId.set(loc.id, loc);
        snap.docs.forEach((d) => {
          const remote = d.data() as TripBooking;
          if (!remote || typeof remote.title !== 'string') return;
          const cur = byId.get(d.id);
          if (!cur || (remote.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) {
            byId.set(d.id, { ...remote, id: d.id });
          }
        });
        itemsState = Array.from(byId.values());
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

export async function upsertBooking(booking: TripBooking): Promise<void> {
  const clean = sanitizeBooking({ ...booking, updatedAt: Date.now() });
  const exists = itemsState.some((i) => i.id === clean.id);
  itemsState = exists ? itemsState.map((i) => (i.id === clean.id ? clean : i)) : [clean, ...itemsState];
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await setDoc(doc(db, 'bookings', clean.id), clean);
    syncMode = 'cloud';
  } catch {
    syncMode = 'local';
  }
}

export async function removeBooking(id: string): Promise<void> {
  itemsState = itemsState.filter((i) => i.id !== id);
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await deleteDoc(doc(db, 'bookings', id));
  } catch {
    syncMode = 'local';
  }
}

export function useBookings(): { bookings: TripBooking[]; todoCount: number; syncMode: 'cloud' | 'local' } {
  ensureStarted();
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const todoCount = itemsState.filter((b) => b.status === 'todo').length;
  return { bookings: itemsState, todoCount, syncMode };
}
