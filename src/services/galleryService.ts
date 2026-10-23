import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore';
import { firebase } from '../firebase/client';
import type { CommentDoc, PhotoDoc } from '../types/gallery';

/**
 * Galleria condivisa su Firestore (niente Firebase Storage: richiede il piano a pagamento).
 * Le foto sono salvate come JPEG ridimensionati in documenti Firestore (limite 1 MiB per documento):
 *   - `gallery/{id}`: metadati + miniatura, è ciò che si legge per riempire la griglia
 *   - `galleryImages/{id}`: foto grande, letta solo quando la si apre
 */

export const FULL_MAX_DIMENSION = 1600;
export const THUMB_MAX_DIMENSION = 480;
/** Dimensione massima del data URL della foto grande (limite regole: 900.000 caratteri) */
const FULL_MAX_CHARS = 760_000;
/** Dimensione massima del data URL della miniatura (limite regole: 150.000 caratteri) */
const THUMB_MAX_CHARS = 90_000;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export const COMMENT_MAX_LENGTH = 400;
export const CAPTION_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// Compressione lato client
// ---------------------------------------------------------------------------

export interface CompressedImage {
  full: string;
  thumb: string;
  width: number;
  height: number;
  originalSizeKb: number;
  compressedSizeKb: number;
  /** Percentuale di spazio risparmiato rispetto al file originale */
  compressionRatio: number;
}

async function loadSource(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // 'from-image' applica l'orientamento EXIF: le foto scattate in verticale col telefono restano dritte
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // formato non gestito da createImageBitmap: si prova con <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function renderJpeg(source: CanvasImageSource, srcW: number, srcH: number, maxDim: number, quality: number) {
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Il browser non riesce a elaborare l\'immagine.');
  // Sfondo bianco: i PNG trasparenti diventerebbero neri in JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}

/** Ridimensiona e comprime una foto in modo che stia in un documento Firestore. */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Il file scelto non è un\'immagine.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('La foto supera i 40 MB: scegline una più leggera.');

  let loaded;
  try {
    loaded = await loadSource(file);
  } catch {
    throw new Error('Impossibile leggere questa immagine. Prova con un JPEG o PNG.');
  }

  try {
    let maxDim = FULL_MAX_DIMENSION;
    let quality = 0.82;
    let full = renderJpeg(loaded.source, loaded.width, loaded.height, maxDim, quality);
    // Abbassa prima la qualità, poi la risoluzione, finché sta nel limite
    while (full.dataUrl.length > FULL_MAX_CHARS && maxDim > 640) {
      if (quality > 0.58) quality -= 0.08;
      else {
        maxDim = Math.round(maxDim * 0.85);
        quality = 0.74;
      }
      full = renderJpeg(loaded.source, loaded.width, loaded.height, maxDim, quality);
    }
    if (full.dataUrl.length > FULL_MAX_CHARS) throw new Error('Non riesco a comprimere abbastanza questa foto.');

    let thumbDim = THUMB_MAX_DIMENSION;
    let thumbQuality = 0.72;
    let thumb = renderJpeg(loaded.source, loaded.width, loaded.height, thumbDim, thumbQuality);
    while (thumb.dataUrl.length > THUMB_MAX_CHARS && thumbDim > 240) {
      thumbDim = Math.round(thumbDim * 0.85);
      thumbQuality = Math.max(0.55, thumbQuality - 0.05);
      thumb = renderJpeg(loaded.source, loaded.width, loaded.height, thumbDim, thumbQuality);
    }

    const originalSizeKb = Math.max(1, Math.round(file.size / 1024));
    const compressedSizeKb = Math.max(1, Math.round((full.dataUrl.length * 3) / 4 / 1024));
    return {
      full: full.dataUrl,
      thumb: thumb.dataUrl,
      width: full.width,
      height: full.height,
      originalSizeKb,
      compressedSizeKb,
      compressionRatio: Math.max(0, Math.round((1 - compressedSizeKb / originalSizeKb) * 100))
    };
  } finally {
    loaded.close();
  }
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

function toIso(value: unknown): string {
  const ts = value as Timestamp | null | undefined;
  return ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : new Date().toISOString();
}

function toPhoto(id: string, d: DocumentData): PhotoDoc {
  return {
    id,
    uploaderId: String(d.uploaderId ?? ''),
    caption: String(d.caption ?? ''),
    taggedSlots: Array.isArray(d.taggedSlots) ? d.taggedSlots.map(String) : [],
    locationName: String(d.locationName ?? ''),
    locationId: typeof d.locationId === 'string' ? d.locationId : undefined,
    dayNumber: typeof d.dayNumber === 'number' ? d.dayNumber : undefined,
    dayLabel: typeof d.dayLabel === 'string' ? d.dayLabel : undefined,
    thumb: typeof d.thumb === 'string' && d.thumb.startsWith('data:image/') ? d.thumb : '',
    width: Number(d.width) || 0,
    height: Number(d.height) || 0,
    originalSizeKb: Number(d.originalSizeKb) || 0,
    compressedSizeKb: Number(d.compressedSizeKb) || 0,
    likes: Array.isArray(d.likes) ? d.likes.map(String) : [],
    createdAt: toIso(d.createdAt)
  };
}

