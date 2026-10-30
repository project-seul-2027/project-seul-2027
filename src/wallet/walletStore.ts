/**
 * Archivio del Wallet: IndexedDB sul telefono (voci + allegati). Niente va su internet:
 * funziona anche offline e i documenti non passano da nessun server.
 * Chi cambia telefono usa "Esporta copia" / "Importa copia".
 */
import type { WalletItem, WalletFileMeta } from './walletData';
import { newId } from './walletData';

const DB_NAME = 'seul2027-wallet';
const DB_VERSION = 1;
const ITEMS = 'items';
const FILES = 'files';
/** Scheda da aprire appena si entra nel Wallet (impostata da "Oggi") */
export const WALLET_OPEN_KEY = 'seul2027:wallet:open';
export const WALLET_EVENT = 'seul2027:wallet';
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_FILES_PER_ITEM = 6;

interface StoredFile {
  id: string;
  itemId: string;
  name: string;
  type: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Questo browser non può salvare i documenti sul telefono.'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' }).createIndex('itemId', 'itemId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Archivio non disponibile'));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Salvataggio non riuscito'));
    tx.onabort = () => reject(tx.error ?? new Error('Salvataggio non riuscito'));
  });

const request = <T,>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const notify = () => window.dispatchEvent(new Event(WALLET_EVENT));

export async function listItems(ownerId: string): Promise<WalletItem[]> {
  const db = await openDb();
  const all = await request(db.transaction(ITEMS).objectStore(ITEMS).getAll() as IDBRequest<WalletItem[]>);
  return all.filter((i) => i.ownerId === ownerId);
}

/** Salva una voce e i suoi nuovi allegati; `removedFileIds` elimina gli allegati tolti. */
export async function saveItem(item: WalletItem, newFiles: { file: Blob; meta: WalletFileMeta }[] = [], removedFileIds: string[] = []): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([ITEMS, FILES], 'readwrite');
  const files = tx.objectStore(FILES);
  removedFileIds.forEach((id) => files.delete(id));
  newFiles.forEach(({ file, meta }) => {
    const row: StoredFile = { id: meta.id, itemId: item.id, name: meta.name, type: meta.type, blob: file };
    files.put(row);
  });
  tx.objectStore(ITEMS).put(item);
  await done(tx);
  notify();
}

export async function deleteItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([ITEMS, FILES], 'readwrite');
  tx.objectStore(ITEMS).delete(id);
  const idx = tx.objectStore(FILES).index('itemId');
  const keys = await request(idx.getAllKeys(id));
  keys.forEach((k) => tx.objectStore(FILES).delete(k));
  await done(tx);
  notify();
}

export async function getFileBlob(fileId: string): Promise<Blob | null> {
  const db = await openDb();
  const row = await request(db.transaction(FILES).objectStore(FILES).get(fileId) as IDBRequest<StoredFile | undefined>);
  return row?.blob ?? null;
}

export async function totalBytes(ownerId: string): Promise<number> {
  const items = await listItems(ownerId);
  return items.reduce((s, i) => s + i.files.reduce((a, f) => a + f.size, 0), 0);
}

/** Riduce le foto (max 1800 px) per risparmiare spazio; i PDF restano come sono. */
export async function prepareFile(file: File): Promise<{ file: Blob; meta: WalletFileMeta }> {
  const id = newId();
  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
      if (blob) return { file: blob, meta: { id, name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', size: blob.size } };
    } catch {
      /* formato non leggibile dal browser: lo tengo com'è */
    }
  }
  if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” è troppo grande (massimo 8 MB).`);
  return { file, meta: { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size } };
}

/* ---------- Copia di sicurezza ---------- */

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

export async function exportBackup(ownerId: string): Promise<Blob> {
  const items = await listItems(ownerId);
  const files: Record<string, string> = {};
  for (const item of items) {
    for (const f of item.files) {
      const blob = await getFileBlob(f.id);
      if (blob) files[f.id] = await blobToDataUrl(blob);
    }
  }
  return new Blob([JSON.stringify({ app: 'seul2027-wallet', version: 1, exportedAt: new Date().toISOString(), items, files })], { type: 'application/json' });
}

export async function importBackup(ownerId: string, file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as { app?: string; items?: WalletItem[]; files?: Record<string, string> };
  if (data.app !== 'seul2027-wallet' || !Array.isArray(data.items)) throw new Error('Questo file non è una copia del Wallet.');
  let n = 0;
  for (const raw of data.items) {
    const item: WalletItem = { ...raw, ownerId, extra: raw.extra ?? [], files: raw.files ?? [] };
    const blobs: { file: Blob; meta: WalletFileMeta }[] = [];
    for (const meta of item.files) {
      const url = data.files?.[meta.id];
      if (url) blobs.push({ file: await (await fetch(url)).blob(), meta });
    }
    item.files = blobs.map((b) => b.meta);
    await saveItem(item, blobs);
    n += 1;
  }
  return n;
}

/* ---------- Blocco con PIN ---------- */

const LOCK_KEY = 'seul2027:wallet:lock';
interface LockRecord {
  salt: string;
  hash: string;
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150_000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(LOCK_KEY);
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const rec: LockRecord = { salt, hash: await hashPin(pin, salt) };
  localStorage.setItem(LOCK_KEY, JSON.stringify(rec));
}

export async function checkPin(pin: string): Promise<boolean> {
  try {
    const rec = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null') as LockRecord | null;
    if (!rec) return true;
    return (await hashPin(pin, rec.salt)) === rec.hash;
  } catch {
    return false;
  }
}

export function clearPin(): void {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* archiviazione bloccata */
  }
}
