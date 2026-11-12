import type { LatLng } from '../data/seoulMetro';

/** Distanza in metri tra due punti (formula dell'emisenoverso). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Direzione da a verso b in gradi (0 = nord, 90 = est). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Passo a piedi in città: 4,5 km/h, con un piccolo margine per semafori e attraversamenti. */
export const WALK_METERS_PER_MIN = 75;

export const walkMinutes = (meters: number): number => Math.max(1, Math.round(meters / WALK_METERS_PER_MIN));

/** "350 m", "1,2 km", "12 km" */
export function formatMeters(m: number): string {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 1000)} km`;
}

/** "4 min", "1 h 05" */
export function formatMinutes(min: number): string {
  const r = Math.round(min);
  if (r < 60) return `${r} min`;
  const h = Math.floor(r / 60);
  const m = r % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Orario di arrivo a Seul, "14:32", partendo da adesso. */
export function arrivalClock(minutes: number, now = Date.now()): string {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(now + minutes * 60000));
}
