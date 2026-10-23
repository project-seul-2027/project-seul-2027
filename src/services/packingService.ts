import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe
} from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { PackingItem, PackingListDoc } from '../types/packing';
import { SEOUL_ESSENTIAL_ITEMS } from '../types/packing';

const STORAGE_PREFIX = 'seoul2027_packing_';

export type PackingSyncStatus = 'cloud' | 'local';

export const PACKING_LIMITS = { title: 120, notes: 300, maxItems: 300, maxQuantity: 99 };

/** Messaggio leggibile per un errore di salvataggio/lettura Firestore. */
export function describePackingError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    return 'Operazione non consentita: controlla di aver pubblicato le ultime regole Firestore (file firestore.rules).';
  }
  if (code === 'resource-exhausted') return 'Quota giornaliera di Firebase esaurita: riprova domani.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Connessione assente: riproverò appena torna la rete.';
  if (code === 'invalid-argument') return 'La lista contiene dati non validi o è troppo grande.';
  return (err as Error)?.message || 'Errore imprevisto.';
}

/**
 * Prepara la lista per Firestore: toglie i campi `undefined` (Firestore li rifiuta, ad esempio una nota vuota),
 * limita le lunghezze e non permette di condividere con se stessi.
 */
function sanitizeList(list: PackingListDoc): PackingListDoc {
  const items = list.items.slice(0, PACKING_LIMITS.maxItems).map((i) => {
    const qty = Number.isFinite(i.quantity) ? Math.min(PACKING_LIMITS.maxQuantity, Math.max(1, Math.round(i.quantity as number))) : 1;
    return {
      ...i,
      title: i.title.slice(0, PACKING_LIMITS.title),
      notes: i.notes ? i.notes.slice(0, PACKING_LIMITS.notes) : undefined,
      quantity: qty
    };
  });
  const clean: PackingListDoc = {
    ...list,
    sharedWith: Array.from(new Set(list.sharedWith)).filter((id) => id !== list.ownerId),
    items
  };
  // JSON elimina le proprietà `undefined`
  return JSON.parse(JSON.stringify(clean)) as PackingListDoc;
}

function getLocalList(userId: string): PackingListDoc | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalList(userId: string, data: PackingListDoc) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore quota issues
  }
}

type SaveErrorListener = (err: unknown) => void;
const saveErrorListeners = new Set<SaveErrorListener>();
const SERVER_WAIT_MS = 4000;

