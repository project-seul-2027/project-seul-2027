/**
 * Dati reali e verificati della Rete Metropolitana di Seul (수도권 전철).
 *
 * Tutti i dati operativi (enti gestori, orari prima/ultima corsa, frequenze medie in ora di punta e morbida,
 * composizione dei convogli, sistema tariffario integrato T-money / Climate Card e supplementi di linea)
 * provengono dalle fonti ufficiali degli operatori ferroviari sudcoreani e del Governo Metropolitano di Seul.
 */

export interface OfficialLineOperationalInfo {
  id: string;
  operatorKo: string;
  operatorEn: string;
  operatorIt: string;
  operatorUrl: string;
  terminalsEn: string;
  terminalsKo: string;
  firstTrainWeekday: string;
  lastTrainWeekday: string;
  lastTrainWeekend: string;
  peakHeadwayMin: string;
  offPeakHeadwayMin: string;
  carsPerTrain: string;
  climateCardEligible: 'full' | 'partial' | 'excluded';
  climateCardNoteIt: string;
  surchargeIt: string;
  serviceStatusIt: string;
  keyHubExitsIt: string;
}

export interface OfficialFareTier {
  id: string;
  categoryIt: string;
  methodIt: string;
  priceKrw: string;
  approxEur: string;
  validityRuleIt: string;
  sourceOrg: string;
}

export interface OfficialMetroSource {
  id: string;
  organizationIt: string;
  organizationKo: string;
  organizationEn: string;
  roleIt: string;
  officialUrl: string;
  verifiedDate: string;
}

export interface SeoulSimulationPreset {
  id: string;
  labelIt: string;
  district: string;
  koreanName: string;
  lat: number;
  lng: number;
  descriptionIt: string;
}

/**
 * Preset di simulazione a Seul quando l'utente testa la geolocalizzazione dall'Italia
 * (fuori dal raggio della rete metropolitana di Seul).
 */
export const SEOUL_GPS_SIMULATION_PRESETS: SeoulSimulationPreset[] = [
  {
    id: 'sim_hongdae_exit9',
    labelIt: 'Hongdae (Uscita 9 · Hongik Univ.)',
    district: 'Mapo-gu',
    koreanName: '홍대입구역 9번출구',
    lat: 37.55685,
    lng: 126.92375,
    descriptionIt: 'Cuore di Hongdae vicino a Linea 2, AREX e Gyeongui-Jungang'
  },
  {
    id: 'sim_myeongdong',
    labelIt: 'Myeongdong Cathedral & Street',
    district: 'Jung-gu',
    koreanName: '명동성당',
    lat: 37.5632,
    lng: 126.9868,
    descriptionIt: 'Centro storico tra Myeongdong (Linea 4) ed Euljiro 1(il)-ga (Linea 2)'
  },
  {
    id: 'sim_seoul_station',
    labelIt: 'Seoul Station (Piazza Principale)',
    district: 'Yongsan-gu',
    koreanName: '서울역광장',
    lat: 37.5547,
    lng: 126.9707,
    descriptionIt: 'Snodo centrale Linee 1, 4, AREX, GTX-A e Gyeongui-Jungang'
  },
  {
    id: 'sim_gangnam_station',
    labelIt: 'Gangnam Station (Uscita 10)',
    district: 'Gangnam-gu',
    koreanName: '강남역 10번출구',
    lat: 37.49795,
    lng: 127.0276,
    descriptionIt: 'Snodo sud di Seul tra Linea 2 e Shinbundang Line'
  },
  {
    id: 'sim_seongsu',
    labelIt: 'Seongsu-dong Cafe Street',
    district: 'Seongdong-gu',
    koreanName: '성수동카페거리',
    lat: 37.5445,
    lng: 127.056,
    descriptionIt: 'Distretto creativo sulla Linea 2 (Seongsu / Ttukseom)'
  },
  {
    id: 'sim_incheon_t1',
    labelIt: 'Aeroporto Incheon Terminal 1',
    district: 'Jung-gu (Incheon)',
    koreanName: '인천공항1터미널역',
    lat: 37.4475,
    lng: 126.4525,
    descriptionIt: 'Stazione ferroviaria sotterranea AREX del Terminal 1'
  }
];

/**
 * Dati operativi ufficiali verificati per tutte le 24 linee presenti nel grafo metropolitano.
 */
