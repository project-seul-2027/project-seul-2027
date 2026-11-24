import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { PackingCategory } from '../types/packing';
import type { TravelerSlotId } from '../shared/travelerProfile';

export interface CommonPackingItem {
  id: string;
  title: string;
  category: PackingCategory;
  /** Chi dei 4 porta l'oggetto per tutto il gruppo (null = ancora da assegnare) */
  carrierSlot: TravelerSlotId | null;
  packed: boolean;
  note: string;
  updatedAt: number;
}

const STORAGE_KEY = 'seul2027:commonPacking:v1';
const SEEDED_KEY = 'seul2027:commonPacking:seeded:v1';

export const RECOMMENDED_COMMON_ITEMS: Omit<CommonPackingItem, 'updatedAt'>[] = [
  {
    id: 'cm_powerstrip',
    title: 'Ciabatta multipresa con porte USB-C',
    category: 'electronics',
    carrierSlot: null,
    packed: false,
    note: 'Basta una per l’appartamento: prese coreane tipo C/F come in Italia'
  },
  {
    id: 'cm_firstaid',
    title: 'Kit medicinali comuni (antidolorifico, cerotti, fermenti, antistaminico)',
    category: 'health',
    carrierSlot: null,
    packed: false,
    note: 'Tenere i farmaci nelle confezioni originali'
  },
  {
    id: 'cm_scale',
    title: 'Bilancia pesa-valigie portatile',
    category: 'flight',
    carrierSlot: null,
    packed: false,
    note: 'Fondamentale per il limite 23 kg Air China al rientro'
  },
  {
    id: 'cm_laundry',
    title: 'Foglietti detersivo lavatrice / smacchiatore',
    category: 'hygiene',
    carrierSlot: null,
    packed: false,
    note: 'Zero liquidi in valigia, comodi per i lavaggi in alloggio'
  },
  {
    id: 'cm_bags',
    title: 'Sacchetti richiudibili e buste per scarpe / biancheria',
    category: 'misc',
    carrierSlot: null,
    packed: false,
    note: 'Utili anche per la raccolta differenziata di fine soggiorno'
  },
  {
    id: 'cm_umbrella',
    title: 'Ombrello pieghevole compatto di scorta',
    category: 'clothing',
    carrierSlot: null,
    packed: false,
    note: 'A marzo a Seul può capitare una giornata di pioggia'
  }
];

function readLocal(): CommonPackingItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(raw)) return raw as CommonPackingItem[];
  } catch {
    /* niente */
  }
  if (!localStorage.getItem(SEEDED_KEY)) {
    const seeded: CommonPackingItem[] = RECOMMENDED_COMMON_ITEMS.map((item) => ({
      ...item,
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

function writeLocal(items: CommonPackingItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* niente */
  }
}

let itemsState: CommonPackingItem[] = readLocal();
let syncMode: 'cloud' | 'local' = 'local';
const listeners = new Set<() => void>();
let started = false;

function sortCommon(list: CommonPackingItem[]): CommonPackingItem[] {
  return [...list].sort((a, b) => {
    // Prima quelli senza responsabile, poi quelli non ancora in valigia
    const aUnassigned = a.carrierSlot === null ? 0 : 1;
    const bUnassigned = b.carrierSlot === null ? 0 : 1;
    if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
    if (a.packed !== b.packed) return a.packed ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
}

function emit() {
  itemsState = sortCommon(itemsState);
  writeLocal(itemsState);
  listeners.forEach((fn) => fn());
}

function sanitizeCommonItem(item: CommonPackingItem): CommonPackingItem {
  return {
    id: item.id.slice(0, 60),
    title: item.title.trim().slice(0, 100),
    category: item.category,
    carrierSlot: item.carrierSlot ?? null,
    packed: !!item.packed,
    note: item.note.trim().slice(0, 240),
    updatedAt: item.updatedAt
  };
}

function ensureStarted() {
  if (started) return;
  started = true;
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    onSnapshot(
      collection(db, 'commonPacking'),
      (snap) => {
        if (snap.empty && !snap.metadata.fromCache) {
          syncMode = 'cloud';
          return;
        }
        const byId = new Map<string, CommonPackingItem>();
        for (const loc of itemsState) byId.set(loc.id, loc);
        snap.docs.forEach((d) => {
          const remote = d.data() as CommonPackingItem;
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

export async function upsertCommonItem(item: CommonPackingItem): Promise<void> {
  const clean = sanitizeCommonItem({ ...item, updatedAt: Date.now() });
  const exists = itemsState.some((i) => i.id === clean.id);
  itemsState = exists ? itemsState.map((i) => (i.id === clean.id ? clean : i)) : [clean, ...itemsState];
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await setDoc(doc(db, 'commonPacking', clean.id), clean);
    syncMode = 'cloud';
  } catch {
    syncMode = 'local';
  }
}

export async function removeCommonItem(id: string): Promise<void> {
  itemsState = itemsState.filter((i) => i.id !== id);
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await deleteDoc(doc(db, 'commonPacking', id));
  } catch {
    syncMode = 'local';
  }
}

export async function restoreRecommendedCommonItems(): Promise<number> {
  const existingTitles = new Set(itemsState.map((i) => i.title.toLowerCase().trim()));
  let added = 0;
  for (const rec of RECOMMENDED_COMMON_ITEMS) {
    if (!existingTitles.has(rec.title.toLowerCase().trim())) {
      added += 1;
      await upsertCommonItem({ ...rec, updatedAt: Date.now() });
    }
  }
  return added;
}

export function useCommonPacking(): {
  items: CommonPackingItem[];
  unassignedCount: number;
  packedCount: number;
  syncMode: 'cloud' | 'local';
} {
  ensureStarted();
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const unassignedCount = itemsState.filter((i) => i.carrierSlot === null).length;
  const packedCount = itemsState.filter((i) => i.packed).length;
  return { items: itemsState, unassignedCount, packedCount, syncMode };
}
