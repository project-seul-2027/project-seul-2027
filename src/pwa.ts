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
