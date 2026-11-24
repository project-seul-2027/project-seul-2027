/**
 * Archiviazione locale (offline-first) degli acquisti Tax-Free in Corea del Sud.
 * Gli acquisti Tax-Free sono personali (legati al proprio passaporto), quindi restano sul dispositivo
 * e funzionano istantaneamente anche in negozio o al chiosco di Incheon senza rete.
 */

export type TaxFreeStatus = 'kiosk' | 'instant' | 'refunded';

export interface TaxFreeEntry {
  id: string;
  store: string;
  amountKrw: number;
  status: TaxFreeStatus;
  date: string;
  note?: string;
  createdAt: number;
}

/** Soglia minima in Corea del Sud per singolo scontrino Tax-Free (dal 2024: 15.000 KRW). */
export const TAX_FREE_MIN_KRW = 15_000;
/** Limite massimo per scontrino del rimborso immediato in cassa (oltre: chiosco in aeroporto). */
export const TAX_FREE_INSTANT_MAX_KRW = 1_000_000;
/** Rimborso netto indicativo (IVA 10% meno commissione operatore: ~6,5% in media). */
export const TAX_FREE_ESTIMATED_RATE = 0.065;

export function estimateRefundKrw(amountKrw: number): number {
  if (!Number.isFinite(amountKrw) || amountKrw < TAX_FREE_MIN_KRW) return 0;
  return Math.round((amountKrw * TAX_FREE_ESTIMATED_RATE) / 100) * 100;
}

const keyFor = (uid: string | null) => `seul2027:taxfree:v1:${uid || 'local'}`;

export function loadTaxFree(uid: string | null): TaxFreeEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(uid)) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is TaxFreeEntry =>
        !!item &&
        typeof item.id === 'string' &&
        typeof item.store === 'string' &&
        typeof item.amountKrw === 'number' &&
        (item.status === 'kiosk' || item.status === 'instant' || item.status === 'refunded')
    );
  } catch {
    return [];
  }
}

export function saveTaxFree(uid: string | null, items: TaxFreeEntry[]): void {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(items));
  } catch {
    /* spazio esaurito o archiviazione bloccata */
  }
}