export const OFFICIAL_METRO_LINE_DATA: Record<string, OfficialLineOperationalInfo> = {
  '1': {
    id: '1',
    operatorKo: '서울교통공사 · 한국철도공사(KORAIL)',
    operatorEn: 'Seoul Metro & KORAIL',
    operatorIt: 'Seoul Metro (tratta urbana) & KORAIL (Gyeongbu/Gyeongin/Gyeongwon)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Yeoncheon ↔ Incheon / Sinchang / Seodongtan / Gwangmyeong',
    terminalsKo: '연천 ↔ 인천 / 신창 / 서동탄 / 광명',
    firstTrainWeekday: '05:00 – 05:30',
    lastTrainWeekday: '24:00 – 00:55 (urbana)',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '2,5 – 4 min (tratta centrale)',
    offPeakHeadwayMin: '4 – 8 min (rami esterni 10–25 min)',
    carsPerTrain: '10 carrozze (4 per navetta Gwangmyeong)',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida nella tratta urbana di Seul (Dobongsan – Geumcheon-gu Office / Onsu)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW (nessun supplemento di linea)',
    serviceStatusIt: 'Servizio regolare · Treni locali (일반) ed espressi (급행) per Incheon/Cheonan',
    keyHubExitsIt: 'Seoul Station (Uscita 1-2 per KTX/AREX), Jongno 3-ga (Uscita 15 per Ikseon-dong), Dongdaemun (Uscita 8 per Gwangjang/DDP)'
  },
  '2': {
    id: '2',
    operatorKo: '서울교통공사',
    operatorEn: 'Seoul Metro',
    operatorIt: 'Seoul Metro (서울교통공사)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'City Hall Circular Loop (내선/외선순환) + Seongsu–Sinseol-dong + Sindorim–Kkachisan',
    terminalsKo: '시청 순환선 (내선/외선) · 성수지선 · 신정지선',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:45 – 00:55',
    lastTrainWeekend: '23:55 – 24:00',
    peakHeadwayMin: '2 – 2,5 min (anello principale)',
    offPeakHeadwayMin: '4 – 6 min (diramazioni 6–10 min)',
    carsPerTrain: '10 carrozze (anello) · 4/6 carrozze (diramazioni)',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Coperta interamente da Climate Card (100% dentro Seul)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare · Circolare interna oraria (내선) ed esterna antioraria (외선)',
    keyHubExitsIt: 'Hongik Univ. (Uscita 9 per Hongdae Club Street), Euljiro 1-ga (Uscita 5-6 per Myeongdong), Samseong (Uscita 5-6 per COEX Starfield), Seongsu (Uscita 3-4 per Cafe Street)'
  },
  '3': {
    id: '3',
    operatorKo: '서울교통공사 · 한국철도공사(KORAIL)',
    operatorEn: 'Seoul Metro & KORAIL',
    operatorIt: 'Seoul Metro (Jichuk–Ogeum) & KORAIL (Linea Ilsan: Daehwa–Jichuk)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Daehwa ↔ Ogeum',
    terminalsKo: '대화 ↔ 오금',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:45 – 00:50',
    lastTrainWeekend: '23:55 – 24:00',
    peakHeadwayMin: '3 – 4 min',
    offPeakHeadwayMin: '5 – 7 min',
    carsPerTrain: '10 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida da Jichuk a Ogeum (e stazioni Goyang aderenti)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare · Linea principale per i Palazzi Reali',
    keyHubExitsIt: 'Gyeongbokgung (Uscita 5 interna al Palazzo), Anguk (Uscita 2 per Bukchon Hanok, Uscita 3 per Changdeokgung), Sinsa (Uscita 8 per Garosu-gil)'
  },
  '4': {
    id: '4',
    operatorKo: '서울교통공사 · 한국철도공사 · 남양주도시공사',
    operatorEn: 'Seoul Metro & KORAIL',
    operatorIt: 'Seoul Metro (Danggogae–Namtaeryeong) & KORAIL (Gwacheon/Ansan)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Jinjeop ↔ Oido',
    terminalsKo: '진접 ↔ 오이도',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:40 – 00:50',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '2,5 – 4 min',
    offPeakHeadwayMin: '5 – 8 min',
    carsPerTrain: '10 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida nell\'area urbana di Seul e tratta Gwacheon',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Myeongdong (Uscita 6 per Shopping Street, Uscita 3 per Namsan Cable Car), Ichon (Uscita 2 sottopasso diretto Museo Nazionale della Corea), DDP (Uscita 1 per Zaha Hadid Plaza)'
  },
  '5': {
    id: '5',
    operatorKo: '서울교통공사',
    operatorEn: 'Seoul Metro',
    operatorIt: 'Seoul Metro (서울교통공사)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Banghwa ↔ Hanam Geomdansan / Macheon',
    terminalsKo: '방화 ↔ 하남검단산 / 마천',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:40 – 00:50',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '3 – 4,5 min (tronco centrale)',
    offPeakHeadwayMin: '6 – 12 min (rami Hanam/Macheon)',
    carsPerTrain: '8 carrozze',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Valida su tutta la tratta di Seul (attenzione alla biforcazione a Gangdong)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare · Biforcazione orientale a Gangdong (강동)',
    keyHubExitsIt: 'Yeouinaru (Uscita 2-3 per Parco Fiume Han e Ramyeon), Gwanghwamun (Uscita 2 per Piazza Re Sejong), Jongno 3-ga (Uscita 4-5 per Pocha Street)'
  },
  '6': {
    id: '6',
    operatorKo: '서울교통공사',
    operatorEn: 'Seoul Metro',
    operatorIt: 'Seoul Metro (서울교통공사)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Eungam Loop (응암순환) ↔ Sinnae',
    terminalsKo: '응암순환 ↔ 신내',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:40 – 00:50',
    lastTrainWeekend: '23:55 – 24:00',
    peakHeadwayMin: '3,5 – 4,5 min',
    offPeakHeadwayMin: '6 – 8 min',
    carsPerTrain: '8 carrozze',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Coperta interamente da Climate Card (100% dentro Seul)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare · Cappio a senso unico da Eungam a Yeonsinnae',
    keyHubExitsIt: 'Itaewon (Uscita 1-2 per Hamilton Hotel & World Food Street), Mangwon (Uscita 2 per Mercato di Mangwon), Sangsu (Uscita 1 per Hongdae sud)'
  },
  '7': {
    id: '7',
    operatorKo: '서울교통공사 · 인천교통공사',
    operatorEn: 'Seoul Metro & Incheon Transit',
    operatorIt: 'Seoul Metro & Incheon Transit Corporation',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Jangam ↔ Seongnam (Incheon)',
    terminalsKo: '장암 ↔ 석남',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:40 – 00:50',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '2,5 – 3,5 min',
    offPeakHeadwayMin: '5 – 7 min',
    carsPerTrain: '8 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida su tutta la tratta dentro Seul (Jangam – Onsu)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Konkuk Univ. (Uscita 1-2 per Taste Street Kondae), Express Bus Terminal (Uscita 8-1 per Goto Mall), Ttukseom Park (Jayang, Uscita 2-3 per Fiume Han)'
  },
  '8': {
    id: '8',
    operatorKo: '서울교통공사',
    operatorEn: 'Seoul Metro',
    operatorIt: 'Seoul Metro (Linea 8 / Estensione Byeollae)',
    operatorUrl: 'http://www.seoulmetro.co.kr/en/',
    terminalsEn: 'Byeollae ↔ Moran',
    terminalsKo: '별내 ↔ 모란',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:40 – 00:45',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '4 – 5 min',
    offPeakHeadwayMin: '7 – 9 min',
    carsPerTrain: '6 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida su tutta la sezione urbana e stazioni convenzionate',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare (estensione Byeollae operativa da agosto 2024)',
    keyHubExitsIt: 'Jamsil (Uscita 10-11 per Lotte World Tower & Seokchon Lake)'
  },
  '9': {
    id: '9',
    operatorKo: '서울시메트로9호선 · 서울교통공사',
    operatorEn: 'Seoul Metro Line 9 Corp. & Seoul Metro',
    operatorIt: 'Seoul Metro Line 9 Corp. (Fasi 1) & Seoul Metro (Fasi 2–3)',
    operatorUrl: 'https://www.metro9.co.kr/',
    terminalsEn: 'Gaehwa ↔ VHS Medical Center',
    terminalsKo: '개화 ↔ 중앙보훈병원',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:40 – 00:50',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '3 – 4 min (alternanza Locale / Espresso)',
    offPeakHeadwayMin: '6 – 8 min',
    carsPerTrain: '6 carrozze',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Coperta interamente da Climate Card (sia treni Locali che Espressi)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare · Treni Locali (일반) ed Espressi veloci (급행)',
    keyHubExitsIt: 'Bongeunsa (Uscita 1 per Tempio Bongeunsa, Uscita 7 per COEX Starfield), Sinnonhyeon (Uscita 5 per Gangnam), Yeouido (Uscita 3 per IFC Mall)'
  },
  'A': {
    id: 'A',
    operatorKo: '공항철도 (AREX)',
    operatorEn: 'Airport Railroad Co., Ltd. (AREX)',
    operatorIt: 'AREX Co., Ltd. (Ferrovia Aeroportuale Incheon–Gimpo–Seul)',
    operatorUrl: 'https://www.arex.or.kr/',
    terminalsEn: 'Seoul Station ↔ Incheon Int\'l Airport Terminal 2',
    terminalsKo: '서울역 ↔ 인천공항2터미널',
    firstTrainWeekday: '05:20 (da Seoul Stn) · 05:18 (da Incheon T2)',
    lastTrainWeekday: '23:40 – 24:00 (All-Stop)',
    lastTrainWeekend: '23:40 – 24:00',
    peakHeadwayMin: '6 – 8 min (All-Stop) · 35–40 min (Express)',
    offPeakHeadwayMin: '8 – 12 min (All-Stop)',
    carsPerTrain: '6 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida per salire tra Seoul Station e Gimpo Airport; con Climate Card attiva si può anche SCENDere a Incheon T1/T2 (ma da Incheon verso Seul serve T-money)',
    surchargeIt: 'All-Stop: ~4.750 KRW (T1) / ~5.350 KRW (T2) da Seoul Station · Express Non-Stop: 11.000 KRW',
    serviceStatusIt: 'Servizio regolare · All-Stop Train (일반열차) + Express Non-Stop (직통열차)',
    keyHubExitsIt: 'Hongik Univ. (Uscita 7-9), Seoul Station (B2/B3 per All-Stop, B2 per Express), Incheon T1 & T2 Transportation Center'
  },
  'K': {
    id: 'K',
    operatorKo: '한국철도공사 (KORAIL)',
    operatorEn: 'KORAIL (Korea Railroad Corporation)',
    operatorIt: 'KORAIL (Linea suburbana Gyeongui-Jungang)',
    operatorUrl: 'https://www.letskorail.com/',
    terminalsEn: 'Munsan / Imjingang ↔ Jipyeong / Seoul Station',
    terminalsKo: '문산 / 임진강 ↔ 지평 / 서울역',
    firstTrainWeekday: '05:15 – 05:30',
    lastTrainWeekday: '23:45 – 00:20',
    lastTrainWeekend: '23:30 – 23:55',
    peakHeadwayMin: '6 – 10 min (tratta centrale Yongsan–Cheongnyangni)',
    offPeakHeadwayMin: '10 – 18 min',
    carsPerTrain: '8 carrozze (4 sulla tratta nord Munsan)',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida nella tratta urbana di Seul (Susaek – Yangwon) e Goyang',
    surchargeIt: 'Tariffa base integrata 1.550 KRW + distanza oltre 10 km',
    serviceStatusIt: 'Servizio regolare · Due rami occidentali (verso Yongsan/Gajwa o verso Seoul Station)',
    keyHubExitsIt: 'Hongik Univ., Sinchon (Gyeongui), Yongsan, Ichon, Wangsimni, Cheongnyangni'
  },
  'SU': {
    id: 'SU',
    operatorKo: '한국철도공사 (KORAIL)',
    operatorEn: 'KORAIL (Korea Railroad Corporation)',
    operatorIt: 'KORAIL (Linea Suin-Bundang: Seul – Suwon – Incheon)',
    operatorUrl: 'https://www.letskorail.com/',
    terminalsEn: 'Cheongnyangni / Wangsimni ↔ Suwon ↔ Incheon',
    terminalsKo: '청량리 / 왕십리 ↔ 수원 ↔ 인천',
    firstTrainWeekday: '05:20 – 05:35',
    lastTrainWeekday: '23:50 – 00:30',
    lastTrainWeekend: '23:40 – 23:55',
    peakHeadwayMin: '4 – 6 min (Wangsimni–Jukjeon)',
    offPeakHeadwayMin: '7 – 15 min',
    carsPerTrain: '6 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida solo nella sezione interna a Seul (Cheongnyangni – Bokjeong); per Suwon/Incheon usare T-money',
    surchargeIt: 'Tariffa base integrata 1.550 KRW + distanza chilometrica (~2.250 KRW per Suwon)',
    serviceStatusIt: 'Servizio regolare · Collegamento diretto Seoul Forest → Gangnam → Suwon → Incheon Chinatown',
    keyHubExitsIt: 'Seoul Forest (Uscita 3-5 per Parco e Atelier Road), Apgujeongrodeo, Suwon (Uscita 4-9), Incheon (Uscita 1 di fronte al portale di Chinatown)'
  },
  'SB': {
    id: 'SB',
    operatorKo: '네오트랜스 (신분당선)',
    operatorEn: 'NeoTrans Co., Ltd. (Shinbundang Line)',
    operatorIt: 'NeoTrans Co., Ltd. (Linea automatica veloce Shinbundang)',
    operatorUrl: 'https://www.shinbundang.co.kr/',
    terminalsEn: 'Sinsa ↔ Gwanggyo',
    terminalsKo: '신사 ↔ 광교',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '24:00 – 00:20',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '3 – 5 min',
    offPeakHeadwayMin: '5 – 8 min',
    carsPerTrain: '6 carrozze (guida automatica senza conducente)',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'ESCLUSA da Climate Card (richiede sempre carta T-money o biglietto dedicato)',
    surchargeIt: 'Supplemento dedicato: +900 / +1.200 KRW oltre la tariffa base T-money (totale min. 2.450–3.250 KRW)',
    serviceStatusIt: 'Servizio regolare ad alta velocità (Sinsa–Gangnam in 5 minuti)',
    keyHubExitsIt: 'Sinsa, Nonhyeon, Sinnonhyeon, Gangnam, Yangjae'
  },
  'UI': {
    id: 'UI',
    operatorKo: '우이신설경전철',
    operatorEn: 'UiTrans LRT Co., Ltd.',
    operatorIt: 'UiTrans LRT (Metropolitana leggera automatica Ui-Sinseol)',
    operatorUrl: 'http://www.uitrans.co.kr/',
    terminalsEn: 'Bukhansan Ui ↔ Sinseol-dong',
    terminalsKo: '북한산우이 ↔ 신설동',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:30 – 00:45',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '3 – 4 min',
    offPeakHeadwayMin: '5 – 7 min',
    carsPerTrain: '2 carrozze (metro leggera automatica)',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Coperta interamente da Climate Card',
    surchargeIt: 'Tariffa base integrata 1.550 KRW (nessun supplemento)',
    serviceStatusIt: 'Servizio regolare · Accesso diretto al Parco Nazionale Bukhansan',
    keyHubExitsIt: 'Bukhansan Ui (Uscita 2 per inizio sentiero escursionistico Baegundae)'
  },
  'SL': {
    id: 'SL',
    operatorKo: '남서울경전철',
    operatorEn: 'South Seoul LRT Co., Ltd.',
    operatorIt: 'South Seoul LRT (Metropolitana leggera Sillim)',
    operatorUrl: 'https://www.sillimlrt.com/',
    terminalsEn: 'Saetgang ↔ Gwanaksan (Seoul Nat\'l Univ.)',
    terminalsKo: '샛강 ↔ 관악산(서울대)',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '24:00 – 00:30',
    lastTrainWeekend: '23:50 – 24:00',
    peakHeadwayMin: '3,5 – 4,5 min',
    offPeakHeadwayMin: '6 – 8 min',
    carsPerTrain: '3 carrozze (gommata automatica)',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Coperta interamente da Climate Card',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Saetgang (Linea 9), Daebang (Linea 1), Boramae (Linea 7), Sillim (Linea 2)'
  },
  'G': {
    id: 'G',
    operatorKo: '한국철도공사 (KORAIL)',
    operatorEn: 'KORAIL (Gyeongchun Line)',
    operatorIt: 'KORAIL (Linea Gyeongchun verso Gapyeong/Chuncheon)',
    operatorUrl: 'https://www.letskorail.com/',
    terminalsEn: 'Sangbong / Cheongnyangni ↔ Chuncheon',
    terminalsKo: '상봉 / 청량리 ↔ 춘천',
    firstTrainWeekday: '05:20 – 05:40',
    lastTrainWeekday: '23:30 – 24:00',
    lastTrainWeekend: '23:20 – 23:50',
    peakHeadwayMin: '12 – 18 min',
    offPeakHeadwayMin: '18 – 25 min',
    carsPerTrain: '8 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida solo fino a Sinnae (confine di Seul); per Nami Island/Chuncheon usare T-money',
    surchargeIt: 'Tariffa base integrata + distanza (treni ITX-Cheongchun richiedono biglietto separato KORAIL)',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Cheongnyangni, Sangbong, Mangwoo'
  },
  'GA': {
    id: 'GA',
    operatorKo: '지티엑스에이운영 · SG레일',
    operatorEn: 'GTX-A Corp. (Great Train Express Line A)',
    operatorIt: 'GTX-A (Alta velocità suburbana metropolitana)',
    operatorUrl: 'https://www.gtx-a.com/',
    terminalsEn: 'Unjeongjungang ↔ Seoul Station · Suseo ↔ Dongtan',
    terminalsKo: '운정중앙 ↔ 서울역 · 수서 ↔ 동탄',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:30 – 00:45',
    lastTrainWeekend: '00:30',
    peakHeadwayMin: '6 – 10 min',
    offPeakHeadwayMin: '10 – 15 min',
    carsPerTrain: '8 carrozze (180 km/h)',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'Esclusa da Climate Card (richiede T-money con tariffa GTX)',
    surchargeIt: 'Tariffa base GTX: 3.200 KRW (+250 KRW ogni 5 km oltre i 10 km)',
    serviceStatusIt: 'Servizio regolare (tratta Unjeong–Seoul Station inaugurata a fine 2024; Suseo–Dongtan attiva)',
    keyHubExitsIt: 'Seoul Station, Yeonsinnae, Suseo, Seongnam, Dongtan'
  },
  'SH': {
    id: 'SH',
    operatorKo: '한국철도공사 · 서해철도',
    operatorEn: 'KORAIL & Seohae Rail',
    operatorIt: 'KORAIL & Seohae Rail (Linea Seohae)',
    operatorUrl: 'https://www.letskorail.com/',
    terminalsEn: 'Ilsan ↔ Wonsi',
    terminalsKo: '일산 ↔ 원시',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '23:50 – 00:15',
    lastTrainWeekend: '23:45',
    peakHeadwayMin: '7 – 12 min',
    offPeakHeadwayMin: '12 – 20 min',
    carsPerTrain: '4 carrozze',
    climateCardEligible: 'partial',
    climateCardNoteIt: 'Valida a Gimpo Airport e stazioni aderenti',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare · Collegamento nord-sud via Gimpo Airport e Sosa',
    keyHubExitsIt: 'Gimpo Int\'l Airport, Sosa (Linea 1), Choji (Linea 4 / Suin-Bundang)'
  },
  'KK': {
    id: 'KK',
    operatorKo: '한국철도공사 (KORAIL)',
    operatorEn: 'KORAIL (Gyeonggang Line)',
    operatorIt: 'KORAIL (Linea Gyeonggang Pangyo–Yeoju)',
    operatorUrl: 'https://www.letskorail.com/',
    terminalsEn: 'Pangyo ↔ Yeoju',
    terminalsKo: '판교 ↔ 여주',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '23:40 – 24:00',
    lastTrainWeekend: '23:40',
    peakHeadwayMin: '12 – 15 min',
    offPeakHeadwayMin: '20 – 25 min',
    carsPerTrain: '4 carrozze',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'Fuori dal comune di Seul (usare T-money)',
    surchargeIt: 'Tariffa base integrata + distanza chilometrica',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Pangyo (interscambio Shinbundang), Imae (Suin-Bundang)'
  },
  'GP': {
    id: 'GP',
    operatorKo: '김포골드라인운영',
    operatorEn: 'Gimpo Goldline Co., Ltd.',
    operatorIt: 'Gimpo Goldline (Metro leggera per Gimpo)',
    operatorUrl: 'https://www.gimpogoldline.com/',
    terminalsEn: 'Yangchon ↔ Gimpo Int\'l Airport',
    terminalsKo: '양촌 ↔ 김포공항',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '00:30 – 00:45',
    lastTrainWeekend: '23:55',
    peakHeadwayMin: '3 – 3,5 min',
    offPeakHeadwayMin: '6 – 10 min',
    carsPerTrain: '2 carrozze (automatica)',
    climateCardEligible: 'full',
    climateCardNoteIt: 'Inclusa nell\'estensione metropolitana Climate Card',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Gimpo Int\'l Airport (interscambio Linee 5, 9, AREX, Seohae)'
  },
  'UJ': {
    id: 'UJ',
    operatorKo: '의정부경전철',
    operatorEn: 'Uijeongbu LRT',
    operatorIt: 'Uijeongbu Light Rail Transit',
    operatorUrl: 'https://www.ulrt.co.kr/',
    terminalsEn: 'Balgok ↔ Tapseok',
    terminalsKo: '발곡 ↔ 탑석',
    firstTrainWeekday: '05:00',
    lastTrainWeekday: '00:30',
    lastTrainWeekend: '24:00',
    peakHeadwayMin: '3,5 – 4 min',
    offPeakHeadwayMin: '6 – 10 min',
    carsPerTrain: '2 carrozze (VAL 208 automatica)',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'Richiede T-money',
    surchargeIt: 'Supplemento dedicato LRT Uijeongbu (+300 KRW)',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Hoeryong (interscambio Linea 1)'
  },
  'EV': {
    id: 'EV',
    operatorKo: '용인경량전철 (에버라인)',
    operatorEn: 'Yongin EverLine LRT',
    operatorIt: 'Yongin EverLine (Metro leggera per Everland)',
    operatorUrl: 'https://www.everlinecu.com/',
    terminalsEn: 'Giheung ↔ JeonDae·Everland',
    terminalsKo: '기흥 ↔ 전대·에버랜드',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '23:30',
    lastTrainWeekend: '23:30',
    peakHeadwayMin: '3 – 4 min',
    offPeakHeadwayMin: '6 – 10 min',
    carsPerTrain: '1 carrozza (Bombardier Innovia ART)',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'Richiede T-money',
    surchargeIt: 'Supplemento dedicato EverLine (+200 KRW)',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Giheung (interscambio Suin-Bundang), JeonDae·Everland'
  },
  'I1': {
    id: 'I1',
    operatorKo: '인천교통공사',
    operatorEn: 'Incheon Transit Corporation',
    operatorIt: 'Incheon Transit Corporation (인천교통공사)',
    operatorUrl: 'https://www.ictr.or.kr/',
    terminalsEn: 'Gyeyang ↔ Songdo Moonlight Festival Park',
    terminalsKo: '계양 ↔ 송도달빛축제공원',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '24:00 – 00:30',
    lastTrainWeekend: '24:00',
    peakHeadwayMin: '4,5 – 5 min',
    offPeakHeadwayMin: '8 – 9 min',
    carsPerTrain: '8 carrozze',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'Fuori dal comune di Seul (usare T-money durante la gita a Incheon)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Bupyeong (Linea 1), Gyeyang (AREX), Central Park (Songdo)'
  },
  'I2': {
    id: 'I2',
    operatorKo: '인천교통공사',
    operatorEn: 'Incheon Transit Corporation',
    operatorIt: 'Incheon Transit Corporation (인천교통공사)',
    operatorUrl: 'https://www.ictr.or.kr/',
    terminalsEn: 'Geomdan Oryu ↔ Unyeon',
    terminalsKo: '검단오류 ↔ 운연',
    firstTrainWeekday: '05:30',
    lastTrainWeekday: '24:00 – 00:25',
    lastTrainWeekend: '24:00',
    peakHeadwayMin: '3 – 3,5 min',
    offPeakHeadwayMin: '6 – 7 min',
    carsPerTrain: '2 carrozze (automatica)',
    climateCardEligible: 'excluded',
    climateCardNoteIt: 'Fuori dal comune di Seul (usare T-money)',
    surchargeIt: 'Tariffa base integrata 1.550 KRW',
    serviceStatusIt: 'Servizio regolare',
    keyHubExitsIt: 'Geomam (AREX), Juan (Linea 1), Seongnam (Linea 7)'
  }
};

