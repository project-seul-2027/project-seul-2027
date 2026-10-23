/**
 * Tipi per la lista oggetti / valigia personale e condivisa (Seul 2027)
 */

export type PackingCategory =
  | 'documents'      // Documenti, Passaporto, Carte, Assicurazione
  | 'clothing'       // Abbigliamento Seul (freddo marzo, strati, scarpe)
  | 'electronics'    // Elettronica, Adattatori Corea tipo C/F, Powerbank
  | 'health'         // Farmaci, Pronto soccorso, Cerotti & Kit medico
  | 'hygiene'        // Igiene & Cura personale, Burrocacao
  | 'flight'         // Bagaglio a mano & Scalo Pechino
  | 'misc';          // Accessori & Varie

export type PackingLocation = 'backpack' | 'cabin' | 'checked';

export interface LocationMeta {
  id: PackingLocation;
  label: string;
  shortLabel: string;
  iconEmoji: string;
  badgeColor: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const PACKING_LOCATIONS: LocationMeta[] = [
  {
    id: 'backpack',
    label: 'Zaino',
    shortLabel: 'Zaino',
    iconEmoji: '🎒',
    badgeColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Sotto il sedile in volo / sempre con te (documenti, power bank, oggetti di valore)'
  },
  {
    id: 'cabin',
    label: 'Valigia a mano',
    shortLabel: 'A mano',
    iconEmoji: '🧳',
    badgeColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    description: 'Cappelliera in cabina (cambio di emergenza, giacca, liquidi <100ml)'
  },
  {
    id: 'checked',
    label: 'Valigia a stiva',
    shortLabel: 'Stiva',
    iconEmoji: '✈️',
    badgeColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    description: 'Bagaglio da 23 kg spedito al check-in (vestiti pesanti, liquidi >100ml, scarpe)'
  }
];

export interface PackingItem {
  id: string;
  title: string;
  category: PackingCategory;
  location?: PackingLocation; // 'backpack' | 'cabin' | 'checked'
  packed: boolean;
  notes?: string;
  quantity?: number;
  isEssential?: boolean;
  reminderNote?: string;
  createdAt: number;
}

export interface PackingListDoc {
  ownerId: string;
  ownerName: string;
  ownerSlot?: string;
  updatedAt: number;
  sharedWith: string[]; // UID degli utenti con accesso in sola lettura
  items: PackingItem[];
}

export interface CategoryMeta {
  id: PackingCategory;
  label: string;
  iconName: string;
  color: string;
  bgLight: string;
}

export const PACKING_CATEGORIES: CategoryMeta[] = [
  { id: 'documents', label: 'Documenti & Soldi', iconName: 'FileCheck', color: 'text-amber-400', bgLight: 'bg-amber-500/10' },
  { id: 'clothing', label: 'Abbigliamento & Meteo Seul', iconName: 'Shirt', color: 'text-sky-400', bgLight: 'bg-sky-500/10' },
  { id: 'electronics', label: 'Elettronica & Adattatori', iconName: 'Cpu', color: 'text-cyan-400', bgLight: 'bg-cyan-500/10' },
  { id: 'health', label: 'Salute & Farmaci', iconName: 'HeartPulse', color: 'text-emerald-400', bgLight: 'bg-emerald-500/10' },
  { id: 'hygiene', label: 'Igiene & Cura Personale', iconName: 'Sparkles', color: 'text-pink-400', bgLight: 'bg-pink-500/10' },
  { id: 'flight', label: 'Bagaglio a Mano & Scalo', iconName: 'PlaneTakeoff', color: 'text-indigo-400', bgLight: 'bg-indigo-500/10' },
  { id: 'misc', label: 'Accessori & Varie', iconName: 'Package', color: 'text-purple-400', bgLight: 'bg-purple-500/10' },
];

/**
 * Oggetti essenziali preconfigurati specifici per il viaggio a Seul di marzo 2027
 */
export const SEOUL_ESSENTIAL_ITEMS: Omit<PackingItem, 'id' | 'createdAt'>[] = [
  {
    title: 'Passaporto originale (validità > 6 mesi da marzo 2027)',
    category: 'documents',
    location: 'backpack',
    packed: false,
    notes: 'Controllare data di scadenza (deve scadere dopo settembre 2027)',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Biglietti aerei Milano-Pechino-Seul (cartacei o PDF offline)',
    category: 'documents',
    location: 'backpack',
    packed: false,
    notes: 'Indispensabili anche per la visa-free transit 240h a Pechino',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Carta Revolut / Visa abilitata all\'estero & Won coreani',
    category: 'documents',
    location: 'backpack',
    packed: false,
    notes: 'Avvisare la banca o verificare che il circuito sia attivo in Asia',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Assicurazione sanitaria di viaggio (polizza & contatti emergenza)',
    category: 'documents',
    location: 'backpack',
    packed: false,
    notes: 'Salvare il numero di assistenza H24 nelle note dello smartphone',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Power Bank < 100Wh / 20.000mAh (SOLO nel bagaglio a mano!)',
    category: 'electronics',
    location: 'backpack',
    packed: false,
    notes: 'VIETATO in stiva dalle compagnie aeree (Air China compresa). Max 100Wh.',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Adattatore prese elettriche Corea tipo C / F',
    category: 'electronics',
    location: 'cabin',
    packed: false,
    notes: 'La Corea usa 220V 60Hz tipo C/F (come le bipasso italiane senza terra)',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Cavi di ricarica lunghi USB-C / Lightning + caricatore rapido',
    category: 'electronics',
    location: 'backpack',
    packed: false,
    notes: 'Utile un cavo lungo per l\'aeroporto e gli alloggi a Seul',
    quantity: 2,
    isEssential: false
  },
  {
    title: 'e-SIM dati Corea del Sud o prenotazione ritiro SIM/Pocket Wi-Fi',
    category: 'electronics',
    location: 'backpack',
    packed: false,
    notes: 'Attivare il profilo eSIM prima di salire sul volo o al gate',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Piumino caldo o giacca a vento a strati (Marzo fa 0°C - 12°C)',
    category: 'clothing',
    location: 'cabin',
    packed: false,
    notes: 'Seul a marzo ha un\'escursione termica notevole tra giorno e sera',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Maglie termiche / Pile leggeri per vestirsi a strati',
    category: 'clothing',
    location: 'checked',
    packed: false,
    notes: 'Ideali per camminare tutto il giorno senza appesantirsi',
    quantity: 3,
    isEssential: true
  },
  {
    title: 'Scarpe comodissime da camminata (facili da togliere)',
    category: 'clothing',
    location: 'checked',
    packed: false,
    notes: 'A Seul si cammina 15-20 km al giorno; spesso nei locali tradizionali ci si scalza',
    quantity: 2,
    isEssential: true
  },
  {
    title: 'Sciarpa / Scaldacollo & guanti sottili',
    category: 'clothing',
    location: 'cabin',
    packed: false,
    notes: 'Il vento gelido dal nord può farsi sentire soprattutto la sera lungo l\'Han',
    quantity: 1,
    isEssential: false
  },
  {
    title: 'Kit farmaci da viaggio (Tachipirina, fermenti lattici, antistaminico)',
    category: 'health',
    location: 'cabin',
    packed: false,
    notes: 'Tenere sempre con confezione originale e prescrizione medica se necessaria',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Cerotti per vesciche & disinfettante mani da viaggio (< 100ml)',
    category: 'health',
    location: 'backpack',
    packed: false,
    notes: 'Salva-giornata per le lunghe camminate a Bukchon e Gangnam',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Burrocacao & crema idratante viso/mani',
    category: 'hygiene',
    location: 'cabin',
    packed: false,
    notes: 'Il clima di Seul a inizio marzo è molto secco e disidrata rapidamente la pelle',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'Spazzolino, dentifricio da viaggio & pettine',
    category: 'hygiene',
    location: 'cabin',
    packed: false,
    notes: 'Molti hotel in Corea non forniscono più spazzolini usa-e-getta gratuiti per legge anti-spreco',
    quantity: 1,
    isEssential: false
  },
  {
    title: 'Cuscino gonfiabile cervicale per il volo lungo da 10h',
    category: 'flight',
    location: 'cabin',
    packed: false,
    notes: 'Consigliatissimo per riposare sul volo notturno Air China',
    quantity: 1,
    isEssential: false
  },
  {
    title: 'Tappi orecchie & mascherina per dormire in aereo',
    category: 'flight',
    location: 'cabin',
    packed: false,
    notes: 'Indispensabili per il volo Milano-Pechino e il fuso orario',
    quantity: 1,
    isEssential: false
  },
  {
    title: 'Penna per compilare i moduli di sbarco e dogana in volo',
    category: 'flight',
    location: 'backpack',
    packed: false,
    notes: 'Risparmia code e attese all\'arrivo all\'aeroporto di Incheon / Pechino',
    quantity: 1,
    isEssential: true
  },
  {
    title: 'App Naver Map, Kakao T & Google Traduttore scaricate sul telefono',
    category: 'misc',
    location: 'backpack',
    packed: false,
    notes: 'Google Maps ha funzioni a piedi limitate in Corea; Naver Map è l\'app ufficiale migliore',
    quantity: 1,
    isEssential: true
  }
];
