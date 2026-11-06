/**
 * Dati ufficiali del viaggio di gruppo a Seul 2027 (2 - 19 Marzo 2027)
 * Basati sul documento di viaggio aggiornato "Itinerario Seul 2027" per 4 persone.
 */

export interface ScheduleItem {
  time: string;
  /** Riassunto breve mostrato in Oggi: cosa succede e cosa fare */
  summary?: string;
  activity: string;
  notes?: string;
  isHighlight?: boolean;
}

export interface ItineraryDay {
  id: number;
  dateStr: string;
  dayOfWeek: string;
  phase: 'Partenza' | 'Prima settimana' | 'Seconda settimana' | 'Ultima parte';
  title: string;
  subtitle: string;
  description: string;
  schedule?: ScheduleItem[];
  bulletPoints: string[];
  costsEstimate?: string;
  locationIds: string[];
  tags: string[];
  tips?: string[];
  isSpecialEvent?: boolean;
}

export interface AccommodationOption {
  id: string;
  code: 'A' | 'B' | 'C' | 'D';
  name: string;
  adTitle: string;
  district: string;
  lat: number;
  lng: number;
  monthlyKrw: number;
  totalEur17Nights: number;
  /** Calcolati da totalEur17Nights (vedi ACCOMMODATIONS) */
  nightlyRateEur: number;
  pietroCost8Nights: number;
  other3Cost17Nights: number;
  costPerPerson4: number;
  costPerPerson3: number;
  typeDescription: string;
  metroWalk: string;
  airportTransit: string;
  hongdaeTransit: string;
  nearbyAttractions: string;
  pro: string[];
  contro: string[];
  highlightBadge: string;
  highlightBadgeColor: string;
  importantNotes: string;
}

export interface MapLocation {
  id: string;
  name: string;
  italianName: string;
  koreanName?: string;
  district: string;
  city: 'Seul' | 'Dintorni / Gite' | 'Pechino' | 'Milano';
  category: 'alloggio' | 'cultura' | 'nightlife' | 'food' | 'natura' | 'gita' | 'logistica' | 'luogo';
  lat: number;
  lng: number;
  dayNumbers: number[];
  description: string;
  tips?: string;
  mustTry?: string;
  accommodationCode?: 'A' | 'B' | 'C' | 'D';
}

export interface FlightLeg {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  departureAirport: string;
  departureAirportCode: string;
  departureTerminal: string;
  departureTime: string;
  departureDate: string;
  arrivalAirport: string;
  arrivalAirportCode: string;
  arrivalTerminal: string;
  arrivalTime: string;
  arrivalDate: string;
  duration: string;
  layoverNotice?: string;
  baggageInfo: string;
  notes: string[];
}

export interface ExpenseItem {
  id: string;
  title: string;
  category: 'Trasporti' | 'Cibo & Drink' | 'Alloggio' | 'Attività & Eventi' | 'Shopping & Altro';
  amount: number;
  currency: 'EUR' | 'KRW' | 'CNY';
  payerId: string;
  participants: string[];
  date: string;
  notes?: string;
}

export interface Traveler {
  id: string;
  name: string;
  color: string;
  avatarSeed: string;
}

export const TRAVELERS_DEFAULT: Traveler[] = [
  { id: 't1', name: 'Partecipante 1', color: '#06b6d4', avatarSeed: 'Slot1' },
  { id: 't2', name: 'Partecipante 2', color: '#ec4899', avatarSeed: 'Slot2' },
  { id: 't3', name: 'Partecipante 3', color: '#8b5cf6', avatarSeed: 'Slot3' },
  { id: 't4', name: 'Partecipante 4', color: '#f59e0b', avatarSeed: 'Slot4' }
];

export const EXCHANGE_RATES = {
  EUR: 1,
  KRW: 1485,
  CNY: 7.50
};

export const TRIP_META = {
  title: 'Viaggio in Corea del Sud · Seul 2027',
  dates: '2 - 19 marzo 2027 (Partenza 1 marzo)',
  nights: 17,
  participantsCount: 4,
  base: 'Opzioni Enko Stay: Myeongdong, Seoul Station, Mapo o Sinseol-dong',
  airline: 'Air China',
  specialHighlight: 'VALORANT MASTERS SEOUL 2027',
  // ?v= forza il browser e il service worker a scaricare di nuovo il PDF aggiornato
  pdfPath: `${import.meta.env.BASE_URL}assets/aistudio/Itinerario_Seul_2027_aggiornato.pdf?v=2026-11-06`
};

export const FLIGHTS_BOOKING_URL =
  'https://it.gotogate.com/rf/result?selectionKey=CA950-01Mar27-T_CA123-02Mar27-T_CA124-19Mar27-T_CA949-20Mar27-T%2C7ryjxv%2C%3A%3Ag_0.0.0.0%3Ah_0.0.1.1%3Aa_KU.EG.LY.3R%3Ab_1O%3Ac_27%3Ad_84f30%3Ae_-67ca%3Af_2%3Ai_1.0.0%3Aj_E0%3Az_bgs0dc';


// 4 ALLOGGI A CONFRONTO (ENKO STAY, 2-19 MARZO, 4 PERSONE)
const ACCOMMODATIONS_BASE: Omit<AccommodationOption, 'nightlyRateEur' | 'pietroCost8Nights' | 'other3Cost17Nights'>[] = [
  {
    id: 'acc_a',
    code: 'A',
    name: 'Alloggio A: Myeongdong / City Hall',
    adTitle: "'7 mins to Myeongdong'",
    district: 'Myeongdong & City Hall',
    lat: 37.5615,
    lng: 126.9795,
    monthlyKrw: 1056000,
    totalEur17Nights: 424,
    costPerPerson4: 106,
    costPerPerson3: 141,
    typeDescription: 'Intero 4° piano, appartamento privato con 2 bagni, cucina e soggiorno. Senza ascensore.',
    metroWalk: 'City Hall (Linea 2): 7 min · Hoehyeon (Linea 4): 7 min · Stazione di Seul: 10 min a piedi.',
    airportTransit: 'Fermata bus aeroporto entro 5 min a piedi. Stazione di Seul (AREX) a 10 min.',
    hongdaeTransit: 'circa 25-30 min con AREX o Metro Linea 2.',
    nearbyAttractions: 'Myeongdong, Mercato di Namdaemun, Monte Namsan a 10 min.',
    pro: [
      'Il più economico in assoluto: 424 € in tutto, cioè 125 € a testa per chi resta 17 notti (circa 95 € in meno di Mapo)',
      'Super centrale: due bagni completi, comodissimi per 4 persone',
      'Vicinissimo a Myeongdong, al mercato di Namdaemun e alla salita per il Namsan'
    ],
    contro: [
      'Quarto piano senza ascensore (faticoso con valigie da 23 kg)',
      'Numero esatto e tipologia di letti non specificati (da chiedere conferma all\'host)',
      'Quartiere commerciale vivace di giorno ma meno attivo per la vita notturna',
      'Luce a consumo da pagare a parte a fine soggiorno'
    ],
    highlightBadge: 'Il Più Economico (125 €/testa)',
    highlightBadgeColor: 'emerald',
    importantNotes: 'Consigliatissimo per risparmiare al massimo se non temete le scale del 4° piano e se i posti letto sono idonei.'
  },
  {
    id: 'acc_b',
    code: 'B',
    name: 'Alloggio B: Stazione Centrale di Seul',
    adTitle: "'My Stay SEOUL'",
    district: 'Stazione di Seul (Yongsan-gu)',
    lat: 37.5532,
    lng: 126.9698,
    monthlyKrw: 1540000,
    totalEur17Nights: 659,
    costPerPerson4: 165,
    costPerPerson3: 220,
    typeDescription: 'Casa indipendente, seminterrato ristrutturato con 2 camere, 1 bagno e cucina.',
    metroWalk: 'Stazione di Seul (uscita 15): 7 min. Linee 1, 4, Gyeongui-Jungang, GTX-A, KTX, AREX.',
    airportTransit: 'Stazione di Seul: treno AREX diretto per aeroporto Incheon + bus aeroportuali in zona.',
    hongdaeTransit: 'circa 20-25 min (AREX diretto, 1 solo treno).',
    nearbyAttractions: 'Stazione di Seul, Parco Namsan, mercati tradizionali.',
    pro: [
      'Posizione impareggiabile per i collegamenti: KTX, AREX, 4 linee della metropolitana',
      'Arrivo e partenza dall\'aeroporto comodissimi senza cambi'
    ],
    contro: [
      'È un seminterrato (da verificare illuminazione naturale e umidità)',
      'Un solo bagno per 4 persone',
      'Prezzo più alto di A (659 € totali) senza grandi vantaggi'
    ],
    highlightBadge: 'Hub Trasporti & Treni',
    highlightBadgeColor: 'sky',
    importantNotes: 'Ha senso principalmente se date priorità assoluta alla vicinanza ai treni veloci; in generale A o C sono opzioni preferibili.'
  },
  {
    id: 'acc_c',
    code: 'C',
    name: 'Alloggio C: Mapo Capernaum (Gongdeok)',
    adTitle: "'1 minutes from Mapo station'",
    district: 'Mapo / Gongdeok',
    lat: 37.5398,
    lng: 126.9458,
    monthlyKrw: 1870000,
    totalEur17Nights: 748,
    costPerPerson4: 187,
    costPerPerson3: 249,
    typeDescription: 'Monolocale in officetel moderno con 1 bagno, cucina, divano letto, lavatrice e ascensore.',
    metroWalk: 'Stazione Mapo (Linea 5): 1 min · Stazione Gongdeok (Linee 5, 6, AREX): 5 min.',
    airportTransit: 'Fermata bus aeroporto a 2 min. Treno AREX diretto a Gongdeok.',
    hongdaeTransit: 'circa 10-15 min (1 sola fermata di AREX da Gongdeok, ritorno rapido in taxi o a piedi).',
    nearbyAttractions: 'Hongdae, Isola Yeouido sul fiume Han, Gwanghwamun.',
    pro: [
      'La soluzione più comoda in assoluto per la movida serale a Hongdae',
      'Rientro notturno rapido a costi minimi di taxi o a piedi',
      'Palazzo moderno con ascensore comodo e lavatrice in casa'
    ],
    contro: [
      'L\'alloggio più caro del gruppo (220 € a testa per chi resta 17 notti)',
      'Monolocale stretto per 4 persone con divano letto',
      'Biancheria e asciugamani non forniti (da richiedere all\'host)',
      'Niente prodotti da bagno (shampoo/bagnoschiuma)'
    ],
    highlightBadge: 'Top per Movida & Hongdae',
    highlightBadgeColor: 'pink',
    importantNotes: 'Per i tre che restano costa circa 26-31 € a testa in più rispetto a B e D, ma fa risparmiare tempo e soldi nei taxi notturni dopo le serate.'
  },
  {
    id: 'acc_d',
    code: 'D',
    name: 'Alloggio D: Sinseol-dong',
    adTitle: "'Kimsfamily House'",
    district: 'Sinseol-dong & Dongdaemun',
    lat: 37.5758,
    lng: 127.0248,
    monthlyKrw: 1628000,
    totalEur17Nights: 641,
    costPerPerson4: 160,
    costPerPerson3: 214,
    typeDescription: 'Camera 201: appartamento con 2 camere da letto, 3 letti queen size, 1 bagno, cucina e soggiorno. Fino a 6 persone.',
    metroWalk: 'Stazione Sinseol-dong: 1 min a piedi (Linee 1 e 2).',
    airportTransit: 'Nessun bus diretto indicato. Collegamento aeroporto con cambi metro (più lungo).',
    hongdaeTransit: 'circa 35-45 min con cambi metropolitana.',
    nearbyAttractions: 'Konkuk/Kondae, polo moda Dongdaemun, quartiere universitario.',
    pro: [
      'Il più comodo e spazioso in assoluto per dormire: 3 veri letti queen size e 2 camere separate',
      'Zona universitaria economica con ristoranti, market e servizi aperti h24'
    ],
    contro: [
      'Posizione periferica rispetto a Hongdae e Gangnam',
      'Rientro notturno più lungo e costoso: ultima metro verso l\'1 di notte, poi solo taxi o bus notturni'
    ],
    highlightBadge: 'Massimo Comfort Letti (3 Queen)',
    highlightBadgeColor: 'purple',
    importantNotes: 'Ideale se il gruppo privilegia la qualità del sonno e lo spazio vitale, sapendo che le serate fuori richiedono spostamenti più lunghi.'
  }
];