/**
 * Tabella ufficiale delle tariffe T-money, Climate Card e treni speciali.
 */
export const OFFICIAL_SEOUL_METRO_FARES: OfficialFareTier[] = [
  {
    id: 'tmoney_base',
    categoryIt: 'Corsa Standard (T-money / Cashbee)',
    methodIt: 'Carta ricaricabile T-money (Adulti ≥ 19 anni)',
    priceKrw: '1.550 KRW',
    approxEur: '~1,05 €',
    validityRuleIt: 'Fino a 10 km inclusi. +100 KRW ogni 5 km (10–50 km), +100 KRW ogni 8 km (>50 km). Interscambi gratuiti metro↔bus entro 30 min (fino a 4 cambi).',
    sourceOrg: 'Seoul Metro & TOPIS'
  },
  {
    id: 'tmoney_earlybird',
    categoryIt: 'Sconto Early Bird (조조할인)',
    methodIt: 'T-money passando il tornello prima delle 06:30',
    priceKrw: '1.240 KRW',
    approxEur: '~0,84 €',
    validityRuleIt: 'Sconto automatico del 20% sulla tariffa base entrando in stazione dall\'inizio servizio fino alle ore 06:30 del mattino.',
    sourceOrg: 'Seoul Metro'
  },
  {
    id: 'single_ticket',
    categoryIt: 'Biglietto Corsa Singola',
    methodIt: 'Acquisto in contanti alle emettitrici (1회용 교통카드)',
    priceKrw: '1.650 KRW (+500 KRW cauzione)',
    approxEur: '~1,12 €',
    validityRuleIt: 'Maggiorazione di 100 KRW rispetto a T-money + 500 KRW di cauzione rimborsata inserendo la tessera nel chiosco "Deposit Refund" a fine corsa.',
    sourceOrg: 'Seoul Metro'
  },
  {
    id: 'climate_card_short',
    categoryIt: 'Climate Card Pass Turistici (기후동행카드 단기권)',
    methodIt: 'Pass corse illimitate Metro + Bus di Seul (1 / 2 / 3 / 5 / 7 giorni)',
    priceKrw: '5.000 / 8.000 / 10.000 / 15.000 / 20.000 KRW',
    approxEur: '3,40 € – 13,50 €',
    validityRuleIt: 'Corse illimitate su Linee 1–9 (sezione Seul), Ui-Sinseol, Sillim, Gimpo Goldline e bus urbani di Seul + sbarco a Incheon T1/T2. Scheda fisica 3.000 KRW nei convenience store.',
    sourceOrg: 'Seoul Metropolitan Government'
  },
  {
    id: 'arex_fares',
    categoryIt: 'AREX Aeroporto Incheon ↔ Seoul Station',
    methodIt: 'All-Stop Train (일반열차) vs Express Non-Stop (직통열차)',
    priceKrw: '4.750 – 5.350 KRW (All-Stop) · 11.000 KRW (Express)',
    approxEur: '3,20 € / 7,45 €',
    validityRuleIt: 'All-Stop (59 min per Hongdae/Seoul Stn, si paga col saldo T-money). Express Non-Stop (43 min diretto a Seoul Stn con posto riservato e Wi-Fi).',
    sourceOrg: 'AREX Co., Ltd.'
  },
  {
    id: 'shinbundang_surcharge',
    categoryIt: 'Supplemento Linea Shinbundang (신분당선)',
    methodIt: 'Addebito automatico su T-money ai tornelli di interscambio',
    priceKrw: '+900 / +1.200 KRW oltre tariffa base',
    approxEur: '+0,60 / +0,80 €',
    validityRuleIt: 'Linea privata ad alta velocità (Sinsa–Gangnam–Gwanggyo): non accetta Climate Card e applica un supplemento di sezione.',
    sourceOrg: 'NeoTrans Co., Ltd.'
  }
];

