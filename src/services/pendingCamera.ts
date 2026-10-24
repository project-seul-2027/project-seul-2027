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

export function hasResumeFlag(): boolean {
  try {
    return localStorage.getItem(RESUME_FLAG) === '1';
  } catch {
    return false;
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