/**
 * Quote calcolate con la regola del gruppo: ogni notte costa totale / 17 e la pagano i presenti.
 * Chi riparte il 10 marzo (Pietro): 8 notti (2-9 marzo) divise per 4. Gli altri 3: le stesse 8 notti / 4 + le 9 notti successive (10-18 marzo) / 3.
 */
export function priceAccommodation(
  acc: Omit<AccommodationOption, 'nightlyRateEur' | 'pietroCost8Nights' | 'other3Cost17Nights'>,
  totalEur17Nights: number = acc.totalEur17Nights
): AccommodationOption {
  const nightly = totalEur17Nights / 17;
  const sharedPart = (8 * nightly) / 4;
  return {
    ...acc,
    totalEur17Nights,
    nightlyRateEur: Math.round(nightly),
    pietroCost8Nights: Math.round(sharedPart),
    other3Cost17Nights: Math.round(sharedPart + (9 * nightly) / 3),
    costPerPerson4: Math.round(totalEur17Nights / 4),
    costPerPerson3: Math.round(totalEur17Nights / 3)
  };
}

export const ACCOMMODATIONS: AccommodationOption[] = ACCOMMODATIONS_BASE.map((acc) => {
  const nightly = acc.totalEur17Nights / 17;
  const sharedPart = (8 * nightly) / 4;
  return {
    ...acc,
    nightlyRateEur: Math.round(nightly),
    pietroCost8Nights: Math.round(sharedPart),
    other3Cost17Nights: Math.round(sharedPart + (9 * nightly) / 3)
  };
});

