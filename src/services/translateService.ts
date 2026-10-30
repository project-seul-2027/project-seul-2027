import { TRANSLATE_API_KEY } from '../firebase/translate.config';

export type TranslateDir = 'it-ko' | 'ko-it';

const KEY_OVERRIDE = 'seul2027:translate:key';
const PLACEHOLDER = 'INCOLLA_QUI_LA_CHIAVE_TRADUZIONE';

function apiKey(): string {
  try {
    const o = localStorage.getItem(KEY_OVERRIDE);
    if (o) return o;
  } catch {
    /* niente */
  }
  return TRANSLATE_API_KEY;
}

export const translateConfigured = () => {
  const k = apiKey();
  return !!k && k !== PLACEHOLDER;
};

/** Dal 21/02/2027 (poco prima del viaggio) una chiave mancante è un errore da sistemare; prima la funzione è semplicemente non attiva. */
export const TRANSLATE_DEADLINE_MS = Date.parse('2027-02-21T00:00:00+01:00');

export type TranslateStatus = 'ready' | 'disabled' | 'missing';

export function translateStatus(now = Date.now()): TranslateStatus {
  if (translateConfigured()) return 'ready';
  return now < TRANSLATE_DEADLINE_MS ? 'disabled' : 'missing';
}

export class TranslateError extends Error {}

/** Traduce con Google Cloud Translation. Serve internet. */
export async function translate(text: string, dir: TranslateDir): Promise<string> {
  const q = text.trim();
  if (!q) throw new TranslateError('Scrivi qualcosa da tradurre.');
  if (q.length > 500) throw new TranslateError('Testo troppo lungo: massimo 500 caratteri.');
  if (!translateConfigured()) throw new TranslateError('Traduzione non configurata: manca la chiave nel file translate.config.ts.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new TranslateError('Sei offline: la traduzione libera ha bisogno di internet. Le frasi pronte funzionano anche senza.');
  const [source, target] = dir === 'it-ko' ? ['it', 'ko'] : ['ko', 'it'];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, source, target, format: 'text' }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 400) throw new TranslateError('Chiave non valida o non abilitata per questo sito: controlla le restrizioni in Google Cloud.');
      if (res.status === 429) throw new TranslateError('Troppe richieste: riprova tra poco.');
      throw new TranslateError(`Traduzione non riuscita (errore ${res.status}).`);
    }
    const json = (await res.json()) as { data?: { translations?: { translatedText?: string }[] } };
    const out = json.data?.translations?.[0]?.translatedText;
    if (!out) throw new TranslateError('Nessuna traduzione ricevuta.');
    return out;
  } catch (err) {
    if (err instanceof TranslateError) throw err;
    if ((err as Error).name === 'AbortError') throw new TranslateError('La traduzione ha impiegato troppo: controlla la connessione.');
    throw new TranslateError('Traduzione non riuscita: controlla la connessione.');
  } finally {
    clearTimeout(timer);
  }
}
