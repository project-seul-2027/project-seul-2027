import { useEffect, useState } from 'react';
import type { AlertCategory } from '../utils/tripAlerts';

/** Cosa vuoi ricevere: resta su questo telefono e (se le notifiche sono attive) viene copiato sul documento del telefono per il server. */
export interface NotifyPrefs extends Record<AlertCategory, boolean> {
  /** Di notte niente avvisi del programma */
  quiet: boolean;
}

export const DEFAULT_PREFS: NotifyPrefs = { schedule: true, bookings: true, group: true, updates: true, quiet: true };
const KEY = 'seul2027:notify:prefs';

let current: NotifyPrefs | null = null;
const listeners = new Set<(p: NotifyPrefs) => void>();

export function readPrefs(): NotifyPrefs {
  if (current) return current;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NotifyPrefs> | null;
    current = { ...DEFAULT_PREFS };
    if (raw) for (const k of Object.keys(DEFAULT_PREFS) as (keyof NotifyPrefs)[]) if (typeof raw[k] === 'boolean') current[k] = raw[k] as boolean;
  } catch {
    current = { ...DEFAULT_PREFS };
  }
  return current;
}

export function writePrefs(patch: Partial<NotifyPrefs>) {
  current = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* archiviazione bloccata */
  }
  listeners.forEach((l) => l(current!));
}

export function usePrefs(): NotifyPrefs {
  const [p, setP] = useState(readPrefs);
  useEffect(() => {
    listeners.add(setP);
    setP(readPrefs());
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