export const MAP_LOCATIONS: MapLocation[] = [
  // ALLOGGI (Categoria 'alloggio')
  {
    id: 'acc_a',
    name: 'Alloggio A: Myeongdong / City Hall',
    italianName: 'Alloggio A: Myeongdong / City Hall',
    koreanName: '시청역',
    district: 'Myeongdong & City Hall',
    city: 'Seul',
    category: 'alloggio',
    lat: 37.5615,
    lng: 126.9795,
    dayNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    description: 'Opzione Enko Stay A: 424 € totali per 17 notti (50 € per chi parte il 10, 125 € per chi resta fino al 19). Il più economico. 4° piano privato, 2 bagni, cucina. Metro City Hall a 7 min.',
    tips: '4° piano senza ascensore; luce a consumo a parte.',
    accommodationCode: 'A'
  },
  {
    id: 'acc_b',
    name: 'Alloggio B: Stazione di Seul',
    italianName: 'Alloggio B: Stazione di Seul',
    koreanName: '서울역',
    district: 'Stazione di Seul',
    city: 'Seul',
    category: 'alloggio',
    lat: 37.5532,
    lng: 126.9698,
    dayNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    description: 'Opzione Enko Stay B: 659 € totali per 17 notti (78 € per chi parte il 10, 194 € per chi resta fino al 19). Seminterrato ristrutturato con 2 camere, 1 bagno. A 7 min da Seoul Station (AREX e KTX).',
    tips: 'Ottimo per i treni e aeroporto; un solo bagno.',
    accommodationCode: 'B'
  },
  {
    id: 'acc_c',
    name: 'Alloggio C: Mapo Capernaum',
    italianName: 'Alloggio C: Mapo Capernaum (Gongdeok)',
    koreanName: '마포역',
    district: 'Mapo / Gongdeok',
    city: 'Seul',
    category: 'alloggio',
    lat: 37.5398,
    lng: 126.9458,
    dayNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    description: 'Opzione Enko Stay C: 748 € totali per 17 notti (88 € per chi parte il 10, 220 € per chi resta fino al 19). Monolocale officetel con ascensore e lavatrice. A 1 fermata AREX da Hongdae (top per la movida).',
    tips: 'Top per la vita notturna; divano letto, biancheria non fornita.',
    accommodationCode: 'C'
  },
  {
    id: 'acc_d',
    name: 'Alloggio D: Sinseol-dong',
    italianName: 'Alloggio D: Sinseol-dong (Kimsfamily)',
    koreanName: '신설동역',
    district: 'Sinseol-dong & Dongdaemun',
    city: 'Seul',
    category: 'alloggio',
    lat: 37.5758,
    lng: 127.0248,
    dayNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    description: 'Opzione Enko Stay D: 641 € totali per 17 notti (75 € per chi parte il 10, 189 € per chi resta fino al 19). Il più comodo per dormire: 2 camere, 3 letti queen size, cucina e soggiorno. Metro a 1 min.',
    tips: 'Massimo comfort letti; più lontano da Hongdae.',
    accommodationCode: 'D'
  },

  // Hongdae & Ovest
  {
    id: 'hongdae_district',
    name: 'Quartiere di Hongdae (Hongik Univ.)',
    italianName: 'Hongdae (Vita Notturna, Busker & Club)',
    koreanName: '홍대입구역',
    district: 'Hongdae & Mapo',
    city: 'Seul',
    category: 'nightlife',
    lat: 37.5563,
    lng: 126.9236,
    dayNumbers: [1, 2, 4, 12, 16],
    description: 'Il cuore pulsante giovanile di Seul attorno alla Hongik University: artisti di strada, club, pocha, negozi streetwear e barbecue aperti fino all\'alba.',
    tips: 'Snodo diretto tra Linea 2, AREX per l\'aeroporto e Gyeongui-Jungang.'
  },
  {
    id: 'mangwon_market',
    name: 'Mercato Tradizionale di Mangwon',
    italianName: 'Mercato Tradizionale di Mangwon',
    koreanName: '망원시장',
    district: 'Mapo & Ovest',
    city: 'Seul',
    category: 'food',
    lat: 37.5559,
    lng: 126.9054,
    dayNumbers: [1],
    description: 'Mercato coperto autentico frequentato dai residenti: eccellente pollo fritto dakgangjeong, crocchette e kimbap a prezzi popolari (3-4 € a pasto).',
    mustTry: 'Pollo fritto caramellato dakgangjeong'
  },
  {
    id: 'sinchon',
    name: 'Quartiere Universitario di Sinchon',
    italianName: 'Sinchon (Pocha & Locali Studenti)',
    koreanName: '신촌',
    district: 'Sinchon & Mapo',
    city: 'Seul',
    category: 'nightlife',
    lat: 37.5552,
    lng: 126.9368,
    dayNumbers: [3, 15],
    description: 'Area studentesca ricca di pojangmacha (tende street food e birrerie), barbecue KBBQ e locali economici senza costi di coperto.',
    tips: 'Ideale per cenare e bere spendendo il 40% in meno rispetto a Gangnam.'
  },

  // Evento Valorant
  {
    id: 'valorant_masters_arena',
    name: 'Valorant Masters Seoul 2027 (Venue TBD)',
    italianName: 'Valorant Masters Seoul 2027 (Arena Da Annunciare)',
    koreanName: '상암 e스타디움',
    district: 'Sede in Attesa di Annuncio',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5683,
    lng: 126.8973,
    dayNumbers: [2],
    description: 'ARENA NON ANCORA DECISA: La sede ufficiale del Valorant Masters Seoul 2027 deve ancora essere annunciata ufficialmente da Riot Games! Posizione sulla mappa puramente indicativa in attesa del comunicato Riot (candidate principali: Sangam e-Stadium, LoL Park Jongno, KSPO Dome o Olympic Handball Gymnasium).',
    tips: 'Le vendite dei biglietti apriranno su Interpark Global circa 4-6 settimane prima dell\'evento.',
    mustTry: 'Annuncio venue ufficiale atteso da Riot Games'
  },

  // Centro Storico & Palazzi
  {
    id: 'gyeongbokgung',
    name: 'Palazzo Reale Gyeongbokgung',
    italianName: 'Palazzo Reale Gyeongbokgung',
    koreanName: '경복궁',
    district: 'Jongno & Centro Storico',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5796,
    lng: 126.9770,
    dayNumbers: [3],
    description: 'Il palazzo monumentale principale della dinastia Joseon. Ingresso completamente GRATUITO per chi indossa il costume tradizionale Hanbok!',
    mustTry: 'Cerimonia del cambio della guardia reale alla porta Gwanghwamun (ore 10:00 e 14:00)'
  },
  {
    id: 'bukchon_hanok',
    name: 'Villaggio Tradizionale Bukchon Hanok',
    italianName: 'Villaggio Bukchon Hanok',
    koreanName: '북촌한옥마을',
    district: 'Jongno & Centro Storico',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5826,
    lng: 126.9837,
    dayNumbers: [3],
    description: 'Centinaia di storiche case hanok in legno e pietra tra i due palazzi reali.',
    tips: 'Zona residenziale tranquilla: rispettare il silenzio.'
  },
  {
    id: 'insadong',
    name: 'Via Tradizionale di Insadong',
    italianName: 'Via Culturale di Insadong',
    koreanName: '인사동',
    district: 'Jongno & Centro Storico',
    city: 'Seul',
    category: 'food',
    lat: 37.5744,
    lng: 126.9858,
    dayNumbers: [3],
    description: 'Vicolo pedonale dedicato all\'artigianato, gallerie d\'arte e antiche sale da tè tradizionali coreane.',
    mustTry: 'Tè alle 5 bacche omija in una sala da tè storica'
  },

  // Seongsu & Est
  {
    id: 'seongsu_dong',
    name: 'Distretto Creativo di Seongsu-dong',
    italianName: 'Seongsu-dong (Concept District)',
    koreanName: '성수동',
    district: 'Seongsu & Est',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5445,
    lng: 127.0560,
    dayNumbers: [4],
    description: 'La "Brooklyn di Seul": vecchie officine trasformate in concept store moderni e caffetterie di design.',
    tips: 'Flagship pop-up store e caffè di design nei vecchi magazzini industriali.'
  },
  {
    id: 'seoul_forest',
    name: 'Parco Seoul Forest',
    italianName: 'Parco Naturale Seoul Forest',
    koreanName: '서울숲',
    district: 'Seongsu & Est',
    city: 'Seul',
    category: 'natura',
    lat: 37.5443,
    lng: 127.0374,
    dayNumbers: [4],
    description: 'Vasto parco verde pubblico con boschi di bambù, laghetti e sentieri rilassanti. Ingresso gratuito.',
    tips: 'Ideale per una passeggiata rigenerante a costo zero.'
  },
  {
    id: 'kondae_konkuk',
    name: 'Via dei Sapori di Konkuk (Kondae)',
    italianName: 'Kondae (Quartiere Studentesco)',
    koreanName: '건대맛의거리',
    district: 'Seongsu & Est',
    city: 'Seul',
    category: 'nightlife',
    lat: 37.5404,
    lng: 127.0692,
    dayNumbers: [8],
    description: 'Distretto studentesco celebre per l\'alta densità di locali economici, pub e ristoranti a prezzi calmierati.',
    tips: 'Prezzi sensibilmente inferiori rispetto a Gangnam o Itaewon.'
  },

  // Itaewon & Namsan
  {
    id: 'itaewon',
    name: 'Quartiere Internazionale di Itaewon',
    italianName: 'Itaewon & Hannam-dong',
    koreanName: '이태원',
    district: 'Itaewon & Namsan',
    city: 'Seul',
    category: 'nightlife',
    lat: 37.5346,
    lng: 126.9942,
    dayNumbers: [5, 12],
    description: 'Polo multiculturale di Seul: cocktail bar panoramici, cucine internazionali e lounge bar.',
    tips: 'Consigliato pregame economico nei convenience store e selezione di un singolo locale.'
  },
  {
    id: 'namsan_tower',
    name: 'Torre N Seoul & Monte Namsan',
    italianName: 'Monte Namsan & Torre N Seoul',
    koreanName: 'N서울타워',
    district: 'Itaewon & Namsan',
    city: 'Seul',
    category: 'natura',
    lat: 37.5512,
    lng: 126.9882,
    dayNumbers: [7],
    description: 'La celebre torre panoramica che domina Seul. La salita a piedi attraverso i sentieri nel bosco è completamente gratuita!',
    tips: 'Evitare la funivia a pagamento: il sentiero a piedi dura 30 minuti ed è panoramico e rilassante.'
  },
  {
    id: 'myeongdong',
    name: 'Via Pedonale di Myeongdong',
    italianName: 'Myeongdong (Street Food & Cosmetici)',
    koreanName: '명동',
    district: 'Jongno & Centro Storico',
    city: 'Seul',
    category: 'food',
    lat: 37.5636,
    lng: 126.9828,
    dayNumbers: [7],
    description: 'Distretto commerciale pedonale colmo di carretti di street food e boutique cosmetiche coreane.',
    mustTry: 'Spiedini di tortino di riso e formaggio, patate a spirale'
  },

  // Mercati & Architettura
  {
    id: 'gwangjang_market',
    name: 'Mercato Storico di Gwangjang',
    italianName: 'Mercato Storico di Gwangjang',
    koreanName: '광장시장',
    district: 'Jongno & Centro Storico',
    city: 'Seul',
    category: 'food',
    lat: 37.5700,
    lng: 126.9997,
    dayNumbers: [6],
    description: 'Il mercato coperto più antico della capitale (dal 1905), culla del miglior street food economico di Seul.',
    mustTry: 'Bindaetteok croccanti di fagioli mungo e Mayak Kimbap'
  },
  {
    id: 'cheonggyecheon',
    name: 'Torrente Urbano Cheonggyecheon',
    italianName: 'Fiume Cheonggyecheon',
    koreanName: '청계천',
    district: 'Jongno & Centro Storico',
    city: 'Seul',
    category: 'natura',
    lat: 37.5692,
    lng: 126.9785,
    dayNumbers: [6],
    description: 'Canale urbano restaurato che attraversa il cuore della città per oltre 10 km, con ponti e camminamenti gratuiti.',
    tips: 'Passeggiata rilassante tra installazioni d\'arte.'
  },
  {
    id: 'ddp_dongdaemun',
    name: 'Dongdaemun Design Plaza (DDP)',
    italianName: 'Dongdaemun Design Plaza (DDP)',
    koreanName: '동대문디자인플라자',
    district: 'Dongdaemun',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5665,
    lng: 127.0092,
    dayNumbers: [6, 16],
    description: 'Iconico complesso neofuturistico disegnato da Zaha Hadid, rivestito da 45.000 pannelli di alluminio.',
    tips: 'Ingresso agli spazi esterni e alle aree comuni gratuito.'
  },
  {
    id: 'national_museum',
    name: 'Museo Nazionale della Corea',
    italianName: 'Museo Nazionale della Corea',
    koreanName: '국립중앙박물관',
    district: 'Yongsan',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5240,
    lng: 126.9803,
    dayNumbers: [8],
    description: 'Uno dei musei più grandi e prestigiosi al mondo con oltre 200.000 reperti storici. Ingresso permanente GRATUITO.',
    mustTry: 'La celebre Stanza della Contemplazione con le statue di Buddha'
  },

  // Gangnam & COEX
  {
    id: 'coex_starfield',
    name: 'Biblioteca Starfield (COEX Mall)',
    italianName: 'Biblioteca Starfield COEX',
    koreanName: '별마당도서관',
    district: 'Gangnam',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5113,
    lng: 127.0594,
    dayNumbers: [10],
    description: 'Spettacolare biblioteca aperta all\'interno del centro commerciale sotterraneo con scaffali alti 13 metri (gratis).',
    tips: 'Accesso libero, punto fotografico iconico.'
  },
  {
    id: 'bongeunsa_temple',
    name: 'Tempio Buddista Bongeunsa',
    italianName: 'Tempio Buddista Bongeunsa',
    koreanName: '봉은사',
    district: 'Gangnam',
    city: 'Seul',
    category: 'cultura',
    lat: 37.5144,
    lng: 127.0573,
    dayNumbers: [10],
    description: 'Oasi di meditazione fondata nel 794 d.C. di fronte ai grattacieli moderni di Gangnam.',
    tips: 'Statua monumentale di Buddha alta 23 metri.'
  },
  {
    id: 'gangnam_district',
    name: 'Viale Principale di Gangnam',
    italianName: 'Gangnam Boulevard',
    koreanName: '강남역',
    district: 'Gangnam',
    city: 'Seul',
    category: 'nightlife',
    lat: 37.4979,
    lng: 127.0276,
    dayNumbers: [10],
    description: 'Il distretto finanziario ed elegante. Visita programmata di giovedì per evitare i rincari del weekend.',
    tips: 'Serata controllata per budget conservativo.'
  },

  // Natura & Fiume Han
  {
    id: 'yeouido_hangang_park',
    name: 'Parco Yeouido sul Fiume Han',
    italianName: 'Parco del Fiume Han (Yeouido)',
    koreanName: '여의도한강공원',
    district: 'Fiume Han',
    city: 'Seul',
    category: 'natura',
    lat: 37.5284,
    lng: 126.9329,
    dayNumbers: [13],
    description: 'Il parco sul fiume Han dove i coreani festeggiano il White Day (14 marzo) mangiando ramyeon dai convenience store.',
    mustTry: 'Ramyeon cotto nelle ciotole d\'alluminio istantanee sul prato'
  },
  {
    id: 'bukhansan_national_park',
    name: 'Parco Nazionale del Bukhansan',
    italianName: 'Parco Nazionale del Bukhansan',
    koreanName: '북한산국립공원',
    district: 'Nord Seul',
    city: 'Seul',
    category: 'natura',
    lat: 37.6608,
    lng: 126.9934,
    dayNumbers: [15],
    description: 'Trekking panoramico sulle vette granitiche che circondano Seul da nord. Ingresso al parco 100% gratuito.',
    tips: 'Indossare scarpe con buona suola per la roccia granitica.'
  },
  {
    id: 'olive_young_flagship',
    name: 'Mega Store Olive Young (K-Beauty)',
    italianName: 'Olive Young Flagship Store',
    koreanName: '올리브영 명동타운',
    district: 'Shopping & Skincare',
    city: 'Seul',
    category: 'food',
    lat: 37.5644,
    lng: 126.9855,
    dayNumbers: [16],
    description: 'Il paradiso della cosmetica e cura della pelle coreana con Tax Refund immediato del 7-8% presentando il passaporto alla cassa.',
    tips: 'Sconto IVA applicato direttamente al momento del pagamento.'
  },

  // Gite Fuori Porta
  {
    id: 'incheon_chinatown_wolmido',
    name: 'Incheon: Chinatown Storica & Wolmido',
    italianName: 'Gita a Incheon (Chinatown & Wolmido)',
    koreanName: '인천 차이나타운',
    district: 'Incheon',
    city: 'Dintorni / Gite',
    category: 'gita',
    lat: 37.4756,
    lng: 126.6178,
    dayNumbers: [9],
    description: 'Gita marittima a 1 ora di treno/metro da Seul: Chinatown con il celebre Jajangmyeon e passeggiata sul lungomare di Wolmido con giostre.',
    mustTry: 'Jajangmyeon nero originale a Chinatown'
  },
  {
    id: 'suwon_hwaseong',
    name: 'Fortezza UNESCO di Hwaseong (Suwon)',
    italianName: 'Fortezza di Suwon (UNESCO)',
    koreanName: '수원화성',
    district: 'Suwon',
    city: 'Dintorni / Gite',
    category: 'gita',
    lat: 37.2871,
    lng: 127.0118,
    dayNumbers: [11],
    description: 'Imponente cinta muraria di 5,7 km del XVIII secolo percorribile a piedi con torri di guardia e porte monumentali.',
    tips: 'Raggiungibile con la normale metro Linea 1 a costo minimo (~2 €).'
  },
  {
    id: 'suwon_ingyedong',
    name: 'Polo Ristoranti Ingye-dong (Suwon)',
    italianName: 'Ingye-dong (Ristoranti Suwon)',
    koreanName: '인계동',
    district: 'Suwon',
    city: 'Dintorni / Gite',
    category: 'nightlife',
    lat: 37.2625,
    lng: 127.0315,
    dayNumbers: [11],
    description: 'La zona dei locali e ristoranti serali a Suwon per cenare dopo la visita alla fortezza.',
    tips: 'Controllare l\'orario dell\'ultima metro verso mezzanotte per rientrare a Seul.'
  },
  {
    id: 'dmz_imjingak',
    name: 'Zona Demilitarizzata DMZ & Imjingak',
    italianName: 'Confine DMZ & Parco di Imjingak',
    koreanName: '임진각',
    district: 'Confine Nord Corea',
    city: 'Dintorni / Gite',
    category: 'gita',
    lat: 37.8906,
    lng: 126.7417,
    dayNumbers: [14],
    description: 'Il confine tra le due Coree: Terzo Tunnel d\'infiltrazione sotterraneo, Ponte della Libertà e Osservatorio Dora.',
    tips: 'Passaporto originale obbligatorio per i controlli militari.'
  },

  // Aeroporti & Scalo Pechino
  {
    id: 'incheon_airport',
    name: 'Aeroporto Internazionale di Incheon (ICN)',
    italianName: 'Aeroporto di Incheon (ICN)',
    koreanName: '인천국제공항',
    district: 'Incheon Airport',
    city: 'Seul',
    category: 'logistica',
    lat: 37.4602,
    lng: 126.4407,
    dayNumbers: [1, 18],
    description: 'Hub aereo principale: collegato con il treno AREX a Hongdae e Seoul Station. Chioschi Tax Refund e check-in Air China.',
    tips: 'Treno all-stop molto più economico dell\'espresso.'
  },
  {
    id: 'beijing_airport_t3',
    name: 'Aeroporto Pechino Capitale T3 (PEK)',
    italianName: 'Pechino Capitale T3 (PEK)',
    koreanName: '北京首都国际机场T3',
    district: 'Aeroporto Pechino',
    city: 'Pechino',
    category: 'logistica',
    lat: 40.0799,
    lng: 116.6031,
    dayNumbers: [18],
    description: 'Terminal 3 dove atterriamo alle 14:20 e ripartiamo alle 02:15. Punto di rilascio del permesso di transito 240 ore senza visto.',
    tips: 'Rientro al T3 tassativo entro le 22:45!'
  },
  {
    id: 'beijing_dongzhimen',
    name: 'Stazione Dongzhimen (Pechino)',
    italianName: 'Stazione Dongzhimen (Pechino)',
    koreanName: '东直门站',
    district: 'Centro Pechino',
    city: 'Pechino',
    category: 'logistica',
    lat: 39.9413,
    lng: 116.4352,
    dayNumbers: [18],
    description: 'Capolinea dell\'Airport Express (25 CNY, 25 minuti). Snodo per la Metro Linea 2 verso Qianmen.',
    tips: 'Ultimo treno per l\'aeroporto verso le 22:30.'
  },
  {
    id: 'beijing_qianmen',
    name: 'Via Storica Pedonale di Qianmen',
    italianName: 'Via Pedonale di Qianmen & Dashilar',
    koreanName: '前门大街',
    district: 'Centro Storico Pechino',
    city: 'Pechino',
    category: 'food',
    lat: 39.8972,
    lng: 116.3975,
    dayNumbers: [18],
    description: 'Suggestiva strada pedonale storica a sud di Tiananmen con ristoranti tradizionali di anatra laccata (Quanjude / Siji Minfu).',
    mustTry: 'Autentica Anatra Laccata alla Pechinese divisa in 4'
  },
  {
    id: 'beijing_tiananmen',
    name: 'Tiananmen Square (Piazza Tiananmen)',
    italianName: 'Piazza Tiananmen',
    koreanName: '天安门广场',
    district: 'Dongcheng, Centro Storico Pechino',
    city: 'Pechino',
    category: 'cultura',
    lat: 39.9055,
    lng: 116.3976,
    dayNumbers: [18],
    description: 'La monumentale piazza centrale di Pechino, situata tra la Porta Qianmen e la Città Proibita. Tappa della serata durante lo scalo con transito senza visto di 240 ore. NOTA FONDAMENTALE: Accesso gratuito ma con prenotazione nominativa obbligatoria con passaporto da effettuare online con almeno 24h di anticipo.',
    tips: 'Controlli di sicurezza rigorosi (scanner passaporti e metal detector ai varchi). Raggiungibile a piedi dalla via pedonale Qianmen o con Metro Linea 2 (stazione Qianmen).',
    mustTry: 'Vista notturna della piazza e degli edifici storici illuminati'
  },
  {
    id: 'mxp_terminal1',
    name: 'Milano Malpensa Terminal 1 (MXP)',
    italianName: 'Milano Malpensa T1 (MXP)',
    koreanName: 'Malpensa T1',
    district: 'Partenze T1',
    city: 'Milano',
    category: 'logistica',
    lat: 45.6301,
    lng: 8.7231,
    dayNumbers: [0, 18, 19],
    description: 'Punto d\'incontro del gruppo: 1 marzo ore 10:00 davanti ai banchi check-in Air China. Il 20 marzo alle 06:30 è anche l\'arrivo del volo di rientro.',
    tips: 'Raggiungibile autonomamente con mezzi propri o treno ordinario.'
  },
  {
    id: 'milano_centrale',
    name: 'Milano Centrale',
    italianName: 'Stazione di Milano Centrale',
    koreanName: 'Milano Centrale',
    district: 'Milano',
    city: 'Milano',
    category: 'logistica',
    lat: 45.4859,
    lng: 9.2046,
    dayNumbers: [19],
    description: 'Arrivo del Malpensa Express (circa 50 minuti da Malpensa T1) il 20 marzo verso le 10:00-10:30. Da qui ognuno prende il suo treno verso casa, dalle 11:30.',
    tips: 'Meglio biglietti flessibili per i treni di casa. Deposito bagagli a pagamento (da verificare).'
  }
];

