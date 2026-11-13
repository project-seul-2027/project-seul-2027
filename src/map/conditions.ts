import { useEffect, useState } from 'react';
import { fetchAirQuality, type AirQuality } from '../data/airQuality';
import { WEATHER_LOCATIONS, fetchLiveWeather, type LiveWeatherData } from '../data/weatherData';

export interface MapCondition {
  kind: 'air' | 'rain';
  text: string;
}

const REFRESH_MS = 15 * 60_000;
let cache: { at: number; air: AirQuality | null; weather: LiveWeatherData | null } | null = null;

/** Messaggi da dare a chi cammina: mascherina se l'aria è scarsa, ombrello se sta per piovere. */
export function conditionsFrom(air: AirQuality | null, weather: LiveWeatherData | null): MapCondition[] {
  const out: MapCondition[] = [];
  if (weather) {
    const soon = weather.hourly.slice(0, 3);
    const raining = weather.current.precipitationMm > 0.1;
    const likely = soon.some((h) => h.precipitationProbability >= 60);
    if (raining) out.push({ kind: 'rain', text: 'Sta piovendo: ombrello' });
    else if (likely) out.push({ kind: 'rain', text: 'Pioggia nelle prossime ore: ombrello' });
  }
  if (air && air.level >= 2) out.push({ kind: 'air', text: `Aria ${air.labelIt.toLowerCase()} (PM2,5 ${air.pm25}): mascherina FFP2` });
  return out;
}

/** Aria e pioggia a Seul per la mappa del telefono: una richiesta ogni 15 minuti, in silenzio se manca la rete. */
export function useMapConditions(enabled: boolean): MapCondition[] {
  const [items, setItems] = useState<MapCondition[]>(() => (cache ? conditionsFrom(cache.air, cache.weather) : []));
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      if (cache && Date.now() - cache.at < REFRESH_MS) return;
      const seoul = WEATHER_LOCATIONS[0];
      const [air, weather] = await Promise.all([
        fetchAirQuality(seoul.lat, seoul.lng).catch(() => null),
        fetchLiveWeather(seoul).catch(() => null)
      ]);
      if (!air && !weather) return;
      cache = { at: Date.now(), air, weather };
      if (!cancelled) setItems(conditionsFrom(air, weather));
    };
    void load();
    const t = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [enabled]);
  return items;
}
