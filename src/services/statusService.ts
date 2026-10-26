import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase } from '../firebase/client';
import type { ChecklistKey, ChecklistState, GroupChecklists } from '../shared/tripChecklist';

/** Checklist dei preparativi: statuses/{uid} = { checklist: { chiave: true|false }, updatedAt } */
export const statusService = {
  /** Tutte le checklist del gruppo, in tempo reale */
  watch(callback: (all: GroupChecklists) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(
      collection(firebase().db, 'statuses'),
      (snap) => {
        const all: GroupChecklists = {};
        snap.forEach((d) => {
          all[d.id] = ((d.data() as { checklist?: ChecklistState }).checklist ?? {}) as ChecklistState;
        });
        callback(all);
      },
      (err) => onError?.(err)
    );
  },

  /** Spunta o toglie una casella della propria checklist (le altre restano com'erano) */
  async setItem(uid: string, key: ChecklistKey, done: boolean): Promise<void> {
    await setDoc(
      doc(firebase().db, 'statuses', uid),
      { checklist: { [key]: done }, updatedAt: Date.now() },
      { merge: true }
    );
  }
};
