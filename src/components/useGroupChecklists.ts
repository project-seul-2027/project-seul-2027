import { useCallback, useEffect, useState } from 'react';
import { isFirebaseConfigured } from '../firebase/client';
import { statusService } from '../services/statusService';
import type { ChecklistKey, GroupChecklists } from '../shared/tripChecklist';

/** Checklist di tutto il gruppo (tempo reale) + funzione per spuntare le proprie caselle. */
export function useGroupChecklists(myUid: string | undefined) {
  const [all, setAll] = useState<GroupChecklists>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return statusService.watch(setAll, (err) => console.warn('Checklist non disponibile:', err));
  }, []);

  const toggle = useCallback(
    async (key: ChecklistKey) => {
      if (!myUid) return;
      setError(null);
      try {
        await statusService.setItem(myUid, key, !(all[myUid]?.[key] === true));
      } catch (err) {
        console.warn('Salvataggio checklist non riuscito:', err);
        setError('Non sono riuscito a salvare. Controlla la connessione e riprova.');
      }
    },
    [myUid, all]
  );

  return { all, toggle, error };
}
