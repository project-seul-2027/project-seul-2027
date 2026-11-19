import type { PdfItem, PdfPage } from './itineraryPdfParser';

/**
 * Misure del documento, ricavate dal testo stesso: così il riconoscimento non dipende
 * dal grassetto (che alcuni PDF non dichiarano) né dalle coordinate esatte di una versione.
 */
export interface PdfLayout {
  /** Altezza del testo normale: quella che copre più caratteri */
  body: number;
  /** Margine sinistro del testo */
  left: number;
}

/** Intestazione e piè di pagina di un A4 (842 pt): fuori da questa fascia non c'è contenuto */
const CONTENT_BOTTOM = 45;
const CONTENT_TOP = 805;

export const isContent = (it: PdfItem): boolean => it.str.trim() !== '' && it.y > CONTENT_BOTTOM && it.y < CONTENT_TOP;

export function measureLayout(pages: PdfPage[]): PdfLayout {
  const items = pages.flat().filter(isContent);
  const charsBySize = new Map<number, number>();
  for (const it of items) {
    const size = Math.round(it.h * 2) / 2;
    charsBySize.set(size, (charsBySize.get(size) ?? 0) + it.str.length);
  }
  let body = 10;
  let most = 0;
  charsBySize.forEach((chars, size) => {
    if (chars > most) {
      most = chars;
      body = size;
    }
  });
  // Il margine è il bordo sinistro più usato: si scartano i pochi elementi sporgenti
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const left = xs.length ? xs[Math.floor(xs.length * 0.02)] : 50;
  return { body, left };
}

/** Un testo più grande del normale (o dichiarato in grassetto) è un titolo */
export const isHeading = (it: PdfItem, layout: PdfLayout, ratio = 1.12): boolean => it.bold || it.h >= layout.body * ratio;
