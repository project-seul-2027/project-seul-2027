/**
 * Modulo per il recupero e l'elaborazione delle previsioni meteo reali (Open-Meteo API)
 * e dell'archivio climatico storico per Seul e le tappe del viaggio (2-19 Marzo).
 */

export interface WeatherLocation {
  id: string;
  name: string;
  koreanName?: string;
  country: string;
  flag: string;
  shortName: string;
  lat: number;
  lng: number;
  tag: string;
}

export const WEATHER_LOCATIONS: WeatherLocation[] = [
  {
    id: 'seoul',
    name: 'Seul Centro (Jung-gu / Hongdae)',
    shortName: 'Seul Centro',
    koreanName: '서울 중구 · 마포구',
    country: 'Corea del Sud',
    flag: '🇰🇷',
    lat: 37.5665,
    lng: 126.9780,
    tag: 'Base del Viaggio'
  },
  {
    id: 'incheon',
    name: 'Incheon (Aeroporto & Chinatown)',
    shortName: 'Incheon',
    koreanName: '인천국제공항 · 차이나타운',
    country: 'Corea del Sud',
    flag: '🇰🇷',
    lat: 37.4602,
    lng: 126.4407,
    tag: 'Aeroporto & Giorno 9'
  },
  {
    id: 'suwon',
    name: 'Suwon (Fortezza UNESCO)',
    shortName: 'Suwon',
    koreanName: '수원 화성',
    country: 'Corea del Sud',
    flag: '🇰🇷',
    lat: 37.2636,
    lng: 127.0286,
    tag: 'Gita Giorno 11'
  },
  {
    id: 'beijing',
    name: 'Pechino (Scalo 240h Qianmen)',
    shortName: 'Pechino',
    koreanName: '北京 (前门大街)',
    country: 'Cina',
    flag: '🇨🇳',
    lat: 39.9042,
    lng: 116.4074,
    tag: 'Scalo 240h · 19 Mar'
  }
];

export type WeatherTheme =
  | 'sunny'
  | 'clearNight'
  | 'partlyCloudy'
  | 'partlyCloudyNight'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'stormy'
  | 'foggy';

export interface WeatherConditionInfo {
  code: number;
  labelIt: string;
  theme: WeatherTheme;
  iconName: string;
  descriptionIt: string;
  activityTipIt: string;
}

/**
 * Mappatura codici WMO (World Meteorological Organization)
 */