/**
 * Restituisce l'URL di ricerca ottimale per Naver Map.
 * Risolve il problema delle ricerche con nomi in italiano che fallivano su Naver Map:
 * 1. Se è presente `koreanName` (in Hangul), usa direttamente il nome coreano ufficiale riconosciuto istantaneamente da Naver
 * 2. Se in Corea del Sud ma senza Hangul, passa le coordinate GPS esatte lat,lng
 * 3. Fallback al nome inglese o alle coordinate
 */
export function getNaverMapSearchUrl(location: {
  koreanName?: string;
  name?: string;
  italianName?: string;
  lat: number;
  lng: number;
  city?: string;
}): string {
  if (location.koreanName && location.koreanName.trim()) {
    const cleanKo = location.koreanName.split('/')[0].trim();
    return `https://map.naver.com/p/search/${encodeURIComponent(cleanKo)}`;
  }
  // Se le coordinate sono in Corea del Sud, Naver Map apre e centra il punto esatto
  if (location.lat >= 33 && location.lat <= 39 && location.lng >= 124 && location.lng <= 132) {
    return `https://map.naver.com/p/search/${location.lat},${location.lng}`;
  }
  return `https://map.naver.com/p/search/${encodeURIComponent(location.name || `${location.lat},${location.lng}`)}`;
}

export const FLIGHTS_SCHEDULE: FlightLeg[] = [
  {
    id: 'fl_outbound_1',
    flightNumber: 'CA 950 (indicativo)',
    airline: 'Air China',
    airlineCode: 'CA',
    departureAirport: 'Milano Malpensa',
    departureAirportCode: 'MXP',
    departureTerminal: 'T1',
    departureTime: '12:30',
    departureDate: '1 marzo 2027',
    arrivalAirport: 'Pechino Capitale',
    arrivalAirportCode: 'PEK',
    arrivalTerminal: 'T3',
    arrivalTime: '05:35',
    arrivalDate: '2 marzo 2027',
    duration: '10h 00m',
    layoverNotice: 'Scalo a Pechino di 3h05: International Transfer, senza uscire dall\'aeroporto',
    baggageInfo: '23 kg bagaglio in stiva incluso + 8 kg a mano',
    notes: [
      'Ritrovo entro le 10:00 al T1 davanti ai banchi Air China',
      'Chiedere carte d\'imbarco di entrambi i tratti (MXP-PEK e PEK-ICN)',
      'Valigie etichettate fino a Seul (ICN)'
    ]
  },
  {
    id: 'fl_outbound_2',
    flightNumber: 'CA 123 (indicativo)',
    airline: 'Air China',
    airlineCode: 'CA',
    departureAirport: 'Pechino Capitale',
    departureAirportCode: 'PEK',
    departureTerminal: 'T3',
    departureTime: '08:40',
    departureDate: '2 marzo 2027',
    arrivalAirport: 'Seul Incheon',
    arrivalAirportCode: 'ICN',
    arrivalTerminal: 'T1 / T2',
    arrivalTime: '11:40',
    arrivalDate: '2 marzo 2027',
    duration: '2h 10m',
    baggageInfo: 'Ritiro bagagli all\'arrivo a Incheon',
    notes: [
      'Transito a Pechino T3',
      'Arrivo a Incheon ore 11:40, incontro per prendere l\'AREX fino a Hongdae'
    ]
  },
  {
    id: 'fl_inbound_1',
    flightNumber: 'CA 124 (indicativo)',
    airline: 'Air China',
    airlineCode: 'CA',
    departureAirport: 'Seul Incheon',
    departureAirportCode: 'ICN',
    departureTerminal: 'T1 / T2',
    departureTime: '13:10',
    departureDate: '19 marzo 2027',
    arrivalAirport: 'Pechino Capitale',
    arrivalAirportCode: 'PEK',
    arrivalTerminal: 'T3',
    arrivalTime: '14:20',
    arrivalDate: '19 marzo 2027',
    duration: '2h 10m',
    layoverNotice: 'Scalo lungo con uscita città: 14:20 -> 02:15 (circa 11h55 di sosta)',
    baggageInfo: 'Chiedere a Incheon se le valigie (23 kg) vanno fino a Milano (così si esce solo con zaino)',
    notes: [
      'Check-in a Incheon ore 10:10 (apre 3 ore prima)',
      'Chiedere valigie etichettate fino a Milano MXP',
      'Farsi stampare entrambe le carte d\'imbarco (servono al banco 240h a Pechino)',
      'A bordo spostare l\'orologio indietro di 1 ora'
    ]
  },
  {
    id: 'fl_inbound_2',
    flightNumber: 'CA 949 (indicativo)',
    airline: 'Air China',
    airlineCode: 'CA',
    departureAirport: 'Pechino Capitale',
    departureAirportCode: 'PEK',
    departureTerminal: 'T3',
    departureTime: '02:15',
    departureDate: '20 marzo 2027',
    arrivalAirport: 'Milano Malpensa',
    arrivalAirportCode: 'MXP',
    arrivalTerminal: 'T1',
    arrivalTime: '06:30',
    arrivalDate: '20 marzo 2027',
    duration: '11h 35m',
    baggageInfo: 'Ritiro bagagli finale a Malpensa',
    notes: [
      'Rientro al T3 entro le 22:45 del 19 marzo',
      'Apre check-in ore 23:15, controlli di sicurezza e dogana',
      'Decollo 02:15, notte in volo con arrivo all\'alba a Milano'
    ]
  }
];

