import { firebase, isFirebaseConfigured } from '../firebase/client';
import { decodeScaled } from './galleryService';
import type { ShowLang } from '../data/showLanguage';
import type { GroupDietProfile, MenuScanResult, ReceiptScanResult } from '../shared/visionScan';

/** Lato massimo inviato all'AI: 1400 px basta per leggere Hangul/Hanzi e cifre sugli scontrini restando leggero */
const SCAN_MAX_DIM = 1400;
const SCAN_QUALITY = 0.82;
const SCAN_TIMEOUT_MS = 28_000;

export class VisionScanError extends Error {}

/** Ridimensiona e comprime la foto in JPEG base64 (senza prefisso data URL) per inviarla al Worker */
async function prepareScanImage(file: File | Blob): Promise<{ imageBase64: string; mimeType: 'image/jpeg' }> {
  const decoded = await decodeScaled(file, SCAN_MAX_DIM);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new VisionScanError('Impossibile elaborare la foto su questo dispositivo.');
    ctx.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);
    let dataUrl = canvas.toDataURL('image/jpeg', SCAN_QUALITY);
    if (dataUrl.length > 1_400_000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.68);
    }
    const comma = dataUrl.indexOf(',');
    if (comma < 0) throw new VisionScanError('Impossibile codificare la foto.');
    return { imageBase64: dataUrl.slice(comma + 1), mimeType: 'image/jpeg' };
  } finally {
    decoded.close();
  }
}

function workerEndpoint(): string {
  const raw = import.meta.env.VITE_MAP_SEARCH_URL?.trim();
  if (!raw) throw new VisionScanError('Servizio di scansione non configurato in questa build (manca VITE_MAP_SEARCH_URL).');
  return `${raw.replace(/\/+$/, '')}/vision-scan`;
}

async function callVisionWorker<T>(payload: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new VisionScanError('Sei offline: la scansione con fotocamera richiede una connessione internet.');
  }
  if (!isFirebaseConfigured) {
    throw new VisionScanError('Accesso Firebase non disponibile.');
  }
  const user = firebase().auth.currentUser;
  if (!user) {
    throw new VisionScanError('Accedi prima con il tuo account Google.');
  }
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(workerEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS)
    });
  } catch (err) {
    if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError') {
      throw new VisionScanError('La scansione sta impiegando troppo tempo: controlla la rete e riprova.');
    }
    throw new VisionScanError('Connessione al servizio di scansione non riuscita.');
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    const code = detail?.error ?? '';
    if (response.status === 503 || code === 'vision-not-configured') {
      throw new VisionScanError('Scansione AI non ancora attivata sul server (manca il secret GEMINI_API_KEY nel Worker Cloudflare).');
    }
    if (response.status === 429) {
      throw new VisionScanError('Troppe scansioni ravvicinate: attendi qualche secondo e riprova.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new VisionScanError('Sessione scaduta o account non autorizzato: ricarica la pagina.');
    }
    if (response.status === 413) {
      throw new VisionScanError('Foto troppo grande: prova a scattarla un po’ più vicino.');
    }
    throw new VisionScanError('Impossibile leggere la foto: prova con una luce migliore o un’inquadratura più nitida.');
  }

  return (await response.json()) as T;
}

export async function scanMenuPhoto(
  file: File | Blob,
  lang: ShowLang,
  groupProfiles: GroupDietProfile[]
): Promise<MenuScanResult> {
  const { imageBase64, mimeType } = await prepareScanImage(file);
  return callVisionWorker<MenuScanResult>({
    kind: 'menu',
    lang,
    imageBase64,
    mimeType,
    groupProfiles
  });
}

export async function scanReceiptPhoto(
  file: File | Blob,
  defaultDate: string,
  currencyHint?: 'KRW' | 'CNY' | 'EUR'
): Promise<ReceiptScanResult> {
  const { imageBase64, mimeType } = await prepareScanImage(file);
  return callVisionWorker<ReceiptScanResult>({
    kind: 'receipt',
    defaultDate,
    currencyHint,
    imageBase64,
    mimeType
  });
}