export function getWmoCondition(code: number, isDay = 1): WeatherConditionInfo {
  switch (code) {
    case 0:
      return {
        code,
        labelIt: isDay ? 'Cielo sereno' : 'Notte serena',
        theme: isDay ? 'sunny' : 'clearNight',
        iconName: isDay ? 'Sun' : 'Moon',
        descriptionIt: isDay ? 'Luce tersa e visibilità limpida' : 'Cielo limpido e stellato',
        activityTipIt: isDay
          ? 'Ideale per salire a Namsan Seoul Tower e noleggiare l\'Hanbok a Gyeongbokgung!'
          : 'Notte limpida: ottima per la vista sulle luci della città da Namsan o per una passeggiata lungo il Cheonggyecheon illuminato.'
      };
    case 1:
      return {
        code,
        labelIt: 'Prevalentemente sereno',
        theme: isDay ? 'sunny' : 'clearNight',
        iconName: isDay ? 'Sun' : 'Moon',
        descriptionIt: isDay ? 'Sole dominante con lievi velature' : 'Cielo quasi sgombro con lievi velature',
        activityTipIt: isDay
          ? 'Ottima giornata per camminare a Seoul Forest, Seongsu-dong o escursione a Bukhansan.'
          : 'Serata asciutta e quasi senza nuvole: bella per una passeggiata a Hongdae, sul fiume Han o per street food.'
      };
    case 2:
      return {
        code,
        labelIt: 'Poco nuvoloso',
        theme: isDay ? 'partlyCloudy' : 'partlyCloudyNight',
        iconName: isDay ? 'CloudSun' : 'CloudMoon',
        descriptionIt: isDay ? 'Alternanza di sole e nuvole passeggere' : 'Luna e nuvole passeggere',
        activityTipIt: isDay
          ? 'Clima gradevole per esplorare i mercati all\'aperto (Mangwon, Gwangjang) e i caffè di Ikseon-dong.'
          : 'Serata con qualche nuvola: va bene per mercati serali, pocha e locali di Hongdae.'
      };
    case 3:
      return {
        code,
        labelIt: 'Coperto',
        theme: 'cloudy',
        iconName: 'Cloud',
        descriptionIt: 'Cielo grigio senza precipitazioni di rilievo',
        activityTipIt: 'Perfetto per musei (Museo Nazionale di Corea, Leeum) e shopping sotterraneo a Goto Mall.'
      };
    case 45:
    case 48:
      return {
        code,
        labelIt: 'Foschia o nebbia',
        theme: 'foggy',
        iconName: 'CloudFog',
        descriptionIt: 'Umidità elevata e visibilità ridotta al mattino',
        activityTipIt: 'La visibilità migliora nel pomeriggio; ideale per passeggiate riparate o musei.'
      };
    case 51:
    case 53:
    case 55:
      return {
        code,
        labelIt: 'Pioviggine leggera',
        theme: 'rainy',
        iconName: 'CloudDrizzle',
        descriptionIt: 'Pioggia molto fine e intermittente',
        activityTipIt: 'Basta una giacca impermeabile o un ombrello compatto per girare nei vicoli di Hongdae.'
      };
    case 61:
    case 63:
    case 65:
      return {
        code,
        labelIt: code === 61 ? 'Pioggia leggera' : code === 63 ? 'Pioggia moderata' : 'Pioggia intensa',
        theme: 'rainy',
        iconName: 'CloudRain',
        descriptionIt: 'Precipitazioni continue sulla città',
        activityTipIt: 'Il momento perfetto per gustare Jeon (frittelle coreane) e Makgeolli nei mercati coperti!'
      };
    case 71:
    case 73:
    case 75:
    case 77:
      return {
        code,
        labelIt: code === 71 ? 'Nevicata leggera' : 'Nevicata su Seul',
        theme: 'snowy',
        iconName: 'CloudSnow',
        descriptionIt: 'Fiocchi di neve o nevischio coreano',
        activityTipIt: 'Spettacolo fiabesco nei Palazzi Reali con la neve sui tetti tradizionali in tegole hanok.'
      };
    case 80:
    case 81:
    case 82:
      return {
        code,
        labelIt: 'Rovesci di pioggia',
        theme: 'rainy',
        iconName: 'CloudRain',
        descriptionIt: 'Rovesci temporanei a tratti intensi',
        activityTipIt: 'Rifugiati nella Starfield Library del COEX o all\'interno della Dongdaemun Design Plaza (DDP).'
      };
    case 85:
    case 86:
      return {
        code,
        labelIt: 'Rovesci di neve',
        theme: 'snowy',
        iconName: 'CloudSnow',
        descriptionIt: 'Rovesci di neve mista a pioggia fredda',
        activityTipIt: 'Vestiti a strati con piumino termico e riscaldati con uno stufato caldo Kimchi-jjigae o Samgyetang.'
      };
    case 95:
    case 96:
    case 99:
      return {
        code,
        labelIt: 'Temporale',
        theme: 'stormy',
        iconName: 'CloudLightning',
        descriptionIt: 'Attività temporalesca con fulmini',
        activityTipIt: 'Programma attività al chiuso: shopping a The Hyundai Seoul, Noraebang e sale giochi arcade.'
      };
    default:
      return {
        code,
        labelIt: 'Variabile',
        theme: 'partlyCloudy',
        iconName: 'CloudSun',
        descriptionIt: 'Condizioni atmosferiche miste',
        activityTipIt: 'Porta sempre una giacca a vento e vestiti a strati.'
      };
  }
}

