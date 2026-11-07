import { isStandalone } from './pwa';

/**
 * Indirizzi statici delle pagine (solo desktop nel browser).
 * Esempio: https://.../?p=map apre direttamente la Mappa e la URL resta aggiornata.
 * Il telefono e l'app installata non vengono toccati.
 */

const PAGE_PARAM = 'p';
const PENDING_KEY = 'seoul2027_pending_page';

/** Vero solo su desktop nel browser (non nell'app installata). */
export function usesPageAddress(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 1024px)').matches && !isStandalone();
}

/** Valore dell'indirizzo: ?p= ha la precedenza, ?tab= resta come alias. */
export function pageFromUrl(search: string): string | null {
  const sp = new URLSearchParams(search);
  return sp.get(PAGE_PARAM) ?? sp.get('tab');
}

/** Chiede all'app di aprire una pagina (da una notifica toccata o dall'elenco degli avvisi). */
export function requestOpenPage(id: string): void {
  window.dispatchEvent(new CustomEvent('seul:open-page', { detail: id }));
}

/** Ricorda la pagina richiesta, così sopravvive al giro di login. */
export function rememberPage(id: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, id);
  } catch {
    /* archiviazione non disponibile: si ignora */
  }
}

/** Legge e cancella la pagina ricordata. */
export function takeRememberedPage(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

/** Scrive la pagina nell'indirizzo senza aggiungere voci alla cronologia. */
export function writePageToUrl(id: string): void {
  if (!usesPageAddress()) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    if (id === 'cover') url.searchParams.delete(PAGE_PARAM);
    else url.searchParams.set(PAGE_PARAM, id);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  } catch {
    /* URL non scrivibile: si ignora */
  }
}
