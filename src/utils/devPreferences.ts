export const SHOW_TRIP_PREVIEW_KEY = 'seul2027:show-trip-preview';
export const DEV_PREFERENCES_EVENT = 'seul2027:dev-preferences-changed';

export function readShowTripPreview(): boolean {
  try {
    return window.localStorage.getItem(SHOW_TRIP_PREVIEW_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeShowTripPreview(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(SHOW_TRIP_PREVIEW_KEY, 'true');
    else window.localStorage.removeItem(SHOW_TRIP_PREVIEW_KEY);
    window.dispatchEvent(new Event(DEV_PREFERENCES_EVENT));
  } catch {
    /* Archiviazione locale non disponibile. */
  }
}
