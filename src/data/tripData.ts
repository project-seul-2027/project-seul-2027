/**
 * Dati ufficiali del viaggio di gruppo a Seul 2027 (2 - 19 Marzo 2027)
 * Basati sul documento di viaggio aggiornato "Itinerario Seul 2027" per 4 persone.
 */

export interface ScheduleItem {
  time: string;
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
  pietroCost6Nights: number;
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
  category: 'alloggio' | 'cultura' | 'nightlife' | 'food' | 'natura' | 'gita' | 'logistica';
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
  pdfPath: `${import.meta.env.BASE_URL}assets/aistudio/Itinerario_Seul_2027_fb1043a9.pdf`
};

export const SKYSCANNER_FLIGHTS_URL =
  'https://www.skyscanner.it/trasporti/voli/mila/sela/270301/270319/config/14476-2703011230--32690-1-12409-2703021140%7c12409-2703191310--32690-1-14476-2703200630?cabinclass=economy&adultsv2=1&outboundaltsenabled=false&inboundaltsenabled=false&ref=save2list';


// 4 ALLOGGI A CONFRONTO (ENKO STAY, 2-19 MARZO, 4 PERSONE)
const ACCOMMODATIONS_BASE: Omit<AccommodationOption, 'nightlyRateEur' | 'pietroCost6Nights' | 'other3Cost17Nights'>[] = [
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
      'Il più economico in assoluto: soli 106 € a testa per 17 notti (circa 80 € in meno rispetto a Mapo!)',
      'Super centrale: due bagni completi, comodissimi per 4 persone',
      'Vicinissimo a Myeongdong, al mercato di Namdaemun e alla salita per il Namsan'
    ],
    contro: [
      'Quarto piano senza ascensore (faticoso con valigie da 23 kg)',
      'Numero esatto e tipologia di letti non specificati (da chiedere conferma all\'host)',
      'Quartiere commerciale vivace di giorno ma meno attivo per la vita notturna',
      'Luce a consumo da pagare a parte a fine soggiorno'
    ],
    highlightBadge: 'Il Più Economico (106 €/testa)',
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
      'Prezzo più alto di A (659 € totali) senza offrire grandi vantaggi'
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
      'L\'alloggio più caro del gruppo (187 € a testa per 17 notti)',
      'Monolocale stretto per 4 persone con divano letto',
      'Biancheria e asciugamani non forniti (da richiedere all\'host)',
      'Niente prodotti da bagno (shampoo/bagnoschiuma)'
    ],
    highlightBadge: 'Top per Movida & Hongdae',
    highlightBadgeColor: 'pink',
    importantNotes: 'In quattro costa circa 22-27 € in più a testa rispetto a B e D, ma fa risparmiare tempo e soldi nei taxi notturni dopo le serate.'
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
 * Pietro: 6 notti divise per 4. Gli altri 3: le stesse 6 notti / 4 + le 11 notti successive / 3.
 */
