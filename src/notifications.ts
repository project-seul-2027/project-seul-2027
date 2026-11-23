import { useCallback, useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from './firebase/client';
import { VAPID_KEY } from './firebase/push.config';
import { isIos, isStandalone } from './pwa';
import { readPrefs } from './notify/prefs';

/**
 * Notifiche push (Firebase Cloud Messaging).
 * - Il permesso si chiede solo quando l'utente tocca "Attiva notifiche".
 * - Il token del telefono si salva in Firestore (pushTokens/{uid}_{hash}); lo script del deploy
 *   (scripts/send-push.mjs) lo legge e manda l'avviso quando esce una nuova versione.
 * - La visualizzazione dell'avviso è gestita dal service worker (public/sw.js).
 */

export const isPushConfigured = VAPID_KEY.length > 40 && !VAPID_KEY.startsWith('INCOLLA_QUI');

export type PushStatus = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'working';

const flagKey = (uid: string) => `seul2027:push:${uid}`;
const tokenKey = (uid: string) => `seul2027:push-token:${uid}`;
const deviceKey = 'seul2027:push-device';

type PushReceipt = { id: string; receivedAt: number; title: string; workerBuild: string };

function deviceId(): string {
  const saved = readStorage(deviceKey);
  if (saved) return saved;
  const value = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  writeStorage(deviceKey, value);
  return value;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // archiviazione bloccata: si va avanti senza
  }
}

/** Cosa può fare questo dispositivo, senza chiedere nulla all'utente */
function deviceSupport(): 'ok' | 'ios-install' | 'unsupported' {
  if (typeof window === 'undefined' || !isFirebaseConfigured || !import.meta.env.PROD) return 'unsupported';
  const apis = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  if (apis) return 'ok';
  // Su iPhone le notifiche esistono solo per l'app aggiunta alla Home
  return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
}

function initialStatus(uid: string | undefined): PushStatus {
  const support = deviceSupport();
  if (support !== 'ok') return support;
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && uid && readStorage(flagKey(uid)) === '1') return 'on';
  return 'off';
}