export const packingService = {
  /** Errori di salvataggio arrivati dopo che `saveList` era già tornata (es. regole rifiutate dopo un periodo offline). */
  onSaveError(listener: SaveErrorListener): () => void {
    saveErrorListeners.add(listener);
    return () => saveErrorListeners.delete(listener);
  },

  /**
   * Ascolta in tempo reale la lista valigia dell'utente (un documento per persona: `packingLists/{uid}`).
   * La copia locale serve per mostrare subito la lista e per non perdere modifiche fatte senza rete
   * o prima che le regole Firestore fossero pubblicate: se è più recente di quella nel cloud, viene caricata.
   */
  subscribeToMyList(
    userId: string,
    userName: string,
    userSlot: string | undefined,
    onUpdate: (doc: PackingListDoc) => void,
    onError?: (err: Error) => void,
    onStatus?: (status: PackingSyncStatus) => void
  ): Unsubscribe {
    const cached = getLocalList(userId);
    const emptyList = (): PackingListDoc => ({
      ownerId: userId,
      ownerName: userName,
      ownerSlot: userSlot,
      updatedAt: 0,
      sharedWith: [],
      items: []
    });
    onUpdate(cached ?? emptyList());

    if (!isFirebaseConfigured) {
      onStatus?.('local');
      return () => {};
    }

    try {
      const { db } = firebase();
      const docRef = doc(db, 'packingLists', userId);

      return onSnapshot(
        docRef,
        (snap) => {
          // Dati ancora provenienti solo dalla cache del browser: non dicono nulla sul cloud
          if (snap.metadata.fromCache && !snap.exists()) {
            onStatus?.('local');
            return;
          }
          const local = getLocalList(userId);
          const confirmed = !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;

          if (!snap.exists()) {
            // Prima volta sul cloud: carica la lista locale (se c'è) oppure una lista vuota
            const initial = local ?? emptyList();
            setDoc(doc(db, 'packingLists', userId), sanitizeList({ ...initial, updatedAt: Date.now() })).catch((err) => {
              onStatus?.('local');
              onError?.(err as Error);
            });
            return;
          }

          const data = snap.data() as PackingListDoc;
          if (confirmed && local && local.updatedAt > (data.updatedAt ?? 0)) {
            // Modifiche fatte qui e mai arrivate nel cloud (offline o regole mancanti): le carica ora
            onUpdate(local);
            packingService.saveList(local).then(
              () => onStatus?.('cloud'),
              (err) => {
                onStatus?.('local');
                onError?.(err as Error);
              }
            );
            return;
          }

          setLocalList(userId, data);
          onUpdate(data);
          if (!snap.metadata.fromCache) onStatus?.('cloud');
        },
        (error) => {
          console.warn('Errore lettura lista valigia Firestore:', error);
          onStatus?.('local');
          if (onError) onError(error);
        }
      );
    } catch (err) {
      console.warn('Firebase non disponibile per lista valigia, fallback locale attivo:', err);
      onStatus?.('local');
      return () => {};
    }
  },

  /**
   * Ascolta le liste di altri partecipanti che hanno condiviso la loro valigia con l'utente corrente.
   */
  subscribeToSharedLists(
    myUserId: string,
    onUpdate: (lists: PackingListDoc[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured) {
      onUpdate([]);
      return () => {};
    }

    try {
      const { db } = firebase();
      const q = query(
        collection(db, 'packingLists'),
        where('sharedWith', 'array-contains', myUserId)
      );

      return onSnapshot(
        q,
        (snap) => {
          const docs: PackingListDoc[] = [];
          snap.forEach((d) => {
            if (d.id !== myUserId) {
              docs.push(d.data() as PackingListDoc);
            }
          });
          onUpdate(docs);
        },
        (error) => {
          console.warn('Errore lettura liste condivise:', error);
          if (onError) onError(error);
        }
      );
    } catch (err) {
      console.warn('Firebase non disponibile per liste condivise:', err);
      onUpdate([]);
      return () => {};
    }
  },

  /**
   * Salva la lista aggiornata su Firestore e nella cache locale.
   */
  async saveList(list: PackingListDoc): Promise<void> {
    const cleanList = sanitizeList({
      ...list,
      updatedAt: Date.now()
    });

    // Cache locale immediata per reattività istantanea
    setLocalList(cleanList.ownerId, cleanList);

    if (!isFirebaseConfigured) return;

    try {
      const { db } = firebase();
      const docRef = doc(db, 'packingLists', cleanList.ownerId);
      // Senza rete la conferma del server non arriva: la scrittura resta in coda e si completa da sola.
      // Si aspetta solo un attimo, poi l'interfaccia prosegue (la lista è già salvata in locale).
      const write = setDoc(docRef, cleanList, { merge: true });
      const outcome = await Promise.race([
        write.then(() => 'done' as const),
        new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), SERVER_WAIT_MS))
      ]);
      if (outcome === 'pending') {
        write.catch((err) => saveErrorListeners.forEach((fn) => fn(err)));
      }
    } catch (err) {
      console.error('Errore salvataggio lista su Firestore:', err);
      throw err;
    }
  },

  /**
   * Aggiunge tutti gli oggetti essenziali raccomandati per Seul (evitando duplicati).
   */
  async addSeoulEssentials(currentList: PackingListDoc): Promise<PackingListDoc> {
    const existingTitles = new Set(
      currentList.items.map((i) => i.title.toLowerCase().trim())
    );

    const newItems: PackingItem[] = SEOUL_ESSENTIAL_ITEMS.filter(
      (item) => !existingTitles.has(item.title.toLowerCase().trim())
    ).map((item) => ({
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now()
    }));

    const updated: PackingListDoc = {
      ...currentList,
      items: [...currentList.items, ...newItems],
      updatedAt: Date.now()
    };

    await this.saveList(updated);
    return updated;
  },

  /**
   * Formatta la lista come testo leggibile per clipboard o condivisione.
   */
  formatListForSharing(list: PackingListDoc): string {
    const packedCount = list.items.filter((i) => i.packed).length;
    const total = list.items.length;
    let out = `🎒 Valigia Seul 2027 · ${list.ownerName}\n`;
    out += `Progresso: ${packedCount}/${total} oggetti preparati\n\n`;

    const byCategory: { [cat: string]: PackingItem[] } = {};
    for (const item of list.items) {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    }

    const categoryNames: { [k: string]: string } = {
      documents: '📄 DOCUMENTI & SOLDI',
      clothing: '👕 ABBIGLIAMENTO & METEO',
      electronics: '🔌 ELETTRONICA & ADATTATORI',
      health: '💊 SALUTE & FARMACI',
      hygiene: '✨ IGIENE & CURA',
      flight: '✈️ BAGAGLIO A MANO & SCALO',
      misc: '📦 ACCESSORI & VARIE'
    };

    for (const [catKey, items] of Object.entries(byCategory)) {
      out += `${categoryNames[catKey] || catKey.toUpperCase()}:\n`;
      for (const item of items) {
        const check = item.packed ? '✅' : '⬜';
        const qty = item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : '';
        const locTag =
          item.location === 'backpack'
            ? ' [🎒 Zaino]'
            : item.location === 'cabin'
            ? ' [🧳 A mano]'
            : item.location === 'checked'
            ? ' [✈️ Stiva]'
            : '';
        const notes = item.notes ? ` — ${item.notes}` : '';
        out += `${check} ${item.title}${qty}${locTag}${notes}\n`;
      }
      out += '\n';
    }

    out += '🇰🇷 Viaggio Seul 2027 (2-19 Marzo)';
    return out;
  },

  /**
   * Condividi tramite Web Share API nativa (iOS Safari, Android Chrome, ecc.)
   */
  async shareNative(list: PackingListDoc): Promise<boolean> {
    const text = this.formatListForSharing(list);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Valigia Seul 2027 · ${list.ownerName}`,
          text
        });
        return true;
      } catch (err: unknown) {
        // Se l'utente annulla la condivisione, non lanciamo errore
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Errore Web Share:', err);
        }
      }
    }
    // Fallback: copia negli appunti
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // appunti non disponibili (browser vecchio o permesso negato)
    }
    return false;
  },

  /**
   * Genera e scarica un file iCalendar (.ics) per impostare un promemoria valigia
   * su Apple Calendar / Google Calendar per il 28 Febbraio 2027 (giorno pre-partenza).
   */
  downloadIcsReminder(list: PackingListDoc) {
    const uncompleted = list.items.filter((i) => !i.packed);
    const summary = `🎒 Controllo finale valigia Seul 2027 (${list.ownerName})`;
    const description = `Ricordati di verificare gli oggetti mancanti prima di partire per Malpensa:\n\n${uncompleted
      .map((i) => `- ${i.title}${i.notes ? ` (${i.notes})` : ''}`)
      .join('\n')}\n\nVolo Air China da Malpensa: 1 marzo ore 12:30.`;

    // RFC 5545: i testi vanno "escapati" e le righe lunghe spezzate a 75 byte
    const esc = (t: string) =>
      t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const fold = (line: string) => {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const bytes = enc.encode(line);
      if (bytes.length <= 75) return line;
      const parts: string[] = [];
      let i = 0;
      let limit = 75;
      while (i < bytes.length) {
        let end = Math.min(i + limit, bytes.length);
        // non spezzare un carattere UTF-8 a metà
        while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
        parts.push(dec.decode(bytes.slice(i, end)));
        i = end;
        limit = 74;
      }
      return parts.join('\r\n ');
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Seul 2027//Valigia e Checklist//IT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:seoul2027-packing-${Date.now()}@seul2027.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      'DTSTART:20270228T160000Z',
      'DTEND:20270228T173000Z',
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(description)}`,
      'LOCATION:Casa - Preparazione Bagaglio',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'DESCRIPTION:Promemoria controllo valigia Seul',
      'ACTION:DISPLAY',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'DESCRIPTION:Sveglia controllo finale passaporto e zaino Seul',
      'ACTION:DISPLAY',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ]
      .map(fold)
      .join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Promemoria_Valigia_Seul_2027_${list.ownerSlot || 'viaggio'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Crea link di apertura diretta per Google Keep con il testo pre-compilato.
   */
  openGoogleKeep(list: PackingListDoc) {
    const text = this.formatListForSharing(list);
    // Copia anche negli appunti per sicurezza
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const keepUrl = `https://keep.google.com/#create?title=${encodeURIComponent(
      `Valigia Seul 2027 · ${list.ownerName}`
    )}&text=${encodeURIComponent(text)}`;
    window.open(keepUrl, '_blank');
  }
};