export interface CurrentWeather {
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  relativeHumidity: number;
  windSpeedKmH: number;
  precipitationMm: number;
  weatherCode: number;
  isDay: number;
  condition: WeatherConditionInfo;
}

export interface DailyForecastDay {
  date: string;
  dayNameIt: string;
  dayNumber: number;
  monthNameIt: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  apparentTempMaxC: number;
  apparentTempMinC: number;
  precipitationProbability: number;
  precipitationMm: number;
  windSpeedMaxKmH: number;
  uvIndexMax: number;
  condition: WeatherConditionInfo;
}

export interface HourlyForecastItem {
  time: string;
  hourStr: string;
  temperatureC: number;
  weatherCode: number;
  isDay: number;
  precipitationProbability: number;
  windSpeedKmH: number;
}

export interface LiveWeatherData {
  location: WeatherLocation;
  fetchedAt: string;
  current: CurrentWeather;
  daily: DailyForecastDay[];
  hourly: HourlyForecastItem[];
  source: string;
}

/**
 * Profilo climatico storico e atteso per il periodo esatto del viaggio (2 - 19 Marzo a Seul).
 * Dati storici consolidati KMA (Korea Meteorological Administration) & Open-Meteo Climate Archive.
 */
export interface MarchClimateProfile {
  period: string;
  avgHighC: number;
  avgLowC: number;
  recordHighC: number;
  recordLowC: number;
  avgRainyDays: number;
  avgRainMm: number;
  avgSunshineHoursPerDay: number;
  phenomenonKorean: string;
  phenomenonTitleIt: string;
  phenomenonDescriptionIt: string;
  packingChecklist: {
    item: string;
    importance: 'essenziale' | 'consigliato' | 'opzionale';
    reasonIt: string;
  }[];
}

export const SEOUL_MARCH_CLIMATE: MarchClimateProfile = {
  period: '2 - 19 Marzo (Inizio Primavera / Fine Inverno)',
  avgHighC: 10.4,
  avgLowC: 0.8,
  recordHighC: 19.8,
  recordLowC: -6.2,
  avgRainyDays: 4.8,
  avgRainMm: 28.5,
  avgSunshineHoursPerDay: 6.8,
  phenomenonKorean: '꽃샘추위 (Kkot-saem-chu-wi)',
  phenomenonTitleIt: 'Il "Freddo che invidia i Fiori"',
  phenomenonDescriptionIt:
    'A inizio marzo Seul vive il tipico fenomeno coreano "Kkot-saem-chu-wi": improvvise ondate di vento siberiano secco e freddo (con minime vicino a 0°C / -2°C la sera) alternate a pomeriggi miti e soleggiati (fino a 12°C–15°C). L\'escursione termica giornaliera è notevole (~10-12°C di sbalzo tra giorno e notte).',
  packingChecklist: [
    {
      item: 'Piumino comprimibile o cappotto antivento',
      importance: 'essenziale',
      reasonIt: 'La sera e la notte la temperatura scende a 0°C–2°C, specialmente lungo il fiume Han e a Namsan.'
    },
    {
      item: 'Vestiti a strati (maglione leggero + t-shirt)',
      importance: 'essenziale',
      reasonIt: 'Gli interni (metro, ristoranti, hotel Enko Stay) hanno il riscaldamento a pavimento (Ondol) molto caldo.'
    },
    {
      item: 'Sciarpa leggera o scaldacollo',
      importance: 'consigliato',
      reasonIt: 'Il vento secco di inizio marzo si fa sentire nelle passeggiate all\'aperto e durante la gita all\'isola Wolmido di Incheon.'
    },
    {
      item: 'Scarpe comode e impermeabili',
      importance: 'essenziale',
      reasonIt: 'Cammineremo tra i 15.000 e i 22.000 passi al giorno tra scale della metro, salite a Bukchon e sentieri di Bukhansan.'
    },
    {
      item: 'Berretto termico o cappellino',
      importance: 'consigliato',
      reasonIt: 'Utile per le serate all\'aperto o le passeggiate lungo il fiume Han quando le temperature scendono vicino allo zero.'
    },
    {
      item: 'Crema idratante viso e burrocacao',
      importance: 'consigliato',
      reasonIt: 'L\'aria coreana di marzo è frizzante e poco umida (umidità media 55%), tende a seccare labbra e pelle.'
    }
  ]
};

