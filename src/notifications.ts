import { useCallback, useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from './firebase/client';
import { VAPID_KEY } from './firebase/push.config';
import { isIos, isStandalone } from './pwa';

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
  await setDoc(doc(db, 'pushTokens', id), {
    uid,
    token,
    prefs: { updates: true },
    platform: platformName(),
    updatedAt: Date.now()
  });
  writeStorage(flagKey(uid), '1');
  writeStorage(tokenKey(uid), token);
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
        if (!cancelled) await saveToken(uid, token);
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
