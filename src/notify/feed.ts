import { useEffect, useState } from 'react';
import type { AlertCategory } from '../utils/tripAlerts';
import { readPrefs } from './prefs';

/** Registro degli avvisi ricevuti (ultimi 30) e consegna: notifica di sistema se l'app è in secondo piano, altrimenti avviso nell'app. */
export interface FeedItem {
  id: string;
  at: number;
  category: AlertCategory;
  title: string;
  body: string;
}

const FEED_KEY = 'seul2027:notify:feed';
const SEEN_KEY = 'seul2027:notify:seen';
const DELIVERED_KEY = 'seul2027:notify:delivered';

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* archiviazione bloccata */
  }
}

let feed: FeedItem[] = load<FeedItem[]>(FEED_KEY, []);
let seenAt: number = load<number>(SEEN_KEY, 0);
const listeners = new Set<() => void>();
const toastListeners = new Set<(t: FeedItem) => void>();
const emit = () => listeners.forEach((l) => l());

export function useFeed() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { feed, unread: feed.filter((f) => f.at > seenAt).length };
}

export function markFeedSeen() {
  seenAt = Date.now();
  save(SEEN_KEY, seenAt);
  emit();
}

export function clearFeed() {
  feed = [];
  save(FEED_KEY, feed);
  emit();
}

export function onToast(cb: (t: FeedItem) => void) {
  toastListeners.add(cb);
  return () => {
    toastListeners.delete(cb);
  };
}

/** Ogni avviso si consegna una volta sola (gli id restano salvati) */
export function wasDelivered(id: string): boolean {
  return load<string[]>(DELIVERED_KEY, []).includes(id);
}
function markDelivered(id: string) {
  const list = load<string[]>(DELIVERED_KEY, []);
  save(DELIVERED_KEY, [...list.filter((x) => x !== id), id].slice(-300));
}

/**
 * Consegna un avviso: lo registra, lo mostra nell'app e, se l'app è in secondo piano e il permesso c'è,
 * lo manda anche come notifica del telefono. Rispetta le scelte di "Cosa vuoi ricevere".
 */
export async function notifyLocal(n: { id: string; category: AlertCategory; title: string; body: string; toast?: boolean }): Promise<boolean> {
  if (!readPrefs()[n.category] || wasDelivered(n.id)) return false;
  markDelivered(n.id);
  const item: FeedItem = { id: n.id, at: Date.now(), category: n.category, title: n.title, body: n.body };
  feed = [item, ...feed].slice(0, 30);
  save(FEED_KEY, feed);
  emit();
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(n.title, { body: n.body, tag: n.id, icon: new URL('icons/icon-192.png', document.baseURI).href, data: { url: document.baseURI } });
      return true;
    } catch {
      /* si ripiega sull'avviso nell'app */
    }
  }
  if (n.toast !== false) toastListeners.forEach((l) => l(item));
  return true;
}
