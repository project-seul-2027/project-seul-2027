// Foto scattata con la fotocamera del telefono, da conservare finché l'utente non la pubblica o la chiude.
// Quando il telefono torna dall'app Fotocamera, il browser può ricaricare la pagina e perdere lo stato
// di React: per questo la foto e il segnale "torna alla galleria" vengono salvati nel browser.
// Tutto è opzionale: se il browser non lo permette, l'app funziona come prima (senza ripristino).

const DB_NAME = 'seul2027-local';
const STORE = 'kv';
const KEY = 'pending-camera-photo';
const RESUME_FLAG = 'seul2027_pending_camera';

export interface PendingCameraPhoto {
  file: File;
  accepted: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Foto condivisa dal telefono verso l'app ("Condividi → Seul 2027"): la salva il service worker, qui si ritira (una sola volta). */
export async function takeSharedPhoto(): Promise<File | null> {
  try {
    const record = await withStore<Blob | File | undefined>('readonly', (s) => s.get('shared-photo'));
    if (!record) return null;
    await withStore('readwrite', (s) => s.delete('shared-photo')).catch(() => undefined);
    return record instanceof File ? record : new File([record], `foto-${Date.now()}.jpg`, { type: record.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

export function hasResumeFlag(): boolean {
  try {
    return localStorage.getItem(RESUME_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Da chiamare subito prima di aprire la fotocamera di sistema: se l'app viene chiusa, si riapre sulla galleria. */
export function setResumeFlag(): void {
  try {
    localStorage.setItem(RESUME_FLAG, '1');
  } catch {
    /* ignora */
  }
}

export async function savePendingCamera(file: File, accepted: boolean): Promise<void> {
  try {
    localStorage.setItem(RESUME_FLAG, '1');
  } catch {
    /* modalità privata: nessun ripristino */
  }
  try {
    await withStore('readwrite', (s) => s.put({ file, accepted }, KEY));
  } catch {
    /* ignora: la foto resta comunque nel modal finché l'app è aperta */
  }
}

export async function markPendingAccepted(): Promise<void> {
  const current = await loadPendingCamera();
  if (current) await savePendingCamera(current.file, true);
}

export async function loadPendingCamera(): Promise<PendingCameraPhoto | null> {
  try {
    const record = await withStore<PendingCameraPhoto | undefined>('readonly', (s) => s.get(KEY));
    return record && record.file ? record : null;
  } catch {
    return null;
  }
}

export async function clearPendingCamera(): Promise<void> {
  try {
    localStorage.removeItem(RESUME_FLAG);
  } catch {
    /* ignora */
  }
  try {
    await withStore('readwrite', (s) => s.delete(KEY));
  } catch {
    /* ignora */
  }
}
