import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { AccommodationId } from '../shared/travelerProfile';

export interface SeoulHomeDoc {
  confirmedAccId: AccommodationId | null;
  exactAddress: string;
  exactAddressKo: string;
  floorAndUnit: string;
  doorPin: string;
  wifiSsid: string;
  wifiPass: string;
  trashRules: string;
  hostNotes: string;
  checkoutChecks: Record<string, boolean>;
  updatedAt: number;
}

export const CHECKOUT_10_MAR_ITEMS = [
  { id: 'c10_pack', label: 'Valigia chiusa, passaporto e carta d’imbarco pronti' },
  { id: 'c10_room', label: 'Controllato camera, bagno e prese (nessun caricatore dimenticato)' },
  { id: 'c10_keys', label: 'Chiavi / tessera lasciate agli altri tre prima di uscire (5:45)' }
] as const;

export const CHECKOUT_19_MAR_ITEMS = [
  { id: 'c19_trash', label: 'Raccolta differenziata separata e chiusa nei sacchetti del quartiere' },
  { id: 'c19_power', label: 'Clima, riscaldamento a pavimento, fornelli e luci spenti' },
  { id: 'c19_photos', label: 'Foto di ogni stanza scattate (richieste da Enko Stay al check-out)' },
  { id: 'c19_lock', label: 'Porta chiusa / chiavi riposte entro le 07:30' }
] as const;

const STORAGE_KEY = 'seul2027:seoulHome:v1';

const EMPTY_HOME: SeoulHomeDoc = {
  confirmedAccId: null,
  exactAddress: '',
  exactAddressKo: '',
  floorAndUnit: '',
  doorPin: '',
  wifiSsid: '',
  wifiPass: '',
  trashRules: '',
  hostNotes: '',
  checkoutChecks: {},
  updatedAt: 0
};

function readLocal(): SeoulHomeDoc {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      return {
        ...EMPTY_HOME,
        ...(raw as Partial<SeoulHomeDoc>),
        checkoutChecks:
          raw.checkoutChecks && typeof raw.checkoutChecks === 'object' ? (raw.checkoutChecks as Record<string, boolean>) : {}
      };
    }
  } catch {
    /* niente */
  }
  return EMPTY_HOME;
}

function writeLocal(data: SeoulHomeDoc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* spazio esaurito */
  }
}

let homeState: SeoulHomeDoc = readLocal();
let syncMode: 'cloud' | 'local' = 'local';
const listeners = new Set<() => void>();
let started = false;

function emit() {
  writeLocal(homeState);
  listeners.forEach((fn) => fn());
}

function sanitizeHome(d: SeoulHomeDoc): SeoulHomeDoc {
  const validAccs = new Set(['acc_a', 'acc_b', 'acc_c', 'acc_d']);
  const checks: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(d.checkoutChecks ?? {})) {
    if (typeof v === 'boolean' && k.length <= 32) checks[k] = v;
  }
  return {
    confirmedAccId: d.confirmedAccId && validAccs.has(d.confirmedAccId) ? d.confirmedAccId : null,
    exactAddress: d.exactAddress.trim().slice(0, 200),
    exactAddressKo: d.exactAddressKo.trim().slice(0, 200),
    floorAndUnit: d.floorAndUnit.trim().slice(0, 80),
    doorPin: d.doorPin.trim().slice(0, 60),
    wifiSsid: d.wifiSsid.trim().slice(0, 80),
    wifiPass: d.wifiPass.trim().slice(0, 100),
    trashRules: d.trashRules.trim().slice(0, 400),
    hostNotes: d.hostNotes.trim().slice(0, 400),
    checkoutChecks: checks,
    updatedAt: d.updatedAt
  };
}

function ensureStarted() {
  if (started) return;
  started = true;
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    onSnapshot(
      doc(db, 'appFiles', 'seoulHome'),
      (snap) => {
        if (!snap.exists()) {
          syncMode = 'cloud';
          return;
        }
        const remote = snap.data() as Partial<SeoulHomeDoc>;
        const remoteUpdated = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0;
        if (remoteUpdated >= (homeState.updatedAt ?? 0)) {
          homeState = sanitizeHome({
            ...EMPTY_HOME,
            ...remote,
            updatedAt: remoteUpdated
          });
          syncMode = 'cloud';
          emit();
        }
      },
      () => {
        syncMode = 'local';
      }
    );
  } catch {
    syncMode = 'local';
  }
}

export async function saveSeoulHome(patch: Partial<SeoulHomeDoc>): Promise<void> {
  const next = sanitizeHome({
    ...homeState,
    ...patch,
    updatedAt: Date.now()
  });
  homeState = next;
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await setDoc(doc(db, 'appFiles', 'seoulHome'), next);
    syncMode = 'cloud';
  } catch {
    syncMode = 'local';
  }
}

export async function toggleCheckoutCheck(checkId: string): Promise<void> {
  const cur = homeState.checkoutChecks[checkId] === true;
  await saveSeoulHome({
    checkoutChecks: {
      ...homeState.checkoutChecks,
      [checkId]: !cur
    }
  });
}

export function isSeoulHomeConfigured(docData: SeoulHomeDoc = homeState): boolean {
  return Boolean(docData.doorPin || docData.wifiSsid || docData.exactAddress || docData.exactAddressKo);
}

export function getSeoulHomeSnapshot(): SeoulHomeDoc {
  return homeState;
}

export function useSeoulHome(): { homeDoc: SeoulHomeDoc; configured: boolean; syncMode: 'cloud' | 'local' } {
  ensureStarted();
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { homeDoc: homeState, configured: isSeoulHomeConfigured(homeState), syncMode };
}
