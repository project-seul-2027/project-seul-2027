import { useEffect, useState } from 'react';

/**
 * App installabile (PWA): registrazione del service worker e pulsante "Installa".
 * - Android/Chrome/Edge: il browser offre l'installazione (evento `beforeinstallprompt`).
 * - iPhone/iPad: si installa da Safari con Condividi → "Aggiungi alla schermata Home".
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare const __BUILD_ID__: string;

/** Versione dell'app in esecuzione (7 caratteri del commit pubblicato) */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // Percorso relativo: funziona anche su GitHub Pages (https://utente.github.io/nome-repo/)
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker non registrato:', err);
    });
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS si presenta come Mac: lo riconosce lo schermo touch
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  const [standalone, setStandalone] = useState(isStandalone);

  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onMode = () => setStandalone(isStandalone());
    mq?.addEventListener?.('change', onMode);
    return () => {
      listeners.delete(update);
      mq?.removeEventListener?.('change', onMode);
    };
  }, []);

  const ios = isIos();
  return {
    /** Già aperta come app installata */
    standalone,
    /** Il browser permette di installarla con un clic (Android/desktop) */
    canPrompt: !!deferredPrompt,
    /** Su iPhone/iPad si installa a mano da Safari */
    needsIosInstructions: ios && !standalone,
    async promptInstall(): Promise<boolean> {
      if (!deferredPrompt) return false;
      const ev = deferredPrompt;
      deferredPrompt = null;
      await ev.prompt();
      const choice = await ev.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      notify();
      return choice.outcome === 'accepted';
    }
  };
}

/** Vero quando la media query è soddisfatta (aggiornato al ridimensionamento). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}


/**
 * Avvisa quando online c'è una versione più nuova di quella aperta.
 * Controlla all'avvio, quando l'app torna in primo piano, quando torna la rete e ogni 5 minuti.
 */
export function useUpdateAvailable() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    const check = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string; version?: string };
        if (!cancelled && data.build && data.build !== BUILD_ID) {
          setUpdateAvailable(true);
          setNewVersion(data.version ?? null);
        }
      } catch {
        // offline o file assente: nessun avviso
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    const timer = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
      window.clearInterval(timer);
    };
  }, []);

  const applyUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {
      // si ricarica comunque
    }
    window.location.reload();
  };

  return { updateAvailable, newVersion, applyUpdate };
}
