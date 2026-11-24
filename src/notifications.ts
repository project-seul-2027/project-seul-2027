import { useCallback, useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import { deleteDoc, doc, getDocFromServer, setDoc, writeBatch } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from './firebase/client';
import { VAPID_KEY } from './firebase/push.config';
import { BUILD_ID, isIos, isStandalone } from './pwa';
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
const lastReceiptKey = 'seul2027:push-last-receipt';
const pendingClosedTestKey = 'seul2027:push-closed-test';

type PushReceipt = { id: string; receivedAt: number; title: string; workerBuild: string };

export type PushDiagnosticState = 'ok' | 'warning' | 'error';
export interface PushDiagnosticItem {
  id: 'install' | 'permission' | 'worker' | 'subscription' | 'token';
  label: string;
  detail: string;
  state: PushDiagnosticState;
}
export interface PushDiagnosticReport {
  ready: boolean;
  canRepair: boolean;
  canEnable: boolean;
  platform: string;
  items: PushDiagnosticItem[];
}

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
  const newest = receipts.reduce((latest, receipt) => receipt.receivedAt > latest.receivedAt ? receipt : latest, receipts[0]);
  writeStorage(lastReceiptKey, JSON.stringify(newest));
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
export async function sendPushTest(delaySeconds = 0): Promise<{ accepted: number; total: number; testId: string; scheduled?: boolean }> {
  const endpoint = import.meta.env.VITE_MAP_SEARCH_URL?.trim().replace(/\/$/, '');
  const user = firebase().auth.currentUser;
  if (!endpoint || !user) throw new Error('Servizio notifiche non configurato.');
  const response = await fetch(`${endpoint}/push-test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ delaySeconds }),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Test notifiche non riuscito (${response.status}).`);
  return response.json() as Promise<{ accepted: number; total: number; testId: string; scheduled?: boolean }>;
}

export async function inspectPushRegistration(uid: string): Promise<PushDiagnosticReport> {
  const platform = platformName();
  const items: PushDiagnosticItem[] = [];
  const installed = isStandalone();
  const productionReady = import.meta.env.PROD;
  items.push({
    id: 'install',
    label: 'Installazione',
    state: isIos() && !installed ? 'error' : installed ? 'ok' : 'warning',
    detail: isIos() && !installed
      ? 'Aggiungi l’app alla schermata Home e aprila dalla sua icona.'
      : installed ? 'L’app è aperta come PWA installata.' : 'Funziona dal browser, ma installarla rende l’uso più stabile.'
  });

  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  items.push({
    id: 'permission',
    label: 'Permesso',
    state: permission === 'granted' ? 'ok' : 'error',
    detail: !productionReady ? 'Il controllo completo sarà disponibile nella versione pubblicata.' : permission === 'granted'
      ? 'Il telefono consente le notifiche.'
      : permission === 'denied' ? 'Riattivale dalle impostazioni del telefono o del browser.' : 'Attivale con il pulsante qui sotto.'
  });

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker?.getRegistration();
  } catch {
    registration = undefined;
  }
  const activeUrl = registration?.active?.scriptURL;
  const workerBuild = activeUrl ? new URL(activeUrl).searchParams.get('build') : null;
  const workerCurrent = Boolean(registration?.active && navigator.serviceWorker.controller && workerBuild === BUILD_ID);
  items.push({
    id: 'worker',
    label: 'Servizio in background',
    state: workerCurrent ? 'ok' : 'warning',
    detail: workerCurrent ? `Aggiornato alla versione ${BUILD_ID}.` : 'Deve essere aggiornato per ricevere gli avvisi ad app chiusa.'
  });

  const subscription = await registration?.pushManager.getSubscription().catch(() => null);
  items.push({
    id: 'subscription',
    label: 'Collegamento push',
    state: subscription ? 'ok' : 'error',
    detail: subscription ? 'Questo dispositivo è collegato al servizio push.' : 'Il collegamento push va ricreato.'
  });

  const storedToken = readStorage(tokenKey(uid));
  const tokenSaved = readStorage(flagKey(uid)) === '1' && Boolean(storedToken);
  let tokenOnServer = false;
  let serverChecked = false;
  if (storedToken && navigator.onLine) {
    try {
      tokenOnServer = (await getDocFromServer(doc(firebase().db, 'pushTokens', await tokenDocId(uid, storedToken)))).exists();
      serverChecked = true;
    } catch {
      serverChecked = false;
    }
  }
  items.push({
    id: 'token',
    label: 'Registrazione del telefono',
    state: tokenSaved && tokenOnServer ? 'ok' : tokenSaved && !serverChecked ? 'warning' : 'error',
    detail: tokenSaved && tokenOnServer
      ? 'Il telefono è registrato tra i destinatari.'
      : tokenSaved && !serverChecked ? 'Registrazione locale presente; il server non è raggiungibile.' : 'Manca la registrazione di questo telefono sul server.'
  });

  const ready = items.every((item) => item.state === 'ok' || (item.id === 'install' && !isIos()));
  return {
    ready,
    canEnable: productionReady && permission === 'default' && (!isIos() || installed),
    canRepair: productionReady && permission === 'granted' && (!isIos() || installed),
    platform,
    items
  };
}

