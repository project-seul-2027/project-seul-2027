import { useEffect, useState } from 'react';
import { TRIP_META } from '../data/tripData';
import { itineraryPdfService, type ItineraryPdf } from '../services/itineraryPdfService';

/** Indirizzo del PDF da mostrare: quello caricato dal Posto 1 se c'è, altrimenti quello incluso nel sito. */
export function useItineraryPdf(): { url: string; custom: boolean; meta: ItineraryPdf | null } {
  const [meta, setMeta] = useState<ItineraryPdf | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      return itineraryPdfService.watch(setMeta, () => setMeta(null));
    } catch {
      return undefined;
    }
  }, []);

  const stamp = meta?.updatedAt;
  useEffect(() => {
    if (!meta) {
      setBlobUrl(null);
      return;
    }
    try {
      const bytes = Uint8Array.from(atob(meta.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setBlobUrl(null);
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  return { url: blobUrl ?? TRIP_META.pdfPath, custom: blobUrl !== null, meta };
}