export interface PublishInput {
  uploaderId: string;
  image: CompressedImage;
  caption: string;
  taggedSlots: string[];
  locationName: string;
  locationId?: string;
  dayNumber?: number;
  dayLabel?: string;
}

/** Traduce gli errori Firestore in messaggi comprensibili. */
export function describeGalleryError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    return 'Operazione non consentita. Se è la prima volta, controlla di aver pubblicato le nuove regole Firestore (file firestore.rules).';
  }
  if (code === 'resource-exhausted') return 'Quota giornaliera di Firebase esaurita: riprova domani.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Connessione assente o instabile: riprova tra poco.';
  if (code === 'invalid-argument') return 'La foto è troppo grande per essere salvata. Scegline una più leggera.';
  return (err as Error)?.message || 'Errore imprevisto.';
}

export const galleryService = {
  /** Foto più recenti in tempo reale (con miniatura e like). */
  watchPhotos(max: number, onData: (photos: PhotoDoc[]) => void, onError: (err: Error) => void): () => void {
    const q = query(collection(firebase().db, 'gallery'), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => onData(snap.docs.map((d) => toPhoto(d.id, d.data({ serverTimestamps: 'estimate' })))),
      (err) => onError(err)
    );
  },

  /** Commenti in tempo reale (un solo ascolto per tutta la galleria). */
  watchComments(onData: (comments: CommentDoc[]) => void, onError: (err: Error) => void): () => void {
    const q = query(collection(firebase().db, 'galleryComments'), orderBy('createdAt', 'asc'), limit(1000));
    return onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              photoId: String(x.photoId ?? ''),
              authorId: String(x.authorId ?? ''),
              text: String(x.text ?? ''),
              createdAt: toIso(x.createdAt)
            };
          })
        ),
      (err) => onError(err)
    );
  },

  /** Foto a piena qualità (letta solo all'apertura). */
  async getFullImage(photoId: string): Promise<string> {
    const snap = await getDoc(doc(firebase().db, 'galleryImages', photoId));
    const data = snap.data()?.data;
    if (typeof data !== 'string' || !data.startsWith('data:image/')) throw new Error('Foto non disponibile.');
    return data;
  },

  /** Pubblica foto + miniatura in un'unica scrittura atomica. */
  async publish(input: PublishInput): Promise<string> {
    const { db } = firebase();
    const ref = doc(collection(db, 'gallery'));
    const meta: Record<string, unknown> = {
      uploaderId: input.uploaderId,
      caption: input.caption,
      taggedSlots: input.taggedSlots,
      locationName: input.locationName,
      thumb: input.image.thumb,
      width: input.image.width,
      height: input.image.height,
      originalSizeKb: input.image.originalSizeKb,
      compressedSizeKb: input.image.compressedSizeKb,
      likes: [input.uploaderId],
      createdAt: serverTimestamp()
    };
    if (input.locationId) meta.locationId = input.locationId;
    if (typeof input.dayNumber === 'number') meta.dayNumber = input.dayNumber;
    if (input.dayLabel) meta.dayLabel = input.dayLabel;

    const batch = writeBatch(db);
    batch.set(ref, meta);
    batch.set(doc(db, 'galleryImages', ref.id), {
      uploaderId: input.uploaderId,
      data: input.image.full
    });
    await batch.commit();
    return ref.id;
  },

  /** Aggiunge o toglie il proprio "mi piace" (le regole impediscono di toccare quelli degli altri). */
  async setLike(photoId: string, uid: string, liked: boolean): Promise<void> {
    const batch = writeBatch(firebase().db);
    batch.update(doc(firebase().db, 'gallery', photoId), { likes: liked ? arrayUnion(uid) : arrayRemove(uid) });
    await batch.commit();
  },

  async addComment(photoId: string, authorId: string, text: string): Promise<void> {
    const { db } = firebase();
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'galleryComments')), {
      photoId,
      authorId,
      text: text.trim().slice(0, COMMENT_MAX_LENGTH),
      createdAt: serverTimestamp()
    });
    await batch.commit();
  },

  async deleteComment(commentId: string): Promise<void> {
    const batch = writeBatch(firebase().db);
    batch.delete(doc(firebase().db, 'galleryComments', commentId));
    await batch.commit();
  },

  /** Elimina foto, miniatura e tutti i suoi commenti (solo l'autore: lo impongono le regole). */
  async deletePhoto(photoId: string, commentIds: string[]): Promise<void> {
    const { db } = firebase();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'gallery', photoId));
    batch.delete(doc(db, 'galleryImages', photoId));
    commentIds.slice(0, 400).forEach((id) => batch.delete(doc(db, 'galleryComments', id)));
    await batch.commit();
  }
};