async function tokenDocId(uid: string, token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${uid}_${hex.slice(0, 32)}`;
}

function platformName(): string {
  if (isIos()) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

async function fetchToken(): Promise<string> {
  const messagingModule = await import('firebase/messaging');
  if (!(await messagingModule.isSupported())) throw new Error('Notifiche non supportate da questo browser.');
  const registration = await navigator.serviceWorker.ready;
  const token = await messagingModule.getToken(messagingModule.getMessaging(getApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('Nessun token ricevuto da Firebase.');
  return token;
}

async function saveToken(uid: string, token: string): Promise<void> {
  const { db } = firebase();
  const id = await tokenDocId(uid, token);
  const registration = await navigator.serviceWorker.ready;
  await setDoc(doc(db, 'pushTokens', id), {
    uid,
    token,
    prefs: { ...readPrefs() },
    platform: platformName(),
    deviceId: deviceId(),
    userAgent: navigator.userAgent.slice(0, 300),
    standalone: isStandalone(),
    workerBuild: new URL(registration.active?.scriptURL ?? registration.installing?.scriptURL ?? location.href).searchParams.get('build') ?? 'unknown',
    updatedAt: Date.now()
  });
  writeStorage(flagKey(uid), '1');
  writeStorage(tokenKey(uid), token);
}

function readPushReceipts(): Promise<PushReceipt[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open('seul2027-push', 1);
    request.onerror = () => resolve([]);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('receipts')) db.createObjectStore('receipts', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('receipts', 'readonly');
      const all = tx.objectStore('receipts').getAll();
      all.onerror = () => resolve([]);
      all.onsuccess = () => resolve((all.result as PushReceipt[]).slice(-50));
    };
  });
}

function clearPushReceipts(ids: string[]): Promise<void> {
  return new Promise((resolve) => {
    if (!ids.length) return resolve();
    const request = indexedDB.open('seul2027-push', 1);
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const tx = request.result.transaction('receipts', 'readwrite');
      const store = tx.objectStore('receipts');
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
  });
}

/** Registra su Firestore le push realmente ricevute dal service worker, non soltanto accettate da FCM. */
async function syncPushReceipts(uid: string): Promise<void> {
  const receipts = await readPushReceipts();
  if (!receipts.length) return;
  const { db } = firebase();
  const batch = writeBatch(db);
  const currentDevice = deviceId();
  for (const receipt of receipts) {
    const safeId = receipt.id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
    batch.set(doc(db, 'pushReceipts', `${uid}_${currentDevice}_${safeId}`), {
      uid,
      deviceId: currentDevice,
      messageId: receipt.id,
      title: receipt.title.slice(0, 120),
      receivedAt: receipt.receivedAt,
      workerBuild: receipt.workerBuild.slice(0, 80)
    });
  }
  await batch.commit();
  await clearPushReceipts(receipts.map((receipt) => receipt.id));
}

/** Copia sul documento del telefono ciò che l'utente vuole ricevere (lo legge il server). */
export async function syncPushPrefs(uid: string): Promise<void> {
  const token = readStorage(tokenKey(uid));
  if (!token || readStorage(flagKey(uid)) !== '1') return;
  try {
    await saveToken(uid, token);
  } catch {
    // offline: si aggiorna alla prossima apertura
  }
}

/** Test end-to-end: server → FCM → service worker, non una notifica simulata dentro l'app. */
export async function sendPushTest(): Promise<{ accepted: number; total: number }> {
  const endpoint = import.meta.env.VITE_MAP_SEARCH_URL?.trim().replace(/\/$/, '');
  const user = firebase().auth.currentUser;
  if (!endpoint || !user) throw new Error('Servizio notifiche non configurato.');
  const response = await fetch(`${endpoint}/push-test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Test notifiche non riuscito (${response.status}).`);
  return response.json() as Promise<{ accepted: number; total: number }>;
}

/** Da chiamare direttamente dal tocco dell'utente (iPhone richiede il gesto per il permesso). */
export async function enablePush(uid: string): Promise<'on' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const token = await fetchToken();
  await saveToken(uid, token);
  return 'on';
}

/** Toglie il telefono dall'elenco delle notifiche (anche all'uscita dall'account). */
export async function disablePush(uid: string): Promise<void> {
  let token = readStorage(tokenKey(uid));
  writeStorage(flagKey(uid), null);
  writeStorage(tokenKey(uid), null);
  if (!token && deviceSupport() === 'ok' && Notification.permission === 'granted' && isPushConfigured) {
    token = await fetchToken().catch(() => null);
  }
  if (token) {
    const { db } = firebase();
    await deleteDoc(doc(db, 'pushTokens', await tokenDocId(uid, token))).catch(() => undefined);
    try {
      const messagingModule = await import('firebase/messaging');
      await messagingModule.deleteToken(messagingModule.getMessaging(getApp()));
    } catch {
      // il token scade comunque da solo
    }
  }
}

/** Tiene aggiornato il token (Firebase ogni tanto lo cambia) per chi ha già attivato le notifiche. */
export function useSyncPushRegistration(uid: string | undefined) {
  useEffect(() => {
    if (!uid || !isPushConfigured || initialStatus(uid) !== 'on') return;
    let cancelled = false;
    (async () => {
      try {
        const token = await fetchToken();
        if (!cancelled) {
          await saveToken(uid, token);
          await syncPushReceipts(uid);
        }
      } catch {
        // offline o Firebase non raggiungibile: si riprova alla prossima apertura
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);
}

export function usePush(uid: string | undefined) {
  const [status, setStatus] = useState<PushStatus>(() => initialStatus(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus(uid));
  }, [uid]);

  const enable = useCallback(async () => {
    if (!uid) return;
    setError(null);
    setStatus('working');
    try {
      setStatus(await enablePush(uid));
    } catch (err) {
      console.warn('Attivazione notifiche non riuscita:', err);
      setError('Non sono riuscito ad attivarle. Riprova tra poco.');
      setStatus('off');
    }
  }, [uid]);

  const disable = useCallback(async () => {
    if (!uid) return;
    setError(null);
    setStatus('working');
    try {
      await disablePush(uid);
      setStatus('off');
    } catch (err) {
      console.warn('Disattivazione notifiche non riuscita:', err);
      setError('Non sono riuscito a disattivarle. Riprova tra poco.');
      setStatus('on');
    }
  }, [uid]);

  return { status, error, enable, disable };
}