/**
 * Guida pratica verificata su vagoni, porte Fast Transfer (빠른환승) e uscite numerate (출구).
 */
export const OFFICIAL_CAR_AND_EXIT_RULES = [
  {
    titleIt: 'Codici Porta e Vagoni per il "Fast Transfer" (빠른환승)',
    badge: 'Carrozze 1–10 · Porte 1–4',
    detailIt:
      'Sulle banchine delle porte di sicurezza (PSD) ogni porta ha un codice a 2 numeri: es. "4-2" significa Carrozza 4, Porta 2 (contando dalla testa del treno nella direzione di marcia). Salendo sulla porta indicata prima di un cambio linea, ti ritroverai esattamente davanti alle scale mobili per la linea successiva, risparmiando fino a 5 minuti di cammino sotterraneo.'
  },
  {
    titleIt: 'Carrozze a Climatizzazione Leggera (약냉방칸)',
    badge: 'Carrozze 4 e 7 (Linee 1, 3, 4) · 4 e 5 (Linee 5–8)',
    detailIt:
      'Su tutti i convogli Seoul Metro da 10 carrozze le vetture n. 4 e n. 7 (e le vetture centrali sui treni da 6/8 carrozze) mantengono una temperatura di 1–2 °C più mite. Sulla Linea 2 circolare non è prevista carrozza debolmente climatizzata per via dell\'affollamento uniforme.'
  },
  {
    titleIt: 'Regola dei Tornelli Sbagliati (5 Minuti / Same-Station Re-entry)',
    badge: 'Gratuito entro 15 min',
    detailIt:
      'Molte stazioni storiche (es. Linea 2 a Euljiro, Chungmuro, Sindorim o Linea 1) hanno banchine separate per le due direzioni senza sottopasso post-tornello. Con T-money o Climate Card, se entri nella direzione sbagliata puoi uscire dal tornello e rientrare in quello opposto della stessa stazione entro 15 minuti senza pagare una seconda corsa (1 sola volta per viaggio).'
  },
  {
    titleIt: 'Numerazione Ufficiale delle Uscite (출구 · Exit)',
    badge: 'Senso orario da Nord',
    detailIt:
      'Tutte le stazioni della metropolitana di Seul numerano le uscite in superficie (출구) in senso orario partendo dall\'Uscita 1 (1번출구, generalmente a nord-ovest). Prima di uscire dai tornelli, segui sempre i cartelli gialli con il numero dell\'uscita (es. Exit 9 a Hongik Univ., Exit 5 a Gyeongbokgung) perché attraversare gli incroci in superficie può richiedere lunghi giri.'
  }
];