export const ACCOMMODATIONS: AccommodationOption[] = ACCOMMODATIONS_BASE.map((acc) => {
  const nightly = acc.totalEur17Nights / 17;
  const sharedPart = (6 * nightly) / 4;
  return {
    ...acc,
    nightlyRateEur: Math.round(nightly),
    pietroCost6Nights: Math.round(sharedPart),
    other3Cost17Nights: Math.round(sharedPart + (11 * nightly) / 3)
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
    description: 'Opzione Enko Stay A: 106 € a testa in 4 (424 € totali per 17 notti). Il più economico. 4° piano privato, 2 bagni, cucina. Metro City Hall a 7 min.',
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
    description: 'Opzione Enko Stay B: 165 € a testa in 4 (659 € totali per 17 notti). Seminterrato ristrutturato con 2 camere, 1 bagno. A 7 min da Seoul Station (AREX e KTX).',
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
    description: 'Opzione Enko Stay C: 187 € a testa in 4 (748 € totali per 17 notti). Monolocale officetel con ascensore e lavatrice. A 1 fermata AREX da Hongdae (top per la movida).',
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
    description: 'Opzione Enko Stay D: 160 € a testa in 4 (641 € totali per 17 notti). Il più comodo per dormire: 2 camere, 3 letti queen size, cucina e soggiorno. Metro a 1 min.',
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
    description: '⚠️ ARENA NON ANCORA DECISA: La sede ufficiale del Valorant Masters Seoul 2027 deve ancora essere annunciata ufficialmente da Riot Games! Posizione sulla mappa puramente indicativa in attesa del comunicato Riot (candidate principali: Sangam e-Stadium, LoL Park Jongno, KSPO Dome o Olympic Handball Gymnasium).',
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
    dayNumbers: [0, 18],
    description: 'Punto d\'incontro del gruppo: 1 marzo ore 10:00 davanti ai banchi check-in Air China.',
    tips: 'Raggiungibile autonomamente con mezzi propri o treno ordinario.'
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
    arrivalTime: '05:30 (+1)',
    arrivalDate: '2 marzo 2027',
    duration: '10h 00m',
    layoverNotice: 'Scalo tecnico a Pechino',
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
    departureTime: '08:30',
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
    layoverNotice: 'Scalo lungo con uscita città: 14:20 -> 02:15 (circa 12 ore di sosta!)',
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
    arrivalTime: '06:50',
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
  { item: 'Metro in città (Linea 2 A/R)', cny: '6 - 10 CNY', eur: '0,90 - 1,40 €', notes: '3 CNY a corsa' },
  { item: 'Deposito bagagli T3 (se serve)', cny: '20 - 40 CNY', eur: '2,70 - 5,40 €', notes: 'Solo se le valigie non vanno dirette a Milano' },
  { item: 'Cena con Anatra Laccata (condivisa)', cny: '70 - 110 CNY', eur: '9,50 - 15,00 €', notes: 'Quanjude Qianmen o Siji Minfu condivisa in 4' },
  { item: 'Snack, tè e bevande', cny: '20 - 35 CNY', eur: '2,70 - 4,70 €', notes: 'Street food economico' }
];

export const PDF_BUDGET_ESTIMATES = [
  { category: 'Serate e Nightlife (Low-Cost / Frugale)', detail: 'Circa 15 serate puntando su locali per studenti a Sinchon e Kondae, pocha tradizionali e birre/somaek dei convenience store (5 - 15 € a serata invece di locali cari)', totalPerPerson: '120 - 180 €', groupTotal: '480 - 720 €' },
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
    dateStr: '1 marzo 2027',
    dayOfWeek: 'Lunedì',
    phase: 'Partenza',
    title: 'Ritrovo a Malpensa & Volo Air China',
    subtitle: 'Obiettivo: trovarsi tutti insieme al T1 entro le 10:00',
    description: 'Partenza dall\'Italia verso la Cina e poi Seul. Ritrovo al Terminal 1 di Milano Malpensa davanti ai banchi Air China.',
    schedule: [
      { time: 'Prima', activity: 'Ognuno verifica il proprio mezzo e orario per arrivare al T1 entro le 10:00 (condividere nel gruppo orari e contatto).' },
      { time: 'Entro 10:00', activity: 'RITROVO a T1 partenze davanti ai banchi check-in Air China.', isHighlight: true },
      { time: '10:00 - 10:45', activity: 'Check-in e consegna bagagli (23 kg inclusi) tutti insieme. Chiedere carte d\'imbarco di tutti i tratti e valigie etichettate fino a Seul.' },
      { time: '10:45 - 11:45', activity: 'Controlli di sicurezza e passaporto, spuntino al sacco o colazione, poi gate.' },
      { time: '12:30', activity: 'Decollo per la Cina e poi Seul (arrivo a Incheon il 2 marzo alle 11:40).', isHighlight: true }
    ],
    bulletPoints: [
      'Ritrovo T1 ore 10:00 (se la prenotazione indica T2 ci si sposta lì)',
      'Arrivo a Malpensa con mezzi propri o treno ordinario per risparmiare',
      'Bagaglio in stiva: 23 kg inclusi con Air China',
      'Regola d\'oro: banco check-in chiude 60 min prima, ma tassativo arrivare entro le 10:00'
    ],
    costsEstimate: 'Trasporto autonomo (escluso dal budget)',
    locationIds: ['mxp_terminal1'],
    tags: ['Partenza', 'Voli', 'Malpensa', 'Air China'],
    tips: [
      'Se un treno o mezzo ritarda, avvisare subito il gruppo sul gruppo WhatsApp e prendere il successivo.',
      'Chi atterra a Malpensa (es. Wizz Air) ritira eventuale bagaglio e va a piedi alle partenze T1.'
    ]
  },
  {
    id: 1,
    dateStr: '2 marzo 2027',
    dayOfWeek: 'Martedì',
    phase: 'Prima settimana',
    title: 'Arrivo a Seul & Check-in Alloggio',
    subtitle: 'Atterraggio 11:40, AREX, pranzo a Mangwon e sistemazione',
    description: 'Atterraggio a Incheon ore 11:40. Trasferimento in treno AREX verso l\'alloggio prescelto, pranzo autentico al mercato di Mangwon, check-in alle 16:00, spesa al supermercato, SIM/eSIM e ricarica T-money.',
    schedule: [
      { time: '11:40', activity: 'Atterraggio all\'aeroporto di Incheon (ICN). Controlli passaporti e ritiro bagagli.', isHighlight: true },
      { time: '12:45', activity: 'Treno AREX all-stop fino a Hongdae o Gongdeok.' },
      { time: '14:00', activity: 'Lascio bagagli temporaneo e pranzo al vicino mercato tradizionale di Mangwon.', isHighlight: true },
      { time: '16:00', activity: 'Check-in nell\'alloggio Enko prescelto, spesa per la colazione, attivazione SIM/eSIM e T-money.' },
      { time: 'Sera', activity: 'Prima passeggiata serale tranquilla tra i vicoli per riprendersi dal jet lag.' }
    ],
    bulletPoints: [
      'Atterraggio 11:40, AREX verso l\'alloggio',
      'Pranzo al mercato di Mangwon (street food incredibile ed economico)',
      'Check-in alle 16:00 nell\'appartamento',
      'SIM/eSIM e acquisto carta ricaricabile T-money per metro e bus',
      'Sera: passeggiata tranquilla per ambientarsi'
    ],
    costsEstimate: '~10-15 € (AREX + T-money iniziale + street food Mangwon)',
    locationIds: ['incheon_airport', 'acc_c', 'mangwon_market'],
    tags: ['Arrivo', 'AREX', 'Alloggio', 'Mangwon', 'T-money'],
    tips: [
      'Prendere la T-money in aeroporto o al convenience store (GS25/CU) e caricarla con contanti.'
    ]
  },
  {
    id: 2,
    dateStr: '3 marzo 2027',
    dayOfWeek: 'Mercoledì',
    phase: 'Prima settimana',
    title: 'VALORANT MASTERS SEOUL 2027 (Arena Da Annunciare)',
    subtitle: 'L\'evento esports clou del viaggio · Sede ufficiale in attesa di annuncio da Riot Games',
    description: 'Giornata interamente dedicata alle finali del Valorant Masters Seoul 2027 (torneo dal 20 febbraio al 3 marzo). ⚠️ NOTA ARENA: La venue esatta del torneo a Seul NON è ancora stata decisa e deve essere ancora ufficialmente annunciata da Riot Games (possibili sedi: LoL Park Jongno, Sangam e-Stadium, KSPO Dome o Olympic Handball Stadium). Mattina libera, poi live match e festeggiamenti serali nei pocha.',
    schedule: [
      { time: 'Mattina', activity: 'Mattina libera per riposo, colazione e passeggiata nei dintorni.' },
      { time: 'Pomeriggio', activity: 'VALORANT MASTERS SEOUL 2027: Sede e orari ufficiali TBD (in attesa di annuncio Riot Games). Tifo scatenato all\'arena!', isHighlight: true },
      { time: 'Dopo match', activity: 'Pregame nei convenience store e festa in un tipico pocha a Hongdae o Sinchon.', isHighlight: true }
    ],
    bulletPoints: [
      '⚠️ ARENA DA DEFINIRE: Riot Games non ha ancora annunciato la sede ufficiale del torneo (probabili candidate: Sangam e-Stadium, LoL Park, KSPO Dome)',
      'Il torneo si svolge dal 20 febbraio al 3 marzo: il 3 marzo è il giorno finale riservato dal nostro itinerario',
      'Biglietti in vendita circa 4-6 settimane prima su Interpark Global / Ticketlink',
      'Dopo match: pregame nei convenience store e cena tipica in un pocha con soju e piatti da condividere'
    ],
    costsEstimate: 'Biglietto evento (TBD) + ~10-15 € pocha serale',
    locationIds: ['valorant_masters_arena'],
    tags: ['Esports', 'Valorant Masters', 'Arena TBD', 'Highlight', 'Pocha', 'Hongdae'],
    tips: [
      'Monitorare i canali ufficiali @ValorantEsports: l\'arena e le modalità di acquisto biglietti verranno ufficializzate a ridosso dell\'evento.'
    ],
    isSpecialEvent: true
  },
  {
    id: 3,
    dateStr: '4 marzo 2027',
    dayOfWeek: 'Giovedì',
    phase: 'Prima settimana',
    title: 'Palazzi Reali in Hanbok & Sinchon',
    subtitle: 'Gyeongbokgung con costume tradizionale, Bukchon, Insadong e Sinchon',
    description: 'Immersione nella storia e tradizione coreana: noleggio hanbok per entrare gratuitamente nel maestoso Gyeongbokgung, passeggiata nel villaggio di Bukchon Hanok, tè tradizionale a Insadong e serata universitaria a Sinchon.',
    bulletPoints: [
      'Gyeongbokgung con hanbok: l\'ingresso al palazzo reale è GRATUITO per chi indossa il costume tradizionale!',
      'Passeggiata fotografica tra le case storiche di Bukchon Hanok Village',
      'Insadong: vicoli di artigianato, case da tè tradizionali e souvenir autentici',
      'Sera: Sinchon (quartiere universitario economico a due passi da Hongdae)'
    ],
    costsEstimate: '~12-15 € (noleggio hanbok base) + cena a Sinchon (~10-12 €)',
    locationIds: ['gyeongbokgung', 'bukchon_hanok', 'insadong', 'sinchon'],
    tags: ['Storia', 'Palazzi', 'Hanbok', 'Bukchon', 'Sinchon'],
    tips: [
      'Noleggiando l\'hanbok si risparmia il biglietto d\'ingresso del palazzo reale.'
    ]
  },
  {
    id: 4,
    dateStr: '5 marzo 2027',
    dayOfWeek: 'Venerdì',
    phase: 'Prima settimana',
    title: 'Seongsu-dong & Club Night a Hongdae',
    subtitle: 'La "Brooklyn di Seul", Seoul Forest e prima grande serata nei club',
    description: 'Esplorazione di Seongsu-dong tra concept store e pop-up di design. Relax a Seoul Forest (parco gratuito) e serata clubbing a Hongdae.',
    bulletPoints: [
      'Seongsu-dong: concept store all\'avanguardia e architettura industriale riconvertita',
      'Passeggiata a Seoul Forest (parco pubblico gratuito)',
      'Sera a Hongdae: riscaldamento nei bar e clubbing con cover 10.000 - 20.000 KRW'
    ],
    costsEstimate: '~15-20 € cover club + drink',
    locationIds: ['seongsu_dong', 'seoul_forest'],
    tags: ['Moda', 'Trend', 'Seoul Forest', 'Club', 'Nightlife']
  },
  {
    id: 5,
    dateStr: '6 marzo 2027',
    dayOfWeek: 'Sabato',
    phase: 'Prima settimana',
    title: 'Itaewon & Serata Cosmopolita',
    subtitle: 'Giornata lenta e serata nel quartiere internazionale di Seul',
    description: 'Risveglio con calma. Pomeriggio rilassato tra i vicoli panoramici e le boutique di Hannam-dong e Itaewon. Sera dedicata a locali cosmopoliti.',
    bulletPoints: [
      'Giornata lenta per recuperare energie',
      'Passeggiata pomeridiana tra Hannam-dong e Itaewon',
      'Sera a Itaewon: quartiere internazionale',
      'Strategia risparmio: pregame nei convenience store e selezione di un singolo locale (~20-25 €)'
    ],
    costsEstimate: '~20-25 € (serata Itaewon)',
    locationIds: ['itaewon'],
    tags: ['Relax', 'Itaewon', 'Cocktail', 'Internazionale']
  },
  {
    id: 6,
    dateStr: '7 marzo 2027',
    dayOfWeek: 'Domenica',
    phase: 'Prima settimana',
    title: 'Mercati Storici, Design & Noraebang',
    subtitle: 'Gwangjang Market, Cheonggyecheon, DDP e karaoke notturno',
    description: 'Domenica alla scoperta dello street food leggendario: bindaetteok e mandu a Gwangjang Market, passeggiata lungo il torrente Cheonggyecheon, visita al Dongdaemun Design Plaza (DDP) di Zaha Hadid e noraebang serale.',
    bulletPoints: [
      'Mercato tradizionale di Gwangjang: bindaetteok (pancake di soia verde), mayak kimbap e mandu a 3-5 €',
      'Passeggiata sul torrente Cheonggyecheon fino a Dongdaemun (gratis)',
      'Dongdaemun Design Plaza (DDP): architettura futuristica iconica',
      'Sera: Noraebang (karaoke coreano in stanza privata) con soju (~6-8 € a persona pomeridiano)'
    ],
    costsEstimate: '~6-8 € street food + ~6-8 € noraebang e soju',
    locationIds: ['gwangjang_market', 'cheonggyecheon', 'ddp_dongdaemun'],
    tags: ['Cibo', 'Mercati', 'DDP', 'Karaoke', 'Noraebang']
  },
  {
    id: 7,
    dateStr: '8 marzo 2027',
    dayOfWeek: 'Lunedì',
    phase: 'Prima settimana',
    title: 'Namsan, Myeongdong & Language Exchange',
    subtitle: 'Salita a piedi alla N Seoul Tower, shopping cosmetici e scambio linguistico',
    description: 'Salita a piedi verso la N Seoul Tower sul monte Namsan attraverso sentieri alberati panoramici (completamente gratis), shopping cosmetici e street food a Myeongdong, e serata dedicata a un evento di Language Exchange.',
    bulletPoints: [
      'Namsan a piedi: sentiero panoramico gratuito con vista mozzafiato su tutta la metropoli',
      'Discesa verso Myeongdong: paradiso di maschere viso, street food e store K-beauty',
      'Sera: Language Exchange bar per fare amicizia con ragazzi coreani e internazionali'
    ],
    costsEstimate: '~8-10 € (drink evento language exchange)',
    locationIds: ['namsan_tower', 'myeongdong'],
    tags: ['Panorama', 'Namsan', 'Myeongdong', 'Language Exchange', 'Social']
  },
  {
    id: 8,
    dateStr: '9 marzo 2027',
    dayOfWeek: 'Martedì',
    phase: 'Seconda settimana',
    title: 'Museo Nazionale & Serata Studentesca a Kondae',
    subtitle: 'National Museum of Korea (gratis) e la nightlife economica di Konkuk',
    description: 'Mattina e primo pomeriggio al maestoso Museo Nazionale della Corea (accesso gratuito). Sera a Konkuk University (Kondae), celebre area studentesca piena di locali economici.',
    bulletPoints: [
      'National Museum of Korea a Ichon: ingresso alla collezione permanente gratuito',
      'Sera a Konkuk (Kondae): zona studentesca vivace, bar economici, sale giochi e ristoranti a prezzi calmierati',
      'Prezzi molto abbordabili rispetto al centro'
    ],
    costsEstimate: '~10-12 € (cena e drink a Kondae)',
    locationIds: ['national_museum', 'kondae_konkuk'],
    tags: ['Cultura', 'Museo', 'Kondae', 'Studentesco', 'Low Cost']
  },
  {
    id: 9,
    dateStr: '10 marzo 2027',
    dayOfWeek: 'Mercoledì',
    phase: 'Seconda settimana',
    title: 'Gita fuori porta: Incheon, Chinatown & Wolmido',
    subtitle: 'Fuga marittima a circa un\'ora di metro da Seul',
    description: 'Escursione giornaliera nella città portuale di Incheon. Visita all\'unica Chinatown ufficiale della Corea per assaggiare il celebre Jajangmyeon originale, passeggiata sul lungomare di Wolmido con luna park vintage sul mare, e rientro a Seul.',
    bulletPoints: [
      'Metro Linea 1: circa 1 ora di viaggio con normale tariffa T-Money (~2-3 €)',
      'Chinatown di Incheon: culla del Jajangmyeon originale economico',
      'Wolmido Island: passerella panoramica sul Mar Giallo e giostre vintage',
      'Rientro a Seul per cena e serata tranquilla'
    ],
    costsEstimate: '~5 € metro A/R + ~10-12 € cibo',
    locationIds: ['incheon_chinatown_wolmido'],
    tags: ['Gita', 'Incheon', 'Chinatown', 'Wolmido', 'Mare']
  },
  {
    id: 10,
    dateStr: '11 marzo 2027',
    dayOfWeek: 'Giovedì',
    phase: 'Seconda settimana',
    title: 'Starfield COEX, Bongeunsa & Gangnam di Giovedì',
    subtitle: 'La biblioteca futuristica, il tempio millenario e la serata a Gangnam',
    description: 'Pomeriggio nel distretto di Gangnam: la spettacolare Starfield Library all\'interno del COEX Mall, seguita dal tempio Bongeunsa di fronte. Serata a Gangnam di giovedì per evitare i rincari del weekend.',
    bulletPoints: [
      'Starfield Library al COEX: la biblioteca su due piani con pareti di libri alte 13 metri (gratis)',
      'Tempio Bongeunsa: oasi di silenzio fondata nel 794 d.C. con statua monumentale di Buddha',
      'Sera a Gangnam: una sola volta durante la vacanza e di giovedì per spendere meno (~25 €)'
    ],
    costsEstimate: '~25 € (cena e locali a Gangnam di giovedì)',
    locationIds: ['coex_starfield', 'bongeunsa_temple', 'gangnam_district'],
    tags: ['Gangnam', 'COEX', 'Bongeunsa', 'Architettura', 'Nightlife']
  },
  {
    id: 11,
    dateStr: '12 marzo 2027',
    dayOfWeek: 'Venerdì',
    phase: 'Seconda settimana',
    title: 'Gita a Suwon: Fortezza UNESCO & Ingye-dong',
    subtitle: 'La maestosa fortezza di Hwaseong e i locali del dopocena',
    description: 'Gita di un giorno a Suwon (a 45 minuti di metro Linea 1 da Seul) per camminare lungo le mura della Fortezza di Hwaseong (patrimonio UNESCO). Visita al villaggio dei murales e cena a Ingye-dong.',
    bulletPoints: [
      'Fortezza di Hwaseong: 5,7 km di mura difensive percorribili a piedi, porte fortificate e torri',
      'Haenggung-dong: vicoli bohémien attorno alla fortezza con cafè indipendenti',
      'Zona locali per la cena: Ingye-dong (polo giovane di Suwon)',
      'Rientro a Seul prima della mezzanotte con la metro'
    ],
    costsEstimate: '~5 € metro A/R + ~12-15 € cena',
    locationIds: ['suwon_hwaseong', 'suwon_ingyedong'],
    tags: ['Gita', 'Suwon', 'UNESCO', 'Fortezza', 'Ingye-dong']
  },
  {
    id: 12,
    dateStr: '13 marzo 2027',
    dayOfWeek: 'Sabato',
    phase: 'Seconda settimana',
    title: 'Sabato Sera Grande: Hongdae o Itaewon',
    subtitle: 'La notte più attesa del weekend coreano',
    description: 'Sabato libero per mercatini o relax e poi immersione totale nella notte del sabato sera a Seul con opzioni studentesche per contenere i costi.',
    bulletPoints: [
      'Pomeriggio libero a ritmo rilassato per acquisti o relax',
      'Decisione del gruppo: Hongdae (energia giovanile e busker) oppure Itaewon',
      'Soju, birra somaek e cena tipica'
    ],
    costsEstimate: '~15-20 € a persona con opzioni pocha',
    locationIds: ['itaewon'],
    tags: ['Weekend', 'Party', 'Hongdae', 'Itaewon', 'Somaek']
  },
  {
    id: 13,
    dateStr: '14 marzo 2027',
    dayOfWeek: 'Domenica',
    phase: 'Seconda settimana',
    title: 'White Day & Pomeriggio sul Fiume Han',
    subtitle: 'Tradizione coreana del 14 marzo e ramyeon cucinato sul prato',
    description: 'Il 14 marzo in Corea si celebra il White Day. Esperienza locale al Yeouido Hangang Park: preparare i tipici ramyeon con le macchine automatiche dei convenience store e gustarli al tramonto sul prato per 3-4 € a testa.',
    bulletPoints: [
      'White Day: atmosfera festosa e decorazioni speciali nei negozi',
      'Pomeriggio sul fiume Han (Yeouido Hangang Park)',
      'Esperienza K-culture a costo minimo: acquisto ramyeon nei convenience store (CU/GS25), cottura istantanea nelle ciotole di alluminio',
      'Relax sulle rive del fiume guardando lo skyline'
    ],
    costsEstimate: '~4-6 € (ramyeon, uovo, snack e bibite al convenience store)',
    locationIds: ['yeouido_hangang_park'],
    tags: ['White Day', 'Fiume Han', 'Ramyeon', 'K-Culture', 'Relax']
  },
  {
    id: 14,
    dateStr: '15 marzo 2027',
    dayOfWeek: 'Lunedì',
    phase: 'Seconda settimana',
    title: 'Tour DMZ (Confine Corea del Nord) & Language Exchange',
    subtitle: 'Mezza giornata nella zona demilitarizzata più sorvegliata al mondo',
    description: 'Tour organizzato di mezza giornata verso la DMZ (Demilitarized Zone): Parco di Imjingak, 3° Tunnel d\'infiltrazione sotterraneo, Osservatorio Dora. Sera rilassata con language exchange.',
    bulletPoints: [
      'Tour DMZ mattutino di mezza giornata (~35-50 € a persona) oppure opzione giornata libera',
      'Visita all\'Osservatorio di Dora con vista sui villaggi della Corea del Nord',
      'Discesa nel Terzo Tunnel sotterraneo (caschetto compreso)',
      'Rientro a Seul per il primo pomeriggio',
      'Sera: language exchange per salutare gli amici conosciuti'
    ],
    costsEstimate: '~35-50 € (tour DMZ prenotato)',
    locationIds: ['dmz_imjingak'],
    tags: ['DMZ', 'Storia', 'Corea del Nord', 'Tour', 'Esperienza']
  },
  {
    id: 15,
    dateStr: '16 marzo 2027',
    dayOfWeek: 'Martedì',
    phase: 'Ultima parte',
    title: 'Trekking al Parco Nazionale Bukhansan & Pocha Sinchon',
    subtitle: 'Natura selvaggia alle porte della metropoli e cena autentica',
    description: 'Escursione a piedi nel Parco Nazionale del Bukhansan (ingresso 100% gratuito). Sentieri panoramici, aria tersa e templi. Sera rilassata in un pocha tradizionale a Sinchon.',
    bulletPoints: [
      'Bukhansan a piedi: natura incontaminata a 40 minuti di metro dal centro (gratis)',
      'Vette granitiche e vista panoramica su tutta la baia di Seul',
      'Tappa in uno dei piccoli templi buddisti nascosti lungo i sentieri',
      'Sera: pocha a Sinchon con jeon (pancake salati) e makgeolli'
    ],
    costsEstimate: '~10-12 € (cena pocha e makgeolli)',
    locationIds: ['bukhansan_national_park', 'sinchon'],
    tags: ['Trekking', 'Natura', 'Bukhansan', 'Sinchon', 'Makgeolli']
  },
  {
    id: 16,
    dateStr: '17 marzo 2027',
    dayOfWeek: 'Mercoledì',
    phase: 'Ultima parte',
    title: 'Souvenir, K-Skincare & Serata d\'Addio',
    subtitle: 'Razzia da Olive Young con Tax Refund immediato e festa finale',
    description: 'Pomeriggio dedicato al rifornimento di prodotti skincare coreani da Olive Young con tax refund immediato del 7-8%, souvenir tipici a Dongdaemun e ultima vera serata di gruppo.',
    bulletPoints: [
      'Shopping skincare con passaporto alla cassa per tax refund immediato',
      'Mercati e mall di Dongdaemun per souvenir economici',
      'Sera d\'addio a Hongdae/Sinchon con barbecue di gruppo'
    ],
    costsEstimate: 'Shopping personale variabile + ~15-20 € cena',
    locationIds: ['olive_young_flagship', 'ddp_dongdaemun'],
    tags: ['Shopping', 'Skincare', 'Olive Young', 'Souvenir', 'Party']
  },
  {
    id: 17,
    dateStr: '18 marzo 2027',
    dayOfWeek: 'Giovedì',
    phase: 'Ultima parte',
    title: 'Ultimo Giorno Pieno: Valigie & Burocrazia Cina',
    subtitle: 'Preparativi meticolosi, peso valigie (max 23kg) e Arrival Card online',
    description: 'Ultimo giorno pieno a Seul: preparativi per la partenza del giorno successivo. Sveglia il 19 marzo alle 6:30, quindi serata corta e ordinata.',
    schedule: [
      { time: 'Pomeriggio', activity: 'Valigie pronte e pesate (massimo 23 kg a testa). Liquidi nel bagaglio in stiva, power bank nello zaino a mano.' },
      { time: 'Dalle 15:20', activity: 'Online: compilazione Arrival Card per la Cina sul sito s.nia.gov.cn per il transito 240h a Pechino (da fare nelle 24h prima).', isHighlight: true },
      { time: 'Online', activity: 'Verifica prenotazione accesso a Piazza Tiananmen (richiesta con passaporto con almeno 24h di anticipo).' },
      { time: 'Sera', activity: 'Ultima cena tranquilla di saluto. Rientro presto per sveglia alle 6:30.' }
    ],
    bulletPoints: [
      'Valigie pronte e pesate: tassativo massimo 23 kg per non pagare sovrapprezzi',
      'Power bank rigorosamente con marchio 3C nello zaino a mano',
      'Compilazione carta d\'arrivo Cina su s.nia.gov.cn nelle 24h prima (salvare screenshot QR code)',
      'Prenotazione online Piazza Tiananmen con numero di passaporto',
      'Scaricare mappe offline e screenshot dei biglietti'
    ],
    costsEstimate: '~10-12 € (cena tranquilla)',
    locationIds: ['acc_c'],
    tags: ['Valigie', 'Cina Transit', 'Checklist', 'Tiananmen', 'Burocrazia']
  },
  {
    id: 18,
    dateStr: '19 marzo 2027',
    dayOfWeek: 'Venerdì',
    phase: 'Ultima parte',
    title: 'Partenza da Seul & Scalo Epico a Pechino (Transito 240h)',
    subtitle: 'Check-out ore 7:30, volo per Pechino, anatra laccata a Qianmen e rientro a Milano',
    description: 'Giornata clou di viaggio articolata su due capitali asiatiche: mattinata con check-out alloggio e volo Air China da Incheon; pomeriggio e sera a Pechino con il permesso di transito 240 ore senza visto, cena con anatra laccata a Qianmen e ripartenza notturna per Malpensa alle 02:15 del 20 marzo.',
    schedule: [
      { time: '06:30', activity: 'Sveglia e ultime cose in valigia (colazione fuori).' },
      { time: '07:00 - 07:30', activity: 'Giro dell\'appartamento: differenziata, foto delle stanze per Enko, chiavi/codice. Check-out ore 7:30.' },
      { time: '07:30 - 08:15', activity: 'Colazione veloce fuori con le valigie in un bar/caffè già aperto.' },
      { time: '08:15 - 08:30', activity: 'A piedi o in metro fino alla stazione per AREX.' },
      { time: '08:30 - 09:30', activity: 'Treno AREX all-stop (con T-money) fino a Incheon Airport (~50-60 min).' },
      { time: '09:30 - 10:10', activity: 'Eventuale rimborso tasse ai chioschi prima del check-in. Spesa o rimborso residuo T-money.' },
      { time: '10:10 - 10:40', activity: 'Check-in Air China: chiedere valigie etichettate fino a Milano MXP e ritirare ENTRAMBE le carte d\'imbarco (servono a Pechino).', isHighlight: true },
      { time: '10:40 - 11:30', activity: 'Controlli di sicurezza e passaporti.' },
      { time: '12:40', activity: 'Imbarco sul volo per Pechino.' },
      { time: '13:10', activity: 'Decollo da Incheon. Spostare l\'orologio indietro di 1 ora (ora di Pechino). Pasto a bordo.' },
      { time: '14:20 (ora PEK)', activity: 'Atterraggio a Pechino Capitale (PEK). Seguire le indicazioni "240-hour Visa-free Transit" (non andare a International Transfer!).', isHighlight: true },
      { time: '14:30 - 16:30', activity: 'Banco transito 240h: mostrare passaporto, carta d\'imbarco Pechino-Milano e QR card. Ritiro permesso temporaneo, controllo passaporti e dogana.' },
      { time: '16:30 - 17:00', activity: 'Deposito bagagli se serve (solo se non spedite a Milano), contanti 200 CNY.' },
      { time: '17:00', activity: 'Airport Express (25 CNY, 20-25 min) fino a Dongzhimen.' },
      { time: '17:30 - 18:00', activity: 'Metro Linea 2 fino a Qianmen (circa 3 CNY).' },
      { time: '18:00 - 19:00', activity: 'Passeggiata nella via pedonale storica di Qianmen e Dashilar al tramonto.' },
      { time: '19:00 - 20:30', activity: 'Cena con autentica anatra laccata alla pechinese (ristorante Quanjude o Siji Minfu divisa in 4).', isHighlight: true },
      { time: '20:30 - 21:15', activity: 'Piazza Tiananmen illuminata (con prenotazione passaporto) o vicoli Hutong.' },
      { time: '21:15 TASSATIVO', activity: 'PARTENZA per l\'aeroporto. Questo orario non si negozia per nessun motivo!', isHighlight: true },
      { time: '22:15 - 22:45', activity: 'Arrivo al Terminal 3 di PEK con ampio margine di sicurezza.' },
      { time: '23:15', activity: 'Apre il check-in Air China per Milano, controlli di sicurezza e uscita frontiera.' },
      { time: '02:15 (20 Mar)', activity: 'Decollo volo Air China per Milano Malpensa. Arrivo in mattinata a Milano.', isHighlight: true }
    ],
    bulletPoints: [
      'Mattina Seul: check-out 7:30, AREX per Incheon, volo alle 13:10 (valigie spedite fino a Milano)',
      'Pechino 14:20: banco transito 240h per permesso temporaneo di uscita senza visto',
      'Airport Express (25 CNY) + Metro Linea 2 (3 CNY) fino a Qianmen',
      'Cena con famosa anatra laccata condivisa tra i 4 amici',
      'Vista serale Piazza Tiananmen (prenotazione online indispensabile)',
      'Rientro al T3: partenza dal centro ore 21:15 max, arrivo aeroporto entro le 22:45',
      'Volo per Malpensa alle ore 02:15 del 20 marzo'
    ],
    costsEstimate: '120 - 160 CNY (~15 - 22 € a persona per tutto lo scalo)',
    locationIds: ['incheon_airport', 'beijing_airport_t3', 'beijing_qianmen', 'beijing_tiananmen', 'beijing_dongzhimen', 'mxp_terminal1'],
    tags: ['Partenza', 'Scalo', 'Pechino', 'Transito 240h', 'Anatra Laccata', 'Tiananmen', 'Rientro'],
    tips: [
      'A Pechino Google, WhatsApp e Instagram sono bloccati: usare eSIM con IP italiano.',
      'Avere installato e verificato Alipay Tour Pass con carta prima di atterrare.'
    ]
  }
];
