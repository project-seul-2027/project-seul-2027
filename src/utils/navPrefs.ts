import { useCallback, useState } from 'react';

/**
 * Le 4 schede della barra in basso sul telefono si possono scegliere.
 * La scelta resta su questo telefono (localStorage).
 */
const KEY = 'seul2027:nav';
export const NAV_SLOTS = 4;

export const NAV_DEFAULT = ['today', 'itinerary', 'map', 'gallery'];

export const NAV_PRESETS: { id: string; label: string; hint: string; tabs: string[] }[] = [
  { id: 'default', label: 'Standard', hint: 'Oggi, Itinerario, Mappa, Galleria', tabs: NAV_DEFAULT },
  { id: 'prep', label: 'Preparazione', hint: 'Valigia, Alloggi, Voli, Preventivo', tabs: ['packing', 'accommodations', 'flights', 'budget'] },
  { id: 'trip', label: 'In viaggio', hint: 'Oggi, Mappa, Spese, In coreano', tabs: ['today', 'map', 'expenses', 'show'] }
];

function read(): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

/** Le schede scelte (solo quelle che esistono ancora), oppure quelle standard */
export function resolveNav(saved: string[] | null, valid: string[]): string[] {
  const picked = (saved ?? []).filter((id, i, a) => valid.includes(id) && a.indexOf(id) === i).slice(0, NAV_SLOTS);
  return picked.length === NAV_SLOTS ? picked : NAV_DEFAULT.filter((id) => valid.includes(id));
}

export function useNavPrefs(valid: string[]) {
  const [saved, setSaved] = useState<string[] | null>(read);
  const save = useCallback((ids: string[] | null) => {
    setSaved(ids);
    try {
      if (ids) localStorage.setItem(KEY, JSON.stringify(ids));
      else localStorage.removeItem(KEY);
    } catch {
      /* archiviazione bloccata */
    }
  }, []);
  return { primaryIds: resolveNav(saved, valid), custom: !!saved, save };
}