/**
 * Elenco ufficiale e verificato delle fonti istituzionali citate nel sito e a fondo pagina.
 */
export const OFFICIAL_METRO_SOURCES: OfficialMetroSource[] = [
  {
    id: 'seoul_metro',
    organizationIt: 'Seoul Metro (Ente Trasporti Metropolitani di Seul)',
    organizationKo: '서울교통공사',
    organizationEn: 'Seoul Metro Corporation',
    roleIt: 'Gestore ufficiale delle Linee 1–8 e Linea 9 (Fasi 2–3), orari prima/ultima corsa, frequenze e numerazione carrozze',
    officialUrl: 'http://www.seoulmetro.co.kr/en/',
    verifiedDate: '2025/2026'
  },
  {
    id: 'korail',
    organizationIt: 'KORAIL (Ferrovie Nazionali Sudcoreane)',
    organizationKo: '한국철도공사',
    organizationEn: 'Korea Railroad Corporation (KORAIL)',
    roleIt: 'Gestore delle linee suburbane integrate Linea 1, Linea 3 (Ilsan), Linea 4 (Gwacheon/Ansan), Gyeongui-Jungang, Suin-Bundang, Gyeongchun e Gyeonggang',
    officialUrl: 'https://www.letskorail.com/',
    verifiedDate: '2025/2026'
  },
  {
    id: 'arex',
    organizationIt: 'AREX Co., Ltd. (Ferrovia Aeroportuale Incheon)',
    organizationKo: '공항철도(주)',
    organizationEn: 'Airport Railroad Co., Ltd.',
    roleIt: 'Orari, frequenze e tariffe ufficiali dei treni All-Stop ed Express Non-Stop tra Aeroporto di Incheon (T1/T2), Gimpo, Hongik Univ. e Seoul Station',
    officialUrl: 'https://www.arex.or.kr/',
    verifiedDate: '2025/2026'
  },
  {
    id: 'seoul_gov_climate',
    organizationIt: 'Governo Metropolitano di Seul & TOPIS',
    organizationKo: '서울특별시 · 서울시 교통정보시스템(TOPIS)',
    organizationEn: 'Seoul Metropolitan Government & TOPIS',
    roleIt: 'Sistema tariffario integrato metropolitano, regole di interscambio e pass turistici ufficiali Climate Card (기후동행카드)',
    officialUrl: 'https://english.seoul.go.kr/policy/transportation/climate-card-short-term-pass/',
    verifiedDate: '2025/2026'
  },
  {
    id: 'tmoney',
    organizationIt: 'T-money Co., Ltd.',
    organizationKo: '(주)티머니',
    organizationEn: 'Tmoney Co., Ltd.',
    roleIt: 'Circuito nazionale di pagamento elettronico T-money, sconto Early Bird (조조할인) e regole di addebito chilometrico',
    officialUrl: 'https://pay.tmoney.co.kr/',
    verifiedDate: '2025/2026'
  },
  {
    id: 'neotrans_shinbundang',
    organizationIt: 'NeoTrans (Linea Shinbundang) & Operatori LRT',
    organizationKo: '네오트랜스(신분당선) · 우이신설경전철 · 남서울경전철',
    organizationEn: 'NeoTrans Co., Ltd. / UiTrans / South Seoul LRT',
    roleIt: 'Dati operativi e supplementi tariffari per Linea Shinbundang, Ui-Sinseol LRT e Sillim LRT',
    officialUrl: 'https://www.shinbundang.co.kr/',
    verifiedDate: '2025/2026'
  },
  {
    id: 'osm_metroscope',
    organizationIt: 'OpenStreetMap Contributors (ODbL)',
    organizationKo: '오픈스트리트맵 한국 커뮤니티',
    organizationEn: 'OpenStreetMap Rail Geometry (route=subway/train/light_rail)',
    roleIt: 'Geometria geodetica reale dei binari e coordinate delle banchine delle 24 linee dell\'area metropolitana di Seul',
    officialUrl: 'https://www.openstreetmap.org/copyright',
    verifiedDate: 'Ottobre 2026'
  }
];