/** Ricrea token e sottoscrizione lasciando intatta la cache offline dell'app. */
export async function repairPushRegistration(uid: string): Promise<PushDiagnosticReport> {
  if (Notification.permission !== 'granted') throw new Error('Prima autorizza le notifiche.');
  const oldToken = readStorage(tokenKey(uid));
  const registration = await navigator.serviceWorker.ready;
  await registration.update().catch(() => undefined);
  const messagingModule = await import('firebase/messaging');
  await messagingModule.deleteToken(messagingModule.getMessaging(getApp())).catch(() => false);
  if (oldToken) {
    const { db } = firebase();
    await deleteDoc(doc(db, 'pushTokens', await tokenDocId(uid, oldToken))).catch(() => undefined);
  }
  const token = await fetchToken();
  await saveToken(uid, token);
  return inspectPushRegistration(uid);
}

async function waitForPushReceipt(id: string, timeoutMs = 15_000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if ((await readPushReceipts()).some((receipt) => receipt.id === id)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  return false;
}

/** Prova completa server → FCM → service worker e conferma la ricezione su questo dispositivo. */
export async function runPushDeliveryTest(uid: string): Promise<{ received: boolean; accepted: number; total: number }> {
  const result = await sendPushTest();
  if (result.total === 0) throw new Error('Questo account non ha dispositivi registrati.');
  const received = await waitForPushReceipt(result.testId);
  if (received) await syncPushReceipts(uid).catch(() => undefined);
  return { received, accepted: result.accepted, total: result.total };
}

export type ClosedPushTestState = 'none' | 'waiting' | 'received' | 'missing';

/** Programma una push fra 8 secondi: il partecipante può chiudere l'app e verificarla davvero in background. */
export async function scheduleClosedAppPushTest(): Promise<void> {
  const result = await sendPushTest(8);
  writeStorage(pendingClosedTestKey, JSON.stringify({ id: result.testId, startedAt: Date.now() }));
}

export async function inspectClosedAppPushTest(): Promise<ClosedPushTestState> {
  const raw = readStorage(pendingClosedTestKey);
  if (!raw) return 'none';
  let pending: { id: string; startedAt: number };
  try {
    pending = JSON.parse(raw) as { id: string; startedAt: number };
  } catch {
    writeStorage(pendingClosedTestKey, null);
    return 'none';
  }
  const stored = readStorage(lastReceiptKey);
  let last: PushReceipt | null = null;
  try {
    last = stored ? JSON.parse(stored) as PushReceipt : null;
  } catch {
    writeStorage(lastReceiptKey, null);
  }
  const live = await readPushReceipts();
  if (last?.id === pending.id || live.some((receipt) => receipt.id === pending.id)) {
    writeStorage(pendingClosedTestKey, null);
    return 'received';
  }
  if (Date.now() - pending.startedAt > 30_000) {
    writeStorage(pendingClosedTestKey, null);
    return 'missing';
  }
  return 'waiting';
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
