/** Qualità dell'aria da Open-Meteo (gratis, senza chiave). */
export interface AirQuality {
  usAqi: number;
  pm25: number;
  pm10: number;
  labelIt: string;
  /** 0 buona ... 4 molto cattiva */
  level: 0 | 1 | 2 | 3 | 4;
  adviceIt: string;
}

export function classifyUsAqi(aqi: number): Pick<AirQuality, 'labelIt' | 'level' | 'adviceIt'> {
  if (aqi <= 50) return { labelIt: 'Buona', level: 0, adviceIt: '' };
  if (aqi <= 100) return { labelIt: 'Accettabile', level: 1, adviceIt: 'Chi è sensibile (asma, allergie) può sentire fastidio all’aperto.' };
  if (aqi <= 150) return { labelIt: 'Scarsa', level: 2, adviceIt: 'Meglio una mascherina FFP2 all’aperto e, per le attività lunghe, musei e posti al chiuso al posto di Namsan o Bukhansan.' };
  if (aqi <= 200) return { labelIt: 'Cattiva', level: 3, adviceIt: 'Mascherina FFP2 all’aperto e programma al chiuso: musei, COEX, caffè.' };
  return { labelIt: 'Molto cattiva', level: 4, adviceIt: 'Evita le attività all’aperto lunghe e usa la mascherina FFP2.' };
}

export async function fetchAirQuality(lat: number, lng: number): Promise<AirQuality> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5,us_aqi&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Qualità dell'aria non disponibile (${res.status})`);
  const data = await res.json();
  const c = data?.current;
  if (!c || typeof c.us_aqi !== 'number') throw new Error('Risposta senza dati');
  return { usAqi: Math.round(c.us_aqi), pm25: Math.round(c.pm2_5), pm10: Math.round(c.pm10), ...classifyUsAqi(c.us_aqi) };
}