export const BEIJING_TRANSIT_BUDGET = [
  { item: 'Airport Express A/R (PEK - Dongzhimen)', cny: '50 CNY', eur: '6,70 €', notes: '25 CNY a tratta, 20-25 min' },
  { item: 'Metro in città', cny: '10 - 20 CNY', eur: '1,50 - 2,70 €', notes: 'Linea 2 fino a Qianmen, circa 3 CNY a corsa' },
  { item: 'Deposito bagagli T3 (se serve)', cny: '20 - 40 CNY', eur: '2,70 - 5,40 €', notes: 'Solo se le valigie non vanno dirette a Milano' },
  { item: 'Cena con Anatra Laccata (condivisa)', cny: '80 - 150 CNY', eur: '11 - 20 €', notes: 'Quanjude Qianmen o Siji Minfu condivisa' },
  { item: 'Snack, tè e bevande', cny: '30 - 50 CNY', eur: '4 - 6,70 €', notes: 'Street food economico' }
];

export const PDF_BUDGET_ESTIMATES = [
  { category: 'Serate e Nightlife (Fascia consigliata)', detail: 'Circa 16 serate tra strada, noraebang, pocha e locali per studenti a Sinchon e Kondae. Fascia consigliata: 220-300 € a testa per tutto il soggiorno (fascia stretta 150-200 €, larga 350-450 €)', totalPerPerson: '220 - 300 €', groupTotal: '880 - 1.200 €' },
  { category: 'Trasporti Locali Seul (Solo T-Money)', detail: 'T-money ricaricabile per metro e bus urbani (~30-35 €) e treno AREX all-stop (6.000 KRW / ~4 € a tratta). Malpensa Express rimosso su richiesta', totalPerPerson: '35 - 45 €', groupTotal: '140 - 180 €' },
  { category: 'Gite Fuori Porta Economiche', detail: 'Treni regionali/metro per Incheon (Linea 1, ~3 € A/R) e Suwon (~4 € A/R)', totalPerPerson: '10 - 15 €', groupTotal: '40 - 60 €' },
  { category: 'Attività & Ingressi (Strategia Risparmio)', detail: 'Noleggio Hanbok (~12-15 €) che AZZERA il costo dei biglietti dei palazzi reali (gratis!), passeggiate gratuite Namsan e Bukhansan, noraebang pomeridiano economico (~6 €)', totalPerPerson: '25 - 40 €', groupTotal: '100 - 160 €' },
  { category: 'Scalo Pechino 240h (Frugale)', detail: 'Metro Linea 2 e Airport Express, cena street food condivisa a Qianmen (120-160 CNY)', totalPerPerson: '15 - 25 €', groupTotal: '60 - 100 €' },
  { category: 'Cibo, Mercati Tradizionali & Spesa', detail: 'Colazioni in alloggio con spesa supermercato, pranzi street food nei mercati autentici (Mangwon e Gwangjang, 3-5 € a pasto) e ramyeon tipico', totalPerPerson: '120 - 160 €', groupTotal: '480 - 640 €' }
];

export const INITIAL_EXPENSES: ExpenseItem[] = [];

export const PRE_TRIP_CHECKLIST = [
  { id: 'ch_1', label: 'Passaporto valido almeno 6 mesi dopo il rientro (scadenza oltre fine settembre 2027)', category: 'Documenti', required: true },
  { id: 'ch_2', label: 'Verifica transito 240h a Pechino per cittadini italiani (ambasciata cinese o Air China)', category: 'Documenti', required: true },
  { id: 'ch_3', label: 'Stampa e salvataggio offline del biglietto Pechino - Milano per il banco transito 240h', category: 'Documenti', required: true },
  { id: 'ch_4', label: 'Power bank con marchio 3C e specifiche ben leggibili (vietato in stiva, rischio sequestro!)', category: 'Tecnologia', required: true },
  { id: 'ch_5', label: 'eSIM dati con roaming europeo/italiano per bypassare il firewall a Pechino (Google, WhatsApp, Instagram)', category: 'Tecnologia', required: true },
  { id: 'ch_6', label: 'Installazione Naver Map sul telefono (Google Maps non ha navigazione pedonale funzionante in Corea)', category: 'App', required: true },
  { id: 'ch_7', label: 'Installazione Alipay Tour Pass o WeChat Pay con carta collegata per i pagamenti a Pechino', category: 'Pagamenti', required: true },
  { id: 'ch_8', label: 'Acquisto contanti: circa 200-300 CNY a persona e prima somma in KRW', category: 'Pagamenti', required: false },
  { id: 'ch_9', label: 'Compilazione Arrival Card online Cina su s.nia.gov.cn (nelle 24h prima dell\'atterraggio a Pechino)', category: 'Cina', required: true },
  { id: 'ch_10', label: 'Prenotazione online accesso a Piazza Tiananmen (almeno 24h prima)', category: 'Cina', required: true },
  { id: 'ch_11', label: 'Valigie pesate: massimo 23 kg a testa (Air China è severa)', category: 'Bagagli', required: true },
  { id: 'ch_12', label: 'Giacca pesante per lo scalo a Pechino: la sera la temperatura scende a 0 - 8 °C', category: 'Abbigliamento', required: true }
];

