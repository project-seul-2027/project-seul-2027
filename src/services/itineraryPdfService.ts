import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { firebase } from '../firebase/client';
import { MAP_LOCATIONS } from '../data/tripData';
import { buildItineraryFromPdf, type DayReport } from '../utils/itineraryPdfParser';
import { extractPdfPages } from '../utils/pdfTextExtract';
import { builtInItinerary, isValidItinerary, type ItineraryOverrideDoc } from '../utils/itineraryOverride';

/** PDF dell'itinerario caricato dal Partecipante 1: sostituisce quello incluso nel sito, senza commit. */
export interface ItineraryPdf {
  name: string;
  size: number;
  updatedAt: number;
  /** Contenuto del file in base64 */
  data: string;
}

/** Limite di Firestore: un documento sta sotto 1 MiB, il base64 pesa circa un terzo in più. */
export const MAX_PDF_BYTES = 700_000;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const pdfRef = () => doc(firebase().db, 'appFiles', 'itineraryPdf');
const dataRef = () => doc(firebase().db, 'appFiles', 'itineraryData');

/** Limite del JSON dell'itinerario (stesso valore delle regole di Firestore) */
const MAX_JSON_CHARS = 600_000;

export interface UploadResult {
  /** Vero se il programma è stato aggiornato leggendo il PDF */
  analysed: boolean;
  report: DayReport[];
  warnings: string[];
}

export interface OverrideReport {
  report: DayReport[];
  warnings: string[];
}

/** Legge il PDF e ne ricava il nuovo programma. Non scrive nulla. */
async function analyse(bytes: Uint8Array): Promise<{ json: string; report: DayReport[]; warnings: string[] } | { reason: string; warnings: string[] }> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pages = await extractPdfPages(pdfjs as never, bytes);
    const built = buildItineraryFromPdf(pages, builtInItinerary(), MAP_LOCATIONS);
    if (!built.ok || !isValidItinerary(built.days)) return { reason: built.warnings[0] ?? 'Il PDF non ha la struttura attesa.', warnings: built.warnings };
    const json = JSON.stringify(built.days);
    if (json.length > MAX_JSON_CHARS) return { reason: 'Il programma letto è troppo grande per essere salvato.', warnings: built.warnings };
    return { json, report: built.report, warnings: built.warnings };
  } catch (e) {
    return { reason: e instanceof Error ? e.message : 'Lettura del PDF non riuscita.', warnings: [] };
  }
}

export const itineraryPdfService = {
  watch(callback: (pdf: ItineraryPdf | null) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(
      pdfRef(),
      (snap) => {
        const d = snap.data();
        callback(d && typeof d.data === 'string' ? (d as ItineraryPdf) : null);
      },
      (err) => onError?.(err)
    );
  },

  /** Itinerario letto dall'ultimo PDF. Un documento con json vuoto vale "nessun cambiamento". */
  watchOverride(callback: (doc: ItineraryOverrideDoc | null) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(
      dataRef(),
      (snap) => {
        const d = snap.data();
        callback(d && typeof d.json === 'string' && d.json !== '' ? (d as ItineraryOverrideDoc) : null);
      },
      (err) => onError?.(err)
    );
  },

  /** Riepilogo dell'ultima lettura, per il pannello PDF. */
  watchReport(callback: (r: OverrideReport | null) => void): () => void {
    return onSnapshot(
      dataRef(),
      (snap) => {
        try {
          const d = snap.data();
          callback(d && typeof d.report === 'string' ? (JSON.parse(d.report) as OverrideReport) : null);
        } catch {
          callback(null);
        }
      },
      () => callback(null)
    );
  },

  /** Carica il PDF e aggiorna il programma in un solo salvataggio: o cambia tutto o niente. */
  async upload(file: File): Promise<UploadResult> {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`Il file pesa ${Math.round(file.size / 1024)} KB: il limite è ${Math.round(MAX_PDF_BYTES / 1000)} KB. Comprimi il PDF e riprova.`);
    }
    const buf = await file.arrayBuffer();
    const head = String.fromCharCode(...new Uint8Array(buf.slice(0, 5)));
    if (head !== '%PDF-') throw new Error('Il file scelto non è un PDF.');

    const result = await analyse(new Uint8Array(buf.slice(0)));
    const now = Date.now();
    const batch = writeBatch(firebase().db);
    batch.set(pdfRef(), { name: file.name.slice(0, 120), size: file.size, updatedAt: now, data: toBase64(buf) });
    const ok = 'json' in result;
    const summary: OverrideReport = ok ? { report: result.report, warnings: result.warnings } : { report: [], warnings: [result.reason, ...result.warnings] };
    batch.set(dataRef(), { pdfUpdatedAt: now, updatedAt: now, json: ok ? result.json : '', report: JSON.stringify(summary) });
    await batch.commit();
    return { analysed: ok, report: summary.report, warnings: summary.warnings };
  },

  /** Torna al programma incluso nel sito, lasciando il PDF com'è. */
  async resetItinerary(): Promise<void> {
    const now = Date.now();
    const batch = writeBatch(firebase().db);
    batch.set(dataRef(), { pdfUpdatedAt: now, updatedAt: now, json: '', report: JSON.stringify({ report: [], warnings: ['Programma ripristinato a quello originale.'] }) });
    await batch.commit();
  }
};
