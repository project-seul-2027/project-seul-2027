import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase } from '../firebase/client';

/** Prezzi totali (17 notti) degli alloggi modificati dal Partecipante 1. Chiave = id alloggio. */
export type PriceOverrides = Record<string, number>;

export const accommodationPriceService = {
  watch(callback: (prices: PriceOverrides) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(
      collection(firebase().db, 'accommodationPrices'),
      (snap) => {
        const out: PriceOverrides = {};
        snap.docs.forEach((d) => {
          const v = d.data().totalEur17Nights;
          if (typeof v === 'number' && Number.isFinite(v)) out[d.id] = v;
        });
        callback(out);
      },
      (err) => onError?.(err)
    );
  },

  async set(accId: string, totalEur17Nights: number): Promise<void> {
    await setDoc(doc(firebase().db, 'accommodationPrices', accId), {
      totalEur17Nights,
      updatedAt: Date.now()
    });
  }
};
