import { useEffect } from 'react';
import { itineraryPdfService } from '../services/itineraryPdfService';
import { applyItineraryOverride } from '../utils/itineraryOverride';

/** Segue l'itinerario letto dal PDF e lo applica a tutta l'app non appena cambia. */
export function useItineraryOverrideSync(): void {
  useEffect(() => {
    try {
      return itineraryPdfService.watchOverride((doc) => {
        applyItineraryOverride(doc);
      });
    } catch {
      return undefined;
    }
  }, []);
}
