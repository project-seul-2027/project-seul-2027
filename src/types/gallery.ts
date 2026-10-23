/**
 * Galleria condivisa.
 *
 * Su Firestore ogni foto vive in tre posti (vedi firestore.rules):
 *   gallery/{id}          metadati + miniatura (data URL, ~30 KB) + like (elenco di uid)
 *   galleryImages/{id}    foto ridimensionata a piena qualità (data URL, < 900 KB), letta solo quando si apre la foto
 *   galleryComments/{id}  un documento per commento (photoId, authorId, testo)
 *
 * Nomi e avatar NON sono salvati nei documenti: si ricavano dall'uid con l'elenco dei partecipanti
 * (`useAuth().group`), così non si possono falsificare e restano aggiornati se qualcuno cambia nome.
 */

/** Documento `gallery/{id}` così com'è su Firestore (createdAt già convertito in ISO). */
export interface PhotoDoc {
  id: string;
  uploaderId: string;
  caption: string;
  /** Posti (t1…t4) dei partecipanti menzionati con @nome */
  taggedSlots: string[];
  locationName: string;
  locationId?: string;
  dayNumber?: number;
  dayLabel?: string;
  /** Miniatura JPEG come data URL */
  thumb: string;
  width: number;
  height: number;
  originalSizeKb: number;
  compressedSizeKb: number;
  /** uid di chi ha messo "mi piace" */
  likes: string[];
  createdAt: string;
}

/** Documento `galleryComments/{id}` */
export interface CommentDoc {
  id: string;
  photoId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface GalleryComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorSlotId?: string;
  text: string;
  createdAt: string;
}

/** Foto pronta per la grafica: documento + nomi risolti + commenti. */
export interface GalleryPhoto {
  id: string;
  thumbUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  dimensions: { width: number; height: number };
  uploaderId: string;
  uploaderName: string;
  uploaderAvatar?: string;
  uploaderSlotId?: string;
  caption: string;
  /** Nomi dei partecipanti menzionati (per ricerca e visualizzazione) */
  taggedUsers: string[];
  locationName: string;
  locationId?: string;
  dayNumber?: number;
  dayLabel?: string;
  createdAt: string;
  /** uid di chi ha messo "mi piace" */
  likes: string[];
  /** Nomi di chi ha messo "mi piace" */
  likeNames: string[];
  comments: GalleryComment[];
}