export const ITINERARY_DAYS: ItineraryDay[] = [
  {
    id: 0,
    dateStr: "1 marzo 2027",
    dayOfWeek: "Lunedì",
    phase: "Partenza",
    title: "Ritrovo a Malpensa e volo Air China",
    subtitle: "Ritrovo al T1 entro le 10:00 · decollo alle 12:30",
    description: "Ritrovo al Terminal 1 di Malpensa davanti ai banchi Air China entro le 10:00. Check-in e bagagli tutti insieme, poi decollo per Pechino e per Seul (arrivo a Incheon il 2 marzo alle 11:40).",
    schedule: [
      { time: "Prima", summary: "Arrivare al T1 entro le 10:00", activity: "Ognuno verifica il proprio mezzo e l'orario di arrivo a Malpensa, tenendo come obiettivo l'arrivo al T1 entro le 10:00. Condividere nel gruppo orari di treno o volo e un numero di telefono raggiungibile." },
      { time: "Da Milano Centrale", summary: "Malpensa Express subito", activity: "Malpensa Express (cartelli 'Malpensa Express / Aeroporti'): circa 50 minuti, biglietto circa 15 €, meglio comprarlo in anticipo sull'app Trenord. Treni consigliati: 8:25 (arrivo al T1 verso le 9:16) oppure 8:55 (arrivo verso le 9:46)." },
      { time: "Chi arriva in aereo", summary: "Ritiro bagaglio e poi a piedi al T1", activity: "Chi atterra a Malpensa (per esempio con Wizz Air, che opera dal T1) ritira l'eventuale bagaglio in stiva e va a piedi alle partenze T1." },
      { time: "Entro le 10:00", summary: "Ritrovo al T1, banchi Air China", activity: "RITROVO a T1 partenze, banchi Air China. Chi arriva prima aspetta e tiene d'occhio il tabellone. Il check-in apre circa 3 ore prima del volo (12:30, da riconfermare).", isHighlight: true },
      { time: "10:00 - 10:45", summary: "Check-in e consegna bagagli insieme", activity: "Check-in e consegna bagagli (23 kg inclusi), tutti insieme. Chiedere le carte d'imbarco di tutti i tratti e se le valigie sono etichettate fino a Seul." },
      { time: "10:45 - 11:45", summary: "Sicurezza, passaporto, pranzo", activity: "Controlli di sicurezza e passaporto, colazione o pranzo, poi gate." },
      { time: "12:30", summary: "Decollo per Pechino", activity: "Decollo per la Cina e poi Seul (arrivo a Incheon il 2 marzo alle 11:40).", isHighlight: true }
    ],
    bulletPoints: [
      "Arrivare al T1 entro le 10:00: è la regola d'oro",
      "Se un treno o un volo ritarda: avvisare subito il gruppo e prendere il mezzo successivo",
      "Se il biglietto indica un altro terminal, il ritrovo si sposta lì",
      "Chi atterra a Malpensa ritira il bagaglio e va a piedi alle partenze T1"
    ],
    costsEstimate: "Malpensa Express circa 15 € a testa",
    locationIds: ["mxp_terminal1", "milano_centrale"],
    tags: ["Partenza", "Voli", "Malpensa", "Air China"],
    tips: [
      "Condividere nel gruppo orari e numero di telefono prima di partire."
    ]
  },
  {
    id: 1,
    dateStr: "2 marzo 2027",
    dayOfWeek: "Martedì",
    phase: "Prima settimana",
    title: "Scalo a Pechino e arrivo a Seul",
    subtitle: "Pechino alle 05:35 · Incheon alle 11:40 (ora di Seul)",
    description: "Atterraggio a Pechino alle 05:35 e secondo volo alle 08:40: 3 ore e 5 minuti di scalo. Bastano se si hanno già le carte d'imbarco di entrambi i voli e si segue subito 'International Transfer', senza uscire dall'aeroporto e senza usare il transito 240h. A Incheon alle 11:40 si prende l'AREX per il centro, poi check-in, spesa, SIM o eSIM e T-money.",
    schedule: [
      { time: "05:35", summary: "Atterraggio a Pechino, Terminal 3", activity: "Atterraggio a Pechino (PEK), Terminal 3. Sbarco e indicazioni 'International Transfer'.", isHighlight: true },
      { time: "05:50 - 06:30", summary: "Controllo di transito", activity: "Controllo di sicurezza di transito e controllo delle carte d'imbarco. Se mancano quelle del secondo volo, rivolgersi subito al banco transiti Air China." },
      { time: "06:30 - 07:30", summary: "Tempo cuscinetto", activity: "Tempo cuscinetto: colazione, bagno, telefoni in carica, ricerca del gate (a PEK i gate possono essere lontani, a volte con navetta interna)." },
      { time: "07:30 - 08:00", summary: "Arrivo al gate", activity: "Arrivo al gate. L'imbarco inizia circa 40 minuti prima della partenza." },
      { time: "08:40", summary: "Decollo per Incheon", activity: "Decollo per Incheon (volo di circa 2 ore).", isHighlight: true },
      { time: "11:40 (Seul)", summary: "Atterraggio a Incheon", activity: "Atterraggio a Incheon. Orologio avanti di 1 ora.", isHighlight: true },
      { time: "11:40 - 13:15", summary: "Passaporti, bagagli, SIM e T-money", activity: "Controlli passaporti, ritiro bagagli, SIM o eSIM e T-money." },
      { time: "13:15 - 14:45", summary: "AREX fino in città", activity: "AREX in città (circa 60 minuti), poi trasferimento con le valigie fino all'alloggio." },
      { time: "14:45 - 16:00", summary: "Check-in alle 16:00", activity: "Check-in alle 16:00 (anticipato da chiedere all'host), oppure deposito bagagli e pranzo tardivo." },
      { time: "Pomeriggio", summary: "Check-in e spesa", activity: "Check-in, spesa al supermercato, SIM o eSIM e T-money." },
      { time: "Sera", summary: "Prima passeggiata a Hongdae", activity: "Prima passeggiata a Hongdae con street food: serata corta per il fuso orario (circa 10 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Scalo di 3h05 a Pechino: 'International Transfer', senza uscire e senza transito 240h",
      "Se il primo volo ritarda fino a circa un'ora, lo scalo regge",
      "Verificare che i due voli siano nella stessa prenotazione: con un biglietto unico la compagnia riprotegge la coincidenza",
      "Check-in alle 16:00: chiedere all'host l'anticipo o il deposito bagagli"
    ],
    costsEstimate: "Circa 10 € (AREX e street food serale)",
    locationIds: ["beijing_airport_t3", "incheon_airport", "acc_c", "hongdae_district"],
    tags: ["Scalo", "Pechino", "Arrivo", "AREX", "Alloggio", "T-money"],
    tips: [
      "Prendere la T-money in aeroporto o al convenience store (GS25 o CU) e caricarla con contanti."
    ]
  },
  {
    id: 2,
    dateStr: "3 marzo 2027",
    dayOfWeek: "Mercoledì",
    phase: "Prima settimana",
    title: "VALORANT MASTERS SEOUL 2027 (sede da annunciare)",
    subtitle: "Evento esports clou del viaggio · sede e orari in attesa di annuncio",
    description: "Giornata dedicata al Valorant Masters Seoul 2027, il cui torneo va dal 20 febbraio al 3 marzo. Sede, orari della finale e biglietti non sono ancora pubblicati: la giornata resta riservata e il piano va aggiornato appena escono le informazioni.",
    schedule: [
      { time: "Mattina", summary: "Mattina libera", activity: "Mattina libera." },
      { time: "Poi", summary: "Valorant Masters: orari da confermare", activity: "VALORANT MASTERS SEOUL 2027: orari e sede da confermare, in attesa dell'annuncio ufficiale.", isHighlight: true },
      { time: "Dopo", summary: "Cena e pocha a Hongdae", activity: "Cena e pocha a Hongdae per chiudere la serata insieme (circa 15 €)." }
    ],
    bulletPoints: [
      "Giornata riservata: sede, orari della finale e biglietti da verificare",
      "Aggiornare il piano appena Riot Games pubblica le informazioni",
      "Dopo l'evento: pocha a Hongdae per chiudere insieme la serata"
    ],
    costsEstimate: "Circa 15 € (cena e pocha), biglietti da verificare",
    locationIds: ["valorant_masters_arena", "hongdae_district"],
    tags: ["Valorant", "Esports", "Hongdae"],
    isSpecialEvent: true,
    tips: [
      "Il torneo è riservato nel calendario: non prenotare altri impegni per quel giorno."
    ]
  },
  {
    id: 3,
    dateStr: "4 marzo 2027",
    dayOfWeek: "Giovedì",
    phase: "Prima settimana",
    title: "Palazzi e Gangnam",
    subtitle: "Gyeongbokgung in hanbok, Bukchon e serata a Gangnam",
    description: "Mattina a Gyeongbokgung con hanbok (ingresso gratis col noleggio) e Bukchon. Pomeriggio di riposo. Sera a Gangnam, di giovedì perché costa meno (circa 30-35 €): zona più adulta e più cara, da fare una volta sola. Per chi non può entrare nei club, alternativa decisa prima nella stessa zona.",
    schedule: [
      { time: "Mattina", summary: "Gyeongbokgung in hanbok e Bukchon", activity: "Gyeongbokgung con hanbok (ingresso gratis col noleggio) e Bukchon." },
      { time: "Pomeriggio", summary: "Riposo", activity: "Rientro per riposare." },
      { time: "Sera", summary: "Gangnam (circa 30-35 €)", activity: "Gangnam, di giovedì perché costa meno (circa 30-35 €). Zona più adulta e più cara: alternativa decisa prima per chi non entra nei club.", isHighlight: true }
    ],
    bulletPoints: [
      "Hanbok col noleggio: ingresso gratis ai palazzi",
      "Bukchon per le case tradizionali: rispettare i residenti",
      "Gangnam di giovedì: costa meno che nel weekend",
      "Decidere prima l'alternativa per chi non entra nei club"
    ],
    costsEstimate: "Circa 30-35 € a testa (serata Gangnam)",
    locationIds: ["gyeongbokgung", "bukchon_hanok", "gangnam_district"],
    tags: ["Palazzi", "Hanbok", "Gangnam"]
  },
  {
    id: 4,
    dateStr: "5 marzo 2027",
    dayOfWeek: "Venerdì",
    phase: "Prima settimana",
    title: "Seongsu e venerdì a Hongdae",
    subtitle: "Seongsu-dong e Seoul Forest, poi serata a Hongdae",
    description: "Giornata a Seongsu-dong e Seoul Forest, gratis. Sera a Hongdae: il venerdì è pieno, con strada, photo booth, sala giochi e una live house per chi vuole musica dal vivo (circa 20 €).",
    schedule: [
      { time: "Giorno", summary: "Seongsu-dong e Seoul Forest", activity: "Seongsu-dong e Seoul Forest (gratis)." },
      { time: "Sera", summary: "Hongdae: strada, sala giochi, live house", activity: "Hongdae: strada, photo booth, sala giochi e live house per chi vuole musica dal vivo (circa 20 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Seongsu-dong e Seoul Forest, gratis",
      "Hongdae il venerdì: piena di gente",
      "Live house per chi vuole musica dal vivo"
    ],
    costsEstimate: "Circa 20 € a testa",
    locationIds: ["seongsu_dong", "seoul_forest", "hongdae_district"],
    tags: ["Seongsu", "Hongdae", "Live house"]
  },
  {
    id: 5,
    dateStr: "6 marzo 2027",
    dayOfWeek: "Sabato",
    phase: "Prima settimana",
    title: "Mercati e serata leggera",
    subtitle: "Gwangjang, Cheonggyecheon, DDP e serata corta",
    description: "Mercato di Gwangjang, Cheonggyecheon e DDP. Sera corta con cena, noraebang e sala giochi. A letto entro mezzanotte: domani sveglia alle 5:15 (circa 12 €).",
    schedule: [
      { time: "Giorno", summary: "Gwangjang, Cheonggyecheon, DDP", activity: "Mercato di Gwangjang, Cheonggyecheon e DDP." },
      { time: "Sera", summary: "Cena, noraebang e sala giochi", activity: "Cena, noraebang e sala giochi: serata corta. A letto entro mezzanotte, domani sveglia alle 5:15 (circa 12 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Mercato di Gwangjang",
      "Passeggiata lungo Cheonggyecheon",
      "DDP per la sera e le luci",
      "Serata corta: a letto entro mezzanotte"
    ],
    costsEstimate: "Circa 12 € a testa",
    locationIds: ["gwangjang_market", "cheonggyecheon", "ddp_dongdaemun"],
    tags: ["Mercati", "Noraebang", "Serata leggera"]
  },
  {
    id: 6,
    dateStr: "7 marzo 2027",
    dayOfWeek: "Domenica",
    phase: "Prima settimana",
    title: "Tour DMZ e Itaewon",
    subtitle: "Tour DMZ di mezza giornata e serata internazionale a Itaewon",
    description: "Tour DMZ di mezza giornata (7 ore, 45 € a testa). Ritrovo alle 6:45 alla metro Myeongdong, uscita 5, partenza alle 7:00. Rientro verso le 14:00-14:30, pranzo tardivo e riposo. Sera a Itaewon, più tranquilla di domenica e meno cara della settimana: musica hip hop e latina, locali con cucina (circa 25-30 €).",
    schedule: [
      { time: "5:15", summary: "Sveglia presto", activity: "Sveglia, colazione veloce, passaporto in tasca (obbligatorio).", isHighlight: true },
      { time: "6:00", summary: "Uscita e metro", activity: "Uscita dall'alloggio. In metro circa 25-35 minuti con un cambio (percorso da confermare su Naver Map, prime corse verso le 5:30)." },
      { time: "6:45", summary: "Ritrovo a Myeongdong, uscita 5", activity: "Arrivo alla metro Myeongdong, uscita 5 (all'esterno), 15 minuti prima della partenza.", isHighlight: true },
      { time: "7:00", summary: "Partenza del tour DMZ", activity: "Partenza del tour (guida in inglese; ingressi e trasporto inclusi)." },
      { time: "14:00 - 14:30", summary: "Rientro a Myeongdong", activity: "Rientro a Myeongdong (stima: la pagina del tour non indica l'ora di ritorno)." },
      { time: "Pomeriggio", summary: "Pranzo tardivo e riposo", activity: "Pranzo tardivo e riposo in alloggio." },
      { time: "Sera", summary: "Itaewon: cena e musica", activity: "Itaewon: zona più internazionale della città, musica hip hop e latina, locali con cucina dove si entra per cenare (circa 25-30 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Tour DMZ: prenotare con cancellazione gratuita fino a 24 ore prima",
      "Portare il passaporto: nome e numero di tutti e quattro",
      "Se la DMZ è chiusa, l'operatore propone un tour alternativo",
      "Piano B: martedì 9 marzo"
    ],
    costsEstimate: "Tour DMZ 45 € a testa, Itaewon circa 25-30 €",
    locationIds: ["dmz_imjingak", "myeongdong", "itaewon"],
    tags: ["DMZ", "Tour", "Itaewon"],
    tips: [
      "Aspettare che le date si aprano (di solito 2-3 mesi prima) e verificare che il tour parta di domenica.",
      "Prenotare quando è noto l'orario del Valorant del 3 marzo."
    ]
  },
  {
    id: 7,
    dateStr: "8 marzo 2027",
    dayOfWeek: "Lunedì",
    phase: "Prima settimana",
    title: "Namsan e language exchange",
    subtitle: "Namsan a piedi, Myeongdong e Insadong, poi incontro di scambio linguistico",
    description: "Mattina libera. Pomeriggio con Namsan a piedi (gratis), Myeongdong e Insadong (circa 10 €). Sera con un language exchange (Meetup o HelloTalk), il modo più naturale per conoscere gente del posto (circa 10 €).",
    schedule: [
      { time: "Mattina", summary: "Mattina libera", activity: "Mattina libera." },
      { time: "Pomeriggio", summary: "Namsan a piedi, Myeongdong e Insadong", activity: "Namsan a piedi (gratis), Myeongdong e Insadong (circa 10 €)." },
      { time: "Sera", summary: "Language exchange", activity: "Language exchange (Meetup o HelloTalk), il modo più naturale per fare conoscenze (circa 10 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Namsan: salita a piedi, gratis",
      "Insadong per l'artigianato tradizionale",
      "Language exchange per conoscere persone del posto"
    ],
    costsEstimate: "Circa 10 € a testa",
    locationIds: ["namsan_tower", "myeongdong", "insadong"],
    tags: ["Namsan", "Language exchange"]
  },
  {
    id: 8,
    dateStr: "9 marzo 2027",
    dayOfWeek: "Martedì",
    phase: "Prima settimana",
    title: "Museo e serata di saluti",
    subtitle: "National Museum of Korea, valigie pronte e ultima uscita in quattro",
    description: "Museo nazionale (gratis). Pomeriggio: la valigia di chi riparte è pronta, con peso controllato (massimo 23 kg). Sera: ultima uscita in quattro nella zona di Kondae, con cena e pocha, rientro entro le 22:30 (circa 15 €). Domani sveglia molto presto.",
    schedule: [
      { time: "Giorno", summary: "National Museum of Korea", activity: "National Museum of Korea (gratis)." },
      { time: "Pomeriggio", summary: "Valigia pronta e pesata", activity: "La valigia di chi riparte è pronta, con peso controllato (massimo 23 kg)." },
      { time: "Sera", summary: "Ultima uscita a Kondae, rientro entro le 22:30", activity: "Ultima uscita in quattro nella zona di Kondae: cena e pocha, rientro entro le 22:30 (circa 15 €). Domani sveglia molto presto.", isHighlight: true }
    ],
    bulletPoints: [
      "Valigia di chi riparte: massimo 23 kg",
      "Ultima uscita in quattro: rientro entro le 22:30",
      "Domani sveglia molto presto"
    ],
    costsEstimate: "Circa 15 € a testa",
    locationIds: ["national_museum", "kondae_konkuk"],
    tags: ["Museo", "Saluti", "Kondae"]
  },
  {
    id: 9,
    dateStr: "10 marzo 2027",
    dayOfWeek: "Mercoledì",
    phase: "Seconda settimana",
    title: "Una persona riparte e giornata a Incheon",
    subtitle: "Chi riparte lascia l'alloggio alle 5:45-6:00 · chi resta gira Chinatown e Wolmido",
    description: "Chi riparte lascia l'alloggio presto per essere a Incheon circa 3 ore prima del volo delle 11:10 (AREX verso le 5:30, da verificare). Chi resta torna a dormire e fa colazione con calma. Pomeriggio a Chinatown e Wolmido, a Incheon, circa un'ora di treno. Sera a Hongdae con cena e serata tranquilla.",
    schedule: [
      { time: "5:45 - 6:00", summary: "Chi riparte lascia l'alloggio", activity: "Chi riparte lascia l'alloggio per essere a Incheon circa 3 ore prima del volo delle 11:10 (AREX verso le 5:30, da verificare). Alternativa: taxi o bus aeroporto.", isHighlight: true },
      { time: "Mattina", summary: "Chi resta torna a dormire", activity: "Chi resta torna a dormire e fa colazione con calma. Avvisare l'host che restano meno ospiti (prezzo invariato, da confermare)." },
      { time: "Pomeriggio", summary: "Chinatown e Wolmido a Incheon", activity: "Chinatown e Wolmido a Incheon, circa un'ora di treno." },
      { time: "Sera", summary: "Cena e serata tranquilla a Hongdae", activity: "Rientro per cena e serata tranquilla a Hongdae (circa 12 €)." }
    ],
    bulletPoints: [
      "Chi riparte arriva a Malpensa l'11 marzo alle 6:30",
      "Chi resta: quattro diventano tre, il prezzo dell'alloggio non cambia",
      "Il gruppo passa a tre persone: si decide insieme la serata"
    ],
    costsEstimate: "Circa 12 € a testa",
    locationIds: ["incheon_chinatown_wolmido", "hongdae_district"],
    tags: ["Partenza", "Incheon", "Chinatown"]
  },
  {
    id: 10,
    dateStr: "11 marzo 2027",
    dayOfWeek: "Giovedì",
    phase: "Seconda settimana",
    title: "COEX e Sinchon",
    subtitle: "Starfield Library, Bongeunsa e serata universitaria",
    description: "Mattina al COEX, con la Starfield Library e Bongeunsa. Sera a Sinchon: zona universitaria, birre grandi a 4.000-5.000 KRW, locali economici e molta gente della stessa età (circa 15 €).",
    schedule: [
      { time: "Giorno", summary: "Starfield Library e Bongeunsa", activity: "Starfield Library (COEX) e il tempio Bongeunsa." },
      { time: "Sera", summary: "Sinchon, birre e locali economici", activity: "Sera a Sinchon: zona universitaria, birre grandi 4.000-5.000 KRW, locali economici e molta gente della stessa età (circa 15 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Starfield Library: una delle librerie più fotografate",
      "Sinchon per una serata economica e giovane"
    ],
    costsEstimate: "Circa 15 € a testa",
    locationIds: ["coex_starfield", "bongeunsa_temple", "sinchon"],
    tags: ["COEX", "Sinchon", "Serata"]
  },
  {
    id: 11,
    dateStr: "12 marzo 2027",
    dayOfWeek: "Venerdì",
    phase: "Seconda settimana",
    title: "Gita a Suwon",
    subtitle: "Fortezza di Hwaseong e rientro in tempo per l'ultima metro",
    description: "Fortezza di Hwaseong a Suwon. La zona di locali dovrebbe essere Ingye-dong (da verificare). Rientro in tempo per l'ultima metro, poi serata breve in zona (circa 12 €).",
    schedule: [
      { time: "Giorno", summary: "Fortezza di Hwaseong", activity: "Fortezza di Hwaseong. La zona di locali dovrebbe essere Ingye-dong (da verificare)." },
      { time: "Sera", summary: "Rientro per l'ultima metro", activity: "Rientro in tempo per l'ultima metro, poi serata breve in zona (circa 12 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Fortezza di Hwaseong: visita della giornata",
      "Controllare l'ultima metro per il rientro"
    ],
    costsEstimate: "Circa 12 € a testa",
    locationIds: ["suwon_hwaseong", "suwon_ingyedong"],
    tags: ["Gita", "Suwon"]
  },
  {
    id: 12,
    dateStr: "13 marzo 2027",
    dayOfWeek: "Sabato",
    phase: "Seconda settimana",
    title: "Serata grande a Hongdae",
    subtitle: "Il sabato è la serata più affollata della settimana",
    description: "Il sabato è la serata più affollata della settimana. Strada e busking fino a tardi, poi club per chi vuole e piano comune per gli altri (circa 20-30 €).",
    schedule: [
      { time: "Giorno", summary: "Giornata libera", activity: "Giornata libera o seconda visita a una zona piaciuta." },
      { time: "Sera", summary: "Hongdae: strada, busking, club", activity: "Strada e busking fino a tardi, poi club per chi vuole e piano comune per gli altri (circa 20-30 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Il sabato è il giorno più affollato della settimana",
      "Stabilire prima il punto di ritrovo e l'ora del rientro"
    ],
    costsEstimate: "Circa 20-30 € a testa",
    locationIds: ["hongdae_district"],
    tags: ["Hongdae", "Serata"]
  },
  {
    id: 13,
    dateStr: "14 marzo 2027",
    dayOfWeek: "Domenica",
    phase: "Seconda settimana",
    title: "White Day",
    subtitle: "Festa tipica coreana sul fiume Han e serata leggera",
    description: "Festa tipica coreana. Pomeriggio sul fiume Han con ramyeon dei convenience store (a marzo fa freddo: vestirsi bene). Sera leggera dopo il sabato (circa 8 €).",
    schedule: [
      { time: "Pomeriggio", summary: "Fiume Han con ramyeon", activity: "Pomeriggio sul fiume Han con ramyeon dei convenience store. A marzo fa freddo: vestirsi bene." },
      { time: "Sera", summary: "Serata leggera", activity: "Sera leggera dopo il sabato (circa 8 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Il fiume Han con ramyeon dei convenience store",
      "A marzo fa freddo: vestirsi bene"
    ],
    costsEstimate: "Circa 8 € a testa",
    locationIds: ["yeouido_hangang_park"],
    tags: ["White Day", "Han", "Serata leggera"]
  },
  {
    id: 14,
    dateStr: "15 marzo 2027",
    dayOfWeek: "Lunedì",
    phase: "Seconda settimana",
    title: "Giornata libera",
    subtitle: "Riposo, shopping o una zona piaciuta da rivedere",
    description: "Giornata libera: riposo, shopping o una zona piaciuta da rivedere. Sera con un language exchange, utile per riempire le ultime serate con persone già conosciute.",
    schedule: [
      { time: "Giorno", summary: "Riposo o shopping", activity: "Giornata libera: riposo, shopping o una zona piaciuta da rivedere." },
      { time: "Sera", summary: "Language exchange", activity: "Language exchange, utile per riempire le ultime serate con persone già conosciute.", isHighlight: true }
    ],
    bulletPoints: [
      "Giornata libera: nessun impegno fisso"
    ],
    locationIds: [],
    tags: ["Libero", "Language exchange"]
  },
  {
    id: 15,
    dateStr: "16 marzo 2027",
    dayOfWeek: "Martedì",
    phase: "Ultima parte",
    title: "Bukhansan e Yeonnam",
    subtitle: "Bukhansan a piedi, poi pocha a Yeonnam-dong",
    description: "Bukhansan a piedi (gratis). Sera a Yeonnam-dong, a due passi da Hongdae ma più tranquilla ed economica (circa 12 €).",
    schedule: [
      { time: "Giorno", summary: "Bukhansan a piedi", activity: "Bukhansan a piedi (gratis)." },
      { time: "Sera", summary: "Pocha a Yeonnam-dong", activity: "Pocha a Yeonnam-dong, a due passi da Hongdae ma più tranquilla ed economica (circa 12 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Bukhansan: escursione gratuita",
      "Yeonnam-dong: più tranquilla di Hongdae"
    ],
    costsEstimate: "Circa 12 € a testa",
    locationIds: ["bukhansan_national_park"],
    tags: ["Bukhansan", "Pocha"]
  },
  {
    id: 16,
    dateStr: "17 marzo 2027",
    dayOfWeek: "Mercoledì",
    phase: "Ultima parte",
    title: "Souvenir e ultima serata grande",
    subtitle: "Olive Young e Dongdaemun, poi serata a Hongdae con le persone conosciute",
    description: "Souvenir e skincare (Olive Young, Dongdaemun). Sera: ultima serata grande a Hongdae, con le persone conosciute durante il viaggio (circa 20-25 €).",
    schedule: [
      { time: "Giorno", summary: "Souvenir e skincare", activity: "Souvenir e skincare: Olive Young, Dongdaemun." },
      { time: "Sera", summary: "Ultima serata grande a Hongdae", activity: "Ultima serata grande a Hongdae, con le persone conosciute durante il viaggio (circa 20-25 €).", isHighlight: true }
    ],
    bulletPoints: [
      "Olive Young per la skincare coreana",
      "Ultima serata grande: rientro con calma"
    ],
    costsEstimate: "Circa 20-25 € a testa",
    locationIds: ["olive_young_flagship", "ddp_dongdaemun", "hongdae_district"],
    tags: ["Souvenir", "Hongdae", "Ultima serata"]
  },
  {
    id: 17,
    dateStr: "18 marzo 2027",
    dayOfWeek: "Giovedì",
    phase: "Ultima parte",
    title: "Ultimo giorno pieno e preparazione",
    subtitle: "Valigie pesate, modulo d'ingresso per la Cina e serata corta",
    description: "Ultimo giorno pieno, serata corta di saluti: domani sveglia alle 6:30. Pomeriggio con valigie pronte e pesate (massimo 23 kg), power bank e liquidi nello zaino. Online: modulo d'ingresso per la Cina (Arrival Card, da compilare nelle 24 ore prima dell'atterraggio a Pechino) e prenotazione di Piazza Tiananmen.",
    schedule: [
      { time: "Pomeriggio", summary: "Valigie pronte e pesate", activity: "Valigie pronte e pesate (massimo 23 kg), power bank e liquidi nello zaino." },
      { time: "Online", summary: "Arrival Card e prenotazione Tiananmen", activity: "Modulo d'ingresso per la Cina (Arrival Card) sul sito ufficiale, compilabile dalle 15:20 ora di Seul del 18 marzo, fino alla mattina del 19. Prenotazione di Piazza Tiananmen (almeno un giorno prima). Screenshot di biglietti e mappe offline.", isHighlight: true },
      { time: "Sera", summary: "Serata corta di saluti", activity: "Serata corta di saluti: domani sveglia alle 6:30." }
    ],
    bulletPoints: [
      "Arrival Card: compilare nelle 24 ore prima dell'atterraggio",
      "Valigie: massimo 23 kg a testa",
      "Screenshot di biglietti e mappe offline"
    ],
    locationIds: [],
    tags: ["Preparazione", "Arrival Card", "Bagagli"],
    tips: [
      "Il modulo ha un codice QR: salvarlo o farne uno screenshot."
    ]
  },
  {
    id: 18,
    dateStr: "19 marzo 2027",
    dayOfWeek: "Venerdì",
    phase: "Ultima parte",
    title: "Partenza da Seul e serata a Pechino",
    subtitle: "Check-out alle 7:30, volo CA124 alle 13:10, transito 240h a Pechino",
    description: "Mattina a Seul: check-out alle 7:30, colazione fuori, AREX per Incheon, volo CA124 alle 13:10 (pasto a bordo). Pomeriggio e sera a Pechino con il permesso di transito di 240 ore: atterraggio alle 14:20, serata in centro (Qianmen, anatra laccata, passeggiata) e rientro al Terminal 3 entro le 22:45. Volo CA949 alle 02:15, arrivo a Malpensa alle 06:30 del 20 marzo.",
    schedule: [
      { time: "6:30 (Seul)", summary: "Sveglia e valigie", activity: "Sveglia e ultime cose in valigia (la colazione si fa fuori)." },
      { time: "7:00 - 7:30 (Seul)", summary: "Check-out", activity: "Giro dell'appartamento: spazzatura, foto delle stanze, chiavi o codice come da istruzioni Enko. Check-out.", isHighlight: true },
      { time: "8:30 - 9:30 (Seul)", summary: "AREX fino a Incheon", activity: "AREX (treno all-stop, si paga con T-money) fino a Incheon. Circa 50-60 minuti; verificare se Air China parte dal T1 o dal T2." },
      { time: "10:10 - 10:40 (Seul)", summary: "Check-in Air China", activity: "Check-in Air China (apre circa 3 ore prima). Chiedere: 1) valigie etichettate fino a Milano (MXP); 2) entrambe le carte d'imbarco (Incheon-Pechino e Pechino-Milano), che servono al banco transito 240h.", isHighlight: true },
      { time: "12:40 (Seul)", summary: "Imbarco", activity: "Imbarco: verificare gate e orario sulla carta d'imbarco." },
      { time: "13:10 (Seul)", summary: "Decollo per Pechino", activity: "Decollo. Spostare l'orologio indietro di 1 ora. Pasto in volo da confermare con Air China.", isHighlight: true },
      { time: "14:20 (Pechino)", summary: "Atterraggio a Pechino, T3", activity: "Atterraggio a Pechino, Terminal 3: seguire 'Transit 240h'.", isHighlight: true },
      { time: "14:30 - 16:30", summary: "Banco transito 240h", activity: "Banco transito 240h: mostrare passaporto, carta d'imbarco o prenotazione Pechino-Milano, QR della Arrival Card ed eventuale prenotazione hotel. Controllo passaporti e dogana: prevedere 1-2 ore." },
      { time: "17:00", summary: "Airport Express fino a Dongzhimen", activity: "Airport Express (25 CNY, 20-25 min) fino a Dongzhimen, poi Metro Linea 2 fino a Qianmen (circa 3 CNY)." },
      { time: "18:00 - 19:00", summary: "Qianmen e Dashilar al tramonto", activity: "Via pedonale di Qianmen e Dashilar, tramonto." },
      { time: "19:00 - 20:30", summary: "Cena con anatra laccata", activity: "Cena con anatra laccata (Quanjude Qianmen, Siji Minfu o simili). Tiananmen illuminata se serve prenotazione, o hutong." },
      { time: "21:15", summary: "Partenza per l'aeroporto", activity: "Partenza per l'aeroporto (ultimo Airport Express da Dongzhimen circa alle 22:30, da verificare).", isHighlight: true },
      { time: "22:15 - 22:45", summary: "Arrivo al Terminal 3", activity: "Arrivo al Terminal 3 per il volo di rientro." },
      { time: "23:15", summary: "Check-in Air China", activity: "Apre il check-in Air China, bagagli e controlli." },
      { time: "02:15 (20 Mar)", summary: "Decollo per Milano", activity: "Decollo per Milano (CA949).", isHighlight: true }
    ],
    bulletPoints: [
      "Verificare che il transito 240h valga a marzo 2027 per gli italiani",
      "Stampare la prenotazione Pechino-Milano per il banco transito",
      "Internet: Google, WhatsApp e Instagram sono bloccati: usare eSIM o roaming",
      "Power bank con marchio 3C e giacca per la sera a 0-8 °C"
    ],
    costsEstimate: "Circa 190-310 CNY a testa (25-40 €): Airport Express, metro, cena e snack",
    locationIds: ["incheon_airport", "beijing_airport_t3", "beijing_dongzhimen", "beijing_qianmen", "beijing_tiananmen"],
    tags: ["Partenza", "Transito 240h", "Pechino", "Air China"],
    tips: [
      "Se il transito 240h non viene concesso, si resta nella zona internazionale: Air China può offrire un hotel gratuito per scali lunghi (prenotare almeno 24 ore prima, condizioni da verificare)."
    ]
  },
  {
    id: 19,
    dateStr: "20 marzo 2027",
    dayOfWeek: "Sabato",
    phase: "Ultima parte",
    title: "Rientro da Malpensa a Milano Centrale",
    subtitle: "Atterraggio alle 06:30, Malpensa Express verso le 9:00-9:30",
    description: "Atterraggio previsto alle 06:30 al Terminal 1, in tre e con tutti i bagagli. Il piano punta al Malpensa Express verso le 9:00-9:30 e a tenere i treni verso casa non prima delle 11:30. Se ci sono ritardi, non cambia nulla: si passa al treno successivo.",
    schedule: [
      { time: "06:30", summary: "Atterraggio a Malpensa", activity: "Atterraggio previsto. Dopo l'atterraggio l'aereo può impiegare 10-15 minuti per arrivare al gate. Avvisare casa che si è arrivati.", isHighlight: true },
      { time: "06:45 - 07:30", summary: "Sbarco e passaporti", activity: "Sbarco e controllo passaporti (arrivo da fuori Schengen: nelle ore di punta la coda può durare 20-45 minuti)." },
      { time: "07:30 - 08:15", summary: "Ritiro bagagli", activity: "Ritiro bagagli: aspettare tutti vicino al nastro e controllare etichette e chiusure. Se una valigia manca, fare la denuncia all'ufficio bagagli prima di uscire." },
      { time: "08:15 - 08:45", summary: "Colazione e biglietti", activity: "Colazione al T1 (5-8 €), bagno, telefoni in carica. Acquistare i biglietti del Malpensa Express sull'app Trenord (circa 15 € a testa)." },
      { time: "09:00 - 09:30", summary: "Malpensa Express per Milano", activity: "Malpensa Express per Milano Centrale (circa 50 minuti, un treno ogni 30 minuti; orari da verificare su Trenord). Se si perde il primo treno, si prende il successivo.", isHighlight: true },
      { time: "10:00 - 10:30", summary: "Arrivo a Milano Centrale", activity: "Arrivo a Milano Centrale: valigie, caffè, panino e tabellone dei treni." },
      { time: "Dalle 11:30", summary: "Treni verso casa", activity: "Treni verso casa, ognuno il suo. Meglio biglietti flessibili (cambio gratuito o tariffa base) oppure da acquistare all'arrivo a Centrale.", isHighlight: true }
    ],
    bulletPoints: [
      "Malpensa Express verso le 9:00-9:30, un treno ogni 30 minuti",
      "Treni verso casa non prima delle 11:30",
      "Se si perde il gruppo: punto di ritrovo al nastro bagagli, poi al binario del Malpensa Express"
    ],
    costsEstimate: "Malpensa Express circa 15 € a testa, colazione 5-8 €",
    locationIds: ["mxp_terminal1", "milano_centrale"],
    tags: ["Rientro", "Malpensa", "Milano Centrale", "Malpensa Express"],
    tips: [
      "Ritardo di circa 2 ore sul volo: Malpensa Express verso le 10:30, arrivo a Centrale verso le 11:30 e treni di casa dalle 12:30. Per questo i biglietti di casa non vanno presi rigidi prima di mezzogiorno.",
      "Treni di casa già acquistati: se non sono flessibili, sceglierli non prima delle 12:00-12:30.",
      "Il sabato valgono gli orari festivi di Trenord: controllarli il giorno prima."
    ]
  }
];

// I giorni di ogni tappa sulla mappa derivano dall'itinerario (locationIds dei giorni),
// così il filtro "Giorno" della mappa mostra le stesse tappe dell'itinerario.
// Gli alloggi restano legati alle notti di soggiorno.
export function recomputeLocationDays(): void {
  for (const loc of MAP_LOCATIONS) {
    if (loc.category === 'alloggio') continue;
    loc.dayNumbers = ITINERARY_DAYS.filter((d) => d.locationIds.includes(loc.id)).map((d) => d.id);
  }
}
recomputeLocationDays();
