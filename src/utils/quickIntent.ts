import { useEffect, useRef } from 'react';

/**
 * Azioni del pulsante + (telefono): la sezione di destinazione apre subito il punto giusto
 * (fotocamera, nuova spesa, nuovo luogo, ritrovo, traduzione, "ho perso il gruppo").
 * L'intenzione resta in attesa finché la sezione non è montata, poi viene consumata una sola volta.
 */
export type QuickIntent = 'expense' | 'photo' | 'place' | 'meetup' | 'lost' | 'translate';

const EVT = 'seul2027:intent';
let pending: QuickIntent | null = null;

export function requestIntent(kind: QuickIntent): void {
  pending = kind;
  // Dopo il cambio di scheda: così la consuma la sezione appena aperta, non quella che si sta chiudendo
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(EVT, { detail: kind })), 60);
}

function take(kind: QuickIntent): boolean {
  if (pending !== kind) return false;
  pending = null;
  return true;
}

/** Esegue `handler` quando arriva l'intenzione `kind` (anche se la sezione era già aperta). */
export function useQuickIntent(kind: QuickIntent, handler: () => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (take(kind)) ref.current();
    const on = (e: Event) => {
      if ((e as CustomEvent).detail === kind && take(kind)) ref.current();
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [kind]);
}
