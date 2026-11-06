import { CATEGORY_ICON_INNER } from './categoryIcons';

/** Colori ed emoji delle categorie di tappe (segnaposto sulla mappa e schede della versione mobile). */
export const CATEGORY_STYLE: Record<string, { badge: string; ring: string; icon: string }> = {
  alloggio: { badge: '#3b82f6', ring: 'rgba(59, 130, 246, 0.6)', icon: CATEGORY_ICON_INNER.alloggio },
  nightlife: { badge: '#ec4899', ring: 'rgba(236, 72, 153, 0.5)', icon: CATEGORY_ICON_INNER.nightlife },
  food: { badge: '#f59e0b', ring: 'rgba(245, 158, 11, 0.5)', icon: CATEGORY_ICON_INNER.food },
  cultura: { badge: '#8b5cf6', ring: 'rgba(139, 92, 246, 0.5)', icon: CATEGORY_ICON_INNER.cultura },
  natura: { badge: '#10b981', ring: 'rgba(16, 185, 129, 0.5)', icon: CATEGORY_ICON_INNER.natura },
  gita: { badge: '#0ea5e9', ring: 'rgba(14, 165, 133, 0.5)', icon: CATEGORY_ICON_INNER.gita },
  logistica: { badge: '#94a3b8', ring: 'rgba(148, 163, 184, 0.4)', icon: CATEGORY_ICON_INNER.logistica },
  luogo: { badge: '#7c3aed', ring: 'rgba(124, 58, 237, 0.5)', icon: CATEGORY_ICON_INNER.luogo }
};

export const CATEGORY_LABEL: Record<string, string> = {
  alloggio: 'Alloggio',
  nightlife: 'Nightlife',
  food: 'Food & mercati',
  cultura: 'Cultura',
  natura: 'Parchi & hike',
  gita: 'Gita fuori porta',
  logistica: 'Logistica',
  luogo: 'Luoghi aggiunti'
};

/** Etichetta della partenza: alloggi con il codice, GPS e qualsiasi altro punto con il nome. */
export function originLabel(loc: { id: string; italianName: string; category: string; accommodationCode?: string }): string {
  if (loc.id === 'gps_origin') return loc.italianName;
  if (loc.category === 'alloggio' && loc.accommodationCode) return `Alloggio ${loc.accommodationCode}`;
  return loc.italianName;
}
