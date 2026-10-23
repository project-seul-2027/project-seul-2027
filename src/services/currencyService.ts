/**
 * Servizio per il recupero dei tassi di cambio in tempo reale (EUR / KRW / CNY).
 * Si aggiorna automaticamente ogni giorno prelevando i dati dall'API ufficiale open.er-api.com
 * e salvando i dati nella cache locale con data dell'ultimo aggiornamento.
 */

export interface LiveExchangeRates {
  EUR: number;
  KRW: number;
  CNY: number;
  lastUpdatedDate: string;
  lastUpdatedTime: string;
  isLive: boolean;
  source: string;
}

const STORAGE_KEY = 'seoul2027_exchange_rates';

// Tassi conservativi di riserva (fallback offline)
export const FALLBACK_RATES: LiveExchangeRates = {
  EUR: 1,
  KRW: 1485.5,
  CNY: 7.52,
  lastUpdatedDate: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  lastUpdatedTime: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
  isLive: false,
  source: 'Tasso di riferimento locale'
};

/**
 * Ottiene i tassi di cambio correnti.
 * Se non sono ancora stati scaricati oggi, tenta la chiamata online.
 */
export async function getLiveExchangeRates(forceRefresh = false): Promise<LiveExchangeRates> {
  const todayStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Controlla cache locale
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: LiveExchangeRates = JSON.parse(cached);
        // Se è già stato aggiornato oggi, riutilizza il valore
        if (parsed.lastUpdatedDate === todayStr && parsed.KRW > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Errore lettura cache tassi:', e);
    }
  }

  // Chiamata all'API online gratuita (Open Exchange Rates API open.er-api.com)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR');
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }
    const data = await res.json();
    if (data && data.rates && data.rates.KRW && data.rates.CNY) {
      const now = new Date();
      const liveRates: LiveExchangeRates = {
        EUR: 1,
        KRW: Number(data.rates.KRW.toFixed(2)),
        CNY: Number(data.rates.CNY.toFixed(2)),
        lastUpdatedDate: now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        lastUpdatedTime: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        isLive: true,
        source: 'Live Exchange Rates API (open.er-api.com)'
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(liveRates));
      } catch (e) {
        // storage quota fallback
      }

      return liveRates;
    }
  } catch (err) {
    console.warn('Impossibile scaricare tassi online, uso fallback:', err);
  }

  // Se la chiamata fallisce, prova a recuperare l'ultimo valore presente in cache o fallback
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // ignore
  }

  return FALLBACK_RATES;
}
