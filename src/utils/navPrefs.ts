import { useCallback, useState } from 'react';

/**
 * Le 3 schede della barra in basso sul telefono si possono scegliere
 * (intorno al pulsante + centrale; "Altro" è sempre l'ultima).
 * La scelta resta su questo telefono (localStorage).
 */
const KEY = 'seul2027:nav';
export const NAV_SLOTS = 3;

export const NAV_DEFAULT = ['today', 'itinerary', 'map'];

export const NAV_PRESETS: { id: string; label: string; hint: string; tabs: string[] }[] = [
  { id: 'default', label: 'Standard', hint: 'Oggi, Itinerario, Mappa', tabs: NAV_DEFAULT },
  { id: 'group', label: 'Con il gruppo', hint: 'Oggi, Gruppo adesso, Mappa', tabs: ['today', 'group', 'map'] },
  { id: 'prep', label: 'Preparazione', hint: 'Valigia, Voli, Preventivo', tabs: ['packing', 'flights', 'budget'] }
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
