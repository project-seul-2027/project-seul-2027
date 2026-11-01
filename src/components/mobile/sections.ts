import type React from 'react';
import {
  Compass, CalendarDays, Map, Camera, WalletCards, Languages, Bookmark, ShieldAlert, Luggage, Wallet, Home, CloudSun,
  Plane, Coins, BookOpen, FileText, Users, History
} from 'lucide-react';

/**
 * Mappa unica delle sezioni per il telefono: da qui derivano barra in basso, foglio "Altro" e ricerca.
 * Ogni sezione appartiene a un gruppo d'uso e a una famiglia di colore.
 * Le classi sono scritte per intero perché Tailwind le trovi.
 */
export type SectionId =
  | 'today' | 'wallet' | 'show' | 'places' | 'sos' | 'itinerary' | 'accommodations' | 'map' | 'weather' | 'gallery'
  | 'packing' | 'expenses' | 'flights' | 'budget' | 'guide' | 'pdf' | 'group' | 'changelog';

export type SectionGroup = 'Viaggio' | 'Gruppo' | 'Strumenti' | 'Preparazione';

export interface SectionInfo {
  id: SectionId;
  label: string;
  /** Titolo breve nell'intestazione del telefono */
  title: string;
  icon: React.ElementType;
  group: SectionGroup | null;
  /** Colore della famiglia: icona */
  fg: string;
  /** Colore della famiglia: fondo tenue dell'icona */
  tile: string;
  /** Parole che la ricerca riconosce oltre al nome */
  keywords: string;
}

export const SECTIONS: SectionInfo[] = [
  { id: 'today', label: 'Oggi', title: 'Oggi', icon: Compass, group: null, fg: 'text-fam-today', tile: 'bg-fam-today/15', keywords: 'adesso ora programma oggi orologi fusi' },
  { id: 'itinerary', label: 'Itinerario', title: 'Itinerario', icon: CalendarDays, group: 'Viaggio', fg: 'text-fam-itinerary', tile: 'bg-fam-itinerary/15', keywords: 'programma calendario giorni tappe piano' },
  { id: 'accommodations', label: 'Alloggi', title: 'Alloggi', icon: Home, group: 'Viaggio', fg: 'text-fam-itinerary', tile: 'bg-fam-itinerary/15', keywords: 'hotel casa dormire alloggio airbnb indirizzo' },
  { id: 'flights', label: 'Voli e scalo', title: 'Voli e scalo', icon: Plane, group: 'Viaggio', fg: 'text-fam-flights', tile: 'bg-fam-flights/15', keywords: 'volo aereo aeroporto pechino scalo imbarco check-in malpensa incheon' },
  { id: 'map', label: 'Mappa', title: 'Mappa', icon: Map, group: 'Viaggio', fg: 'text-fam-tools', tile: 'bg-fam-tools/15', keywords: 'metro percorso strada navigazione portami gps linea' },
  { id: 'weather', label: 'Meteo', title: 'Meteo', icon: CloudSun, group: 'Viaggio', fg: 'text-fam-weather', tile: 'bg-fam-weather/15', keywords: 'tempo pioggia temperatura aria clima previsioni' },
  { id: 'expenses', label: 'Spese', title: 'Spese', icon: Wallet, group: 'Gruppo', fg: 'text-fam-money', tile: 'bg-fam-money/15', keywords: 'soldi budget saldo debiti conto pagare won euro cassa' },
  { id: 'gallery', label: 'Galleria', title: 'Galleria', icon: Camera, group: 'Gruppo', fg: 'text-fam-gallery', tile: 'bg-fam-gallery/15', keywords: 'foto video fotocamera immagini ricordi album' },
  { id: 'places', label: 'Luoghi', title: 'Luoghi', icon: Bookmark, group: 'Gruppo', fg: 'text-fam-places', tile: 'bg-fam-places/15', keywords: 'posti salvati wishlist ristoranti negozi da vedere' },
  { id: 'group', label: 'Gruppo adesso', title: 'Il gruppo', icon: Users, group: 'Gruppo', fg: 'text-fam-group', tile: 'bg-fam-group/15', keywords: 'partecipanti amici posizione ritrovo dove sono perso persone' },
  { id: 'show', label: 'In coreano', title: 'In coreano', icon: Languages, group: 'Strumenti', fg: 'text-fam-tools', tile: 'bg-fam-tools/15', keywords: 'traduci traduzione coreano frasi taxi allergie lingua hangul' },
  { id: 'wallet', label: 'Wallet', title: 'Wallet', icon: WalletCards, group: 'Strumenti', fg: 'text-fam-money', tile: 'bg-fam-money/15', keywords: 'biglietti carta imbarco tessere qr documenti t-money pass' },
  { id: 'sos', label: 'SOS', title: 'SOS', icon: ShieldAlert, group: 'Strumenti', fg: 'text-fam-sos', tile: 'bg-fam-sos/15', keywords: 'emergenza ambasciata polizia ospedale aiuto 112 119 assicurazione' },
  { id: 'guide', label: 'Guida', title: 'Guida', icon: BookOpen, group: 'Strumenti', fg: 'text-fam-tools', tile: 'bg-fam-tools/15', keywords: 'consigli guida pratica regole usanze sim internet mance' },
  { id: 'pdf', label: 'PDF', title: 'PDF', icon: FileText, group: 'Strumenti', fg: 'text-fam-tools', tile: 'bg-fam-tools/15', keywords: 'documento stampa itinerario pdf scarica' },
  { id: 'packing', label: 'Valigia', title: 'Valigia', icon: Luggage, group: 'Preparazione', fg: 'text-fam-prep', tile: 'bg-fam-prep/15', keywords: 'bagaglio checklist cosa portare lista' },
  { id: 'budget', label: 'Preventivo', title: 'Preventivo', icon: Coins, group: 'Preparazione', fg: 'text-fam-prep', tile: 'bg-fam-prep/15', keywords: 'costi stima prezzi budget quanto costa' },
  { id: 'changelog', label: 'Novità', title: 'Novità', icon: History, group: 'Preparazione', fg: 'text-fam-prep', tile: 'bg-fam-prep/15', keywords: 'changelog versione aggiornamenti novita' }
];

export const SECTION_GROUPS: SectionGroup[] = ['Viaggio', 'Gruppo', 'Strumenti', 'Preparazione'];

export const sectionById = (id: string): SectionInfo | undefined => SECTIONS.find((s) => s.id === id);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Ricerca immediata su nome, gruppo e parole chiave (anche parziali, senza accenti). */
export function searchSections(query: string): SectionInfo[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored = SECTIONS.map((s) => {
    const name = norm(s.label);
    const hay = `${name} ${norm(s.group ?? '')} ${norm(s.keywords)}`;
    if (!words.every((w) => hay.includes(w))) return null;
    const score = words.some((w) => name.startsWith(w)) ? 0 : words.some((w) => name.includes(w)) ? 1 : 2;
    return { s, score };
  }).filter((x): x is { s: SectionInfo; score: number } => !!x);
  return scored.sort((a, b) => a.score - b.score).map((x) => x.s);
}