const IT_DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const IT_MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

/**
 * Recupera le previsioni meteo live a 7 giorni da Open-Meteo per una determinata località.
 */
export async function fetchLiveWeather(location: WeatherLocation): Promise<LiveWeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Errore API Open-Meteo (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();

  const currentCondition = getWmoCondition(data.current.weather_code, data.current.is_day);

  const current: CurrentWeather = {
    time: data.current.time,
    temperatureC: Math.round(data.current.temperature_2m),
    apparentTemperatureC: Math.round(data.current.apparent_temperature),
    relativeHumidity: Math.round(data.current.relative_humidity_2m),
    windSpeedKmH: Math.round(data.current.wind_speed_10m),
    precipitationMm: data.current.precipitation ?? 0,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day,
    condition: currentCondition
  };

  const daily: DailyForecastDay[] = [];
  const times: string[] = data.daily.time || [];

  for (let i = 0; i < Math.min(times.length, 7); i++) {
    const dateStr = times[i];
    // a mezzogiorno: senza orario la data è letta come mezzanotte UTC e, a ovest di Greenwich, scivola al giorno prima
    const d = new Date(`${dateStr}T12:00:00`);
    const code = data.daily.weather_code[i] ?? 0;
    const cond = getWmoCondition(code, 1);

    daily.push({
      date: dateStr,
      dayNameIt: i === 0 ? 'Oggi' : i === 1 ? 'Domani' : IT_DAY_NAMES[d.getDay()],
      dayNumber: d.getDate(),
      monthNameIt: IT_MONTH_NAMES[d.getMonth()],
      weatherCode: code,
      tempMaxC: Math.round(data.daily.temperature_2m_max[i]),
      tempMinC: Math.round(data.daily.temperature_2m_min[i]),
      apparentTempMaxC: Math.round(data.daily.apparent_temperature_max[i] ?? data.daily.temperature_2m_max[i]),
      apparentTempMinC: Math.round(data.daily.apparent_temperature_min[i] ?? data.daily.temperature_2m_min[i]),
      precipitationProbability: Math.round(data.daily.precipitation_probability_max?.[i] ?? 0),
      precipitationMm: Number((data.daily.precipitation_sum?.[i] ?? 0).toFixed(1)),
      windSpeedMaxKmH: Math.round(data.daily.wind_speed_10m_max?.[i] ?? 0),
      uvIndexMax: Math.round(data.daily.uv_index_max?.[i] ?? 3),
      condition: cond
    });
  }

  // Prende le prossime 24 ore dal dataset orario
  const hourly: HourlyForecastItem[] = [];
  const hourlyTimes: string[] = data.hourly?.time || [];
  const currentIsoHour = data.current.time.slice(0, 13);
  let startIndex = hourlyTimes.findIndex((t) => t.startsWith(currentIsoHour));
  if (startIndex === -1) startIndex = 0;

  for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
    const hTime = hourlyTimes[i];
    const hourNum = new Date(hTime).getHours();
    hourly.push({
      time: hTime,
      hourStr: `${hourNum}:00`,
      temperatureC: Math.round(data.hourly.temperature_2m[i]),
      weatherCode: data.hourly.weather_code[i],
      isDay: data.hourly.is_day[i],
      precipitationProbability: Math.round(data.hourly.precipitation_probability?.[i] ?? 0),
      windSpeedKmH: Math.round(data.hourly.wind_speed_10m?.[i] ?? 0)
    });
  }

  return {
    location,
    fetchedAt: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    current,
    daily,
    hourly,
    source: 'Open-Meteo WMO High-Resolution Models'
  };
}

/**
 * Converte da Celsius a Fahrenheit
 */
export function toFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}
